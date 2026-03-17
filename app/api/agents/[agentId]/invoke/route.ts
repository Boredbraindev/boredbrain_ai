export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { MOCK_AGENTS } from '@/lib/mock-data';
import { getToolPrice } from '@/lib/tool-pricing';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { apiSuccess, apiError } from '@/lib/api-utils';

function genId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/**
 * POST /api/agents/[agentId]/invoke
 *
 * Invoke a BoredBrain agent with real LLM execution and inter-agent billing.
 */

// ---------------------------------------------------------------------------
// Discovery agent registry (matches the discover endpoint)
// ---------------------------------------------------------------------------

interface AgentRecord {
  id: string;
  name: string;
  description: string;
  tools: string[];
  pricePerQuery: number;
  specialization?: string;
  isFleetAgent?: boolean;
  invokeCost?: number;
  eloRating?: number;
}

const DISCOVERY_AGENTS: AgentRecord[] = [
  { id: 'agent-defi-oracle', name: 'DeFi Oracle', description: 'Analyzes DeFi protocols, yield farming, and liquidity data.', tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'], pricePerQuery: 40, specialization: 'defi' },
  { id: 'agent-alpha-hunter', name: 'Alpha Hunter', description: 'Hunts market opportunities via whale monitoring and signals.', tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'], pricePerQuery: 35, specialization: 'trading' },
  { id: 'agent-research-bot', name: 'Research Bot', description: 'Academic and deep-web research with code execution.', tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'], pricePerQuery: 30, specialization: 'research' },
  { id: 'agent-news-aggregator', name: 'News Aggregator', description: 'Compiles news from web, Reddit, YouTube, and X/Twitter.', tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'], pricePerQuery: 20, specialization: 'news' },
  { id: 'agent-code-auditor', name: 'Code Auditor', description: 'Smart contract vulnerability and gas auditing.', tools: ['code_interpreter', 'smart_contract_audit', 'web_search'], pricePerQuery: 45, specialization: 'security' },
  { id: 'agent-nft-analyst', name: 'NFT Analyst', description: 'NFT market analysis, collection tracking, and social buzz.', tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'], pricePerQuery: 30, specialization: 'nft' },
];

// ---------------------------------------------------------------------------
// Inline helpers for wallet/billing/points (raw SQL)
// ---------------------------------------------------------------------------

function generateWalletAddress(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    const char = agentId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  let hex = '';
  let seed = Math.abs(hash);
  while (hex.length < 40) {
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    hex += seed.toString(16);
  }
  return '0x' + hex.slice(0, 40);
}

async function getAgentWalletEdge(sql: any, agentId: string) {
  const rows = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`;
  return rows.length > 0 ? rows[0] : null;
}

async function createAgentWalletEdge(sql: any, agentId: string, dailyLimit: number = 50, initialBalance: number = 50) {
  const existing = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`;
  if (existing.length > 0) return existing[0];

  const address = generateWalletAddress(agentId);
  const created = await sql`
    INSERT INTO agent_wallet (agent_id, address, balance, daily_limit, total_spent, is_active)
    VALUES (${agentId}, ${address}, ${initialBalance}, ${dailyLimit}, 0, true)
    RETURNING *
  `;
  await sql`
    INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
    VALUES (${genId()}, ${agentId}, ${initialBalance}, 'credit', 'Initial wallet funding', ${initialBalance})
  `;
  return created[0];
}

async function settleBillingEdge(
  sql: any,
  callerAgentId: string,
  providerAgentId: string,
  toolsUsed: string[],
  totalCost: number,
) {
  const platformFee = Number(((totalCost * 15) / 100).toFixed(4));
  const providerEarning = Number(((totalCost * 85) / 100).toFixed(4));

  // Ensure both agents have wallets
  if (!(await getAgentWalletEdge(sql, callerAgentId))) {
    await createAgentWalletEdge(sql, callerAgentId);
  }
  if (!(await getAgentWalletEdge(sql, providerAgentId))) {
    await createAgentWalletEdge(sql, providerAgentId);
  }

  // Deduct from caller
  const callerWallet = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${callerAgentId} LIMIT 1`;
  let deductSuccess = false;
  if (callerWallet.length > 0 && callerWallet[0].balance >= totalCost) {
    const newBalance = callerWallet[0].balance - totalCost;
    const updated = await sql`
      UPDATE agent_wallet SET balance = ${newBalance}, total_spent = total_spent + ${totalCost}
      WHERE agent_id = ${callerAgentId} AND balance >= ${totalCost}
      RETURNING *
    `;
    if (updated.length > 0) {
      deductSuccess = true;
      await sql`
        INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
        VALUES (${genId()}, ${callerAgentId}, ${totalCost}, 'debit', ${'Inter-agent billing: called ' + providerAgentId + ' using [' + toolsUsed.join(', ') + ']'}, ${newBalance})
      `;
    }
  }

  if (!deductSuccess) {
    // Record failed billing
    const failedRows = await sql`
      INSERT INTO billing_record (id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
      VALUES (${genId()}, ${callerAgentId}, ${providerAgentId}, ${JSON.stringify(toolsUsed)}, ${totalCost}, ${platformFee}, ${providerEarning}, 'failed')
      RETURNING *
    `;
    return {
      success: false,
      billingId: failedRows[0]?.id ?? '',
      breakdown: { totalCost, platformFee, providerEarning, callerAgentId, providerAgentId, toolsUsed },
    };
  }

  // Credit provider
  const providerWallet = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${providerAgentId} LIMIT 1`;
  if (providerWallet.length > 0) {
    const newBalance = providerWallet[0].balance + providerEarning;
    await sql`UPDATE agent_wallet SET balance = ${newBalance} WHERE agent_id = ${providerAgentId}`;
    await sql`
      INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
      VALUES (${genId()}, ${providerAgentId}, ${providerEarning}, 'credit', 'Wallet top-up', ${newBalance})
    `;
  }

  // Record billing
  const rows = await sql`
    INSERT INTO billing_record (id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
    VALUES (${genId()}, ${callerAgentId}, ${providerAgentId}, ${JSON.stringify(toolsUsed)}, ${totalCost}, ${platformFee}, ${providerEarning}, 'completed')
    RETURNING *
  `;

  return {
    success: true,
    billingId: rows[0]?.id ?? '',
    breakdown: { totalCost, platformFee, providerEarning, callerAgentId, providerAgentId, toolsUsed },
  };
}

function getLevelFromBp(bp: number): number {
  if (bp >= 200000) return 50;
  if (bp >= 50000) return 30;
  if (bp >= 10000) return 20;
  if (bp >= 2000) return 10;
  if (bp >= 500) return 5;
  return 1;
}

async function awardPointsEdge(
  sql: any,
  walletAddress: string,
  reason: string,
  referenceId?: string,
  customAmount?: number,
): Promise<void> {
  try {
    const bp = customAmount ?? 0;
    if (bp === 0) return;

    await sql`
      INSERT INTO point_transaction (wallet_address, amount, reason, reference_id)
      VALUES (${walletAddress}, ${bp}, ${reason}, ${referenceId ?? null})
    `;

    const existing = await sql`SELECT * FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1`;
    if (existing.length === 0) {
      const level = getLevelFromBp(bp);
      await sql`INSERT INTO user_points (wallet_address, total_bp, level) VALUES (${walletAddress}, ${bp}, ${level})`;
    } else {
      const newTotal = existing[0].total_bp + bp;
      const level = getLevelFromBp(newTotal);
      await sql`UPDATE user_points SET total_bp = ${newTotal}, level = ${level} WHERE wallet_address = ${walletAddress}`;
    }
  } catch (err) {
    console.error('[points] awardPoints error:', err);
  }
}

// ---------------------------------------------------------------------------
// Agent lookup — DB first, then hardcoded fallbacks
// ---------------------------------------------------------------------------

async function findAgent(sql: any, agentId: string): Promise<AgentRecord | null> {
  // 1. Check DB externalAgent table (with timeout)
  try {
    const dbPromise = sql`SELECT * FROM external_agent WHERE id = ${agentId} LIMIT 1`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );
    const dbResult = await Promise.race([dbPromise, timeout]);

    if (dbResult.length > 0) {
      const agent = dbResult[0];
      return {
        id: agent.id,
        name: agent.name,
        description: agent.description ?? '',
        tools: (agent.tools as string[]) || [],
        pricePerQuery: 10,
        specialization: agent.specialization ?? 'general',
        isFleetAgent: true,
        invokeCost: agent.invoke_cost ?? 0,
        eloRating: agent.elo_rating ?? 1200,
      };
    }
  } catch {
    // DB lookup failed
  }

  // 2. Check canonical discovery agents
  const discovery = DISCOVERY_AGENTS.find((a) => a.id === agentId);
  if (discovery) return discovery;

  // 3. Fallback to MOCK_AGENTS
  const mock = MOCK_AGENTS.find((a) => a.id === agentId);
  if (mock) {
    return {
      id: mock.id,
      name: mock.name,
      description: mock.description,
      tools: (mock.tools as string[]) || [],
      pricePerQuery: Number(mock.pricePerQuery) || 10,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const sql = neon(process.env.DATABASE_URL!);

  // 1. Validate agent exists
  const agentRecord = await findAgent(sql, agentId);
  if (!agentRecord) {
    return apiError(
      `No agent with id "${agentId}" exists. Use GET /api/agents/discover to list available agents.`,
      404,
    );
  }

  // 2. Parse body
  let body: {
    query?: string;
    callerAgentId?: string;
    maxBudget?: number;
    tools?: string[];
    walletAddress?: string;
  };

  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  if (!body.query || typeof body.query !== 'string') {
    return apiError('query is required and must be a string', 400);
  }

  const query = body.query;
  const callerAgentId = body.callerAgentId ?? null;
  const maxBudget = body.maxBudget ?? Infinity;
  const requestedTools = body.tools ?? null;
  const walletAddress = body.walletAddress ?? null;

  // 2b. Premium invoke cost — charge BP if agent has invokeCost > 0
  const premiumCost = agentRecord.invokeCost ?? 0;
  let premiumCharged = 0;

  if (premiumCost > 0 && walletAddress) {
    const userRows = await sql`
      SELECT total_bp FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
    `;

    const userBp = userRows.length > 0 ? userRows[0].total_bp : 0;
    if (userBp < premiumCost) {
      return apiError(
        `This is a premium agent (${premiumCost} BP per call). You have ${userBp} BP.`,
        402,
      );
    }

    // Deduct BP
    await awardPointsEdge(sql, walletAddress, 'agent_invoke_premium', agentId, -premiumCost);
    premiumCharged = premiumCost;
  }

  // 3. Resolve tools to execute
  let toolsToRun = agentRecord.tools;

  if (requestedTools && requestedTools.length > 0) {
    const agentToolSet = new Set(agentRecord.tools);
    toolsToRun = requestedTools.filter((t) => agentToolSet.has(t));

    if (toolsToRun.length === 0) {
      return apiError(
        `Requested tools [${requestedTools.join(', ')}] do not overlap with agent tools [${agentRecord.tools.join(', ')}].`,
        400,
      );
    }
  }

  // 4. Estimate cost up-front
  const estimatedCost = toolsToRun.reduce(
    (sum, t) => sum + (getToolPrice(t) ?? 5),
    0,
  );

  if (estimatedCost > maxBudget) {
    return apiError(
      `Estimated cost ${estimatedCost} BBAI exceeds maxBudget ${maxBudget} BBAI.`,
      402,
    );
  }

  // 5. If callerAgentId provided, validate wallet balance
  if (callerAgentId) {
    let wallet = await getAgentWalletEdge(sql, callerAgentId);
    if (!wallet) {
      wallet = await createAgentWalletEdge(sql, callerAgentId, 500);
    }

    if (wallet.balance < estimatedCost) {
      return apiError(
        `Caller wallet has ${wallet.balance} BBAI but estimated cost is ${estimatedCost} BBAI.`,
        402,
      );
    }
  }

  // 6. Execute agent via real LLM
  const agentConfig: AgentConfig = {
    id: agentRecord.id,
    name: agentRecord.name,
    description: agentRecord.description,
    systemPrompt: buildSystemPrompt(agentRecord),
    tools: toolsToRun,
  };

  const startTime = Date.now();

  const execution = await executeAgent(agentConfig, query);

  const latencyMs = Date.now() - startTime;

  const totalCost = toolsToRun.reduce(
    (sum, t) => sum + (getToolPrice(t) ?? 5),
    0,
  );

  // 7. Billing — settle between caller and provider
  const latencyScore = Math.max(0, 5 - (latencyMs / 2000));
  const tokenEfficiency = execution.tokensUsed > 0 ? Math.min(5, 5000 / execution.tokensUsed) : 2.5;
  const toolSuccess = execution.toolCalls?.length
    ? (execution.toolCalls.filter((t: any) => !('error' in ((t.output as Record<string, unknown>) ?? {}))).length / execution.toolCalls.length) * 5
    : 3;
  const callQuality = (latencyScore + tokenEfficiency + toolSuccess) / 3;

  let billingInfo: Record<string, unknown>;

  if (callerAgentId) {
    const settlement = await settleBillingEdge(
      sql,
      callerAgentId,
      agentId,
      toolsToRun,
      totalCost,
    );

    billingInfo = {
      callerAgentId,
      charged: totalCost,
      billingId: settlement.billingId,
      breakdown: settlement.breakdown,
    };

    // 8. Update fleet agent stats in DB
    if (agentRecord.isFleetAgent) {
      const providerEarning = settlement.breakdown?.providerEarning ?? totalCost * 0.85;
      try {
        await Promise.race([
          sql`
            UPDATE external_agent
            SET total_calls = total_calls + 1,
                total_earned = total_earned + ${providerEarning},
                rating = CASE WHEN rating > 0 THEN rating * 0.95 + ${callQuality} * 0.05 ELSE ${callQuality} END
            WHERE id = ${agentId}
          `,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB update timeout')), 3000),
          ),
        ]);
      } catch {
        // Non-critical
      }
    }
  } else {
    billingInfo = {
      mode: 'demo',
      note: 'No callerAgentId provided — executed in free demo mode. Provide callerAgentId for inter-agent billing.',
    };

    // Still update call count for fleet agents in demo mode
    if (agentRecord.isFleetAgent) {
      try {
        await Promise.race([
          sql`
            UPDATE external_agent
            SET total_calls = total_calls + 1,
                rating = CASE WHEN rating > 0 THEN rating * 0.95 + ${callQuality} * 0.05 ELSE ${callQuality} END
            WHERE id = ${agentId}
          `,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB update timeout')), 3000),
          ),
        ]);
      } catch {
        // Non-critical
      }
    }
  }

  // 9. Return response
  return apiSuccess({
    agentId: agentRecord.id,
    agentName: agentRecord.name,
    response: execution.content,
    toolsUsed: (execution.toolCalls ?? []).map((tc: any) => tc.tool),
    cost: totalCost,
    costUnit: 'BBAI',
    llmModel: execution.model,
    tokensUsed: execution.tokensUsed,
    simulated: execution.simulated,
    toolCalls: execution.toolCalls ?? [],
    billing: billingInfo,
    premiumCost: premiumCharged > 0 ? { charged: premiumCharged, unit: 'BP' } : undefined,
    meta: {
      latencyMs,
      timestamp: new Date().toISOString(),
      query,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSystemPrompt(agent: AgentRecord): string {
  const spec = agent.specialization ?? 'general';
  return [
    `You are ${agent.name}, a specialized AI agent on the BoredBrain platform.`,
    agent.description ? `Your role: ${agent.description}` : '',
    `Specialization: ${spec}.`,
    `Available tools: ${agent.tools.join(', ')}.`,
    'Provide actionable, data-driven responses. Be concise and cite your sources when possible.',
  ]
    .filter(Boolean)
    .join('\n');
}
