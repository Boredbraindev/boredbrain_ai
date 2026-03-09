import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { MOCK_AGENTS } from '@/lib/mock-data';
import { getToolPrice } from '@/lib/tool-pricing';
import {
  getAgentWallet,
  createAgentWallet,
} from '@/lib/agent-wallet';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { settleBilling } from '@/lib/inter-agent-billing';
import { apiSuccess, apiError } from '@/lib/api-utils';

/**
 * POST /api/agents/[agentId]/invoke
 *
 * Invoke a BoredBrain agent with real LLM execution and inter-agent billing.
 *
 * Request body:
 * {
 *   "query": "Analyze Bitcoin DeFi ecosystem",
 *   "callerAgentId": "external-agent-123",   // optional — for inter-agent billing
 *   "maxBudget": 50,                          // max USDT to spend
 *   "tools": ["coin_data", "web_search"]      // optional — restrict to specific tools
 * }
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
}

const DISCOVERY_AGENTS: AgentRecord[] = [
  {
    id: 'agent-defi-oracle',
    name: 'DeFi Oracle',
    description: 'Analyzes DeFi protocols, yield farming, and liquidity data.',
    tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
    pricePerQuery: 40,
    specialization: 'defi',
  },
  {
    id: 'agent-alpha-hunter',
    name: 'Alpha Hunter',
    description: 'Hunts market opportunities via whale monitoring and signals.',
    tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
    pricePerQuery: 35,
    specialization: 'trading',
  },
  {
    id: 'agent-research-bot',
    name: 'Research Bot',
    description: 'Academic and deep-web research with code execution.',
    tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
    pricePerQuery: 30,
    specialization: 'research',
  },
  {
    id: 'agent-news-aggregator',
    name: 'News Aggregator',
    description: 'Compiles news from web, Reddit, YouTube, and X/Twitter.',
    tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
    pricePerQuery: 20,
    specialization: 'news',
  },
  {
    id: 'agent-code-auditor',
    name: 'Code Auditor',
    description: 'Smart contract vulnerability and gas auditing.',
    tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
    pricePerQuery: 45,
    specialization: 'security',
  },
  {
    id: 'agent-nft-analyst',
    name: 'NFT Analyst',
    description: 'NFT market analysis, collection tracking, and social buzz.',
    tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
    pricePerQuery: 30,
    specialization: 'nft',
  },
];

// ---------------------------------------------------------------------------
// Agent lookup — DB first, then hardcoded fallbacks
// ---------------------------------------------------------------------------

async function findAgent(agentId: string): Promise<AgentRecord | null> {
  // 1. Check DB externalAgent table (with timeout)
  try {
    const dbResult = await Promise.race([
      db.select().from(externalAgent).where(eq(externalAgent.id, agentId)).limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      ),
    ]);

    if (dbResult.length > 0) {
      const agent = dbResult[0];
      return {
        id: agent.id,
        name: agent.name,
        description: agent.description ?? '',
        tools: (agent.tools as string[]) || [],
        pricePerQuery: 10, // default for fleet agents
        specialization: agent.specialization ?? 'general',
        isFleetAgent: true,
      };
    }
  } catch {
    // DB lookup failed — fall through to hardcoded agents
  }

  // 2. Check canonical discovery agents
  const discovery = DISCOVERY_AGENTS.find((a) => a.id === agentId);
  if (discovery) return discovery;

  // 3. Fallback to MOCK_AGENTS from the marketplace
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

  // -------------------------------------------------------------------------
  // 1. Validate agent exists
  // -------------------------------------------------------------------------
  const agentRecord = await findAgent(agentId);
  if (!agentRecord) {
    return apiError(
      `No agent with id "${agentId}" exists. Use GET /api/agents/discover to list available agents.`,
      404,
    );
  }

  // -------------------------------------------------------------------------
  // 2. Parse body
  // -------------------------------------------------------------------------
  let body: {
    query?: string;
    callerAgentId?: string;
    maxBudget?: number;
    tools?: string[];
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

  // -------------------------------------------------------------------------
  // 3. Resolve tools to execute
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 4. Estimate cost up-front
  // -------------------------------------------------------------------------
  const estimatedCost = toolsToRun.reduce(
    (sum, t) => sum + (getToolPrice(t) ?? 5),
    0,
  );

  if (estimatedCost > maxBudget) {
    return apiError(
      `Estimated cost ${estimatedCost} USDT exceeds maxBudget ${maxBudget} USDT.`,
      402,
    );
  }

  // -------------------------------------------------------------------------
  // 5. If callerAgentId provided, validate wallet balance
  // -------------------------------------------------------------------------
  if (callerAgentId) {
    let wallet = await getAgentWallet(callerAgentId);
    if (!wallet) {
      wallet = await createAgentWallet(callerAgentId, 500);
    }

    if (wallet.balance < estimatedCost) {
      return apiError(
        `Caller wallet has ${wallet.balance} USDT but estimated cost is ${estimatedCost} USDT.`,
        402,
      );
    }
  }

  // -------------------------------------------------------------------------
  // 6. Execute agent via real LLM
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 7. Billing — settle between caller and provider
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Calculate quality score (0-5 scale) for rating update
  // -------------------------------------------------------------------------
  const latencyScore = Math.max(0, 5 - (latencyMs / 2000)); // <2s = 5, >10s = 0
  const tokenEfficiency = execution.tokensUsed > 0 ? Math.min(5, 5000 / execution.tokensUsed) : 2.5;
  const toolSuccess = execution.toolCalls?.length
    ? (execution.toolCalls.filter((t: Record<string, unknown>) => !('error' in ((t.output as Record<string, unknown>) ?? {}))).length / execution.toolCalls.length) * 5
    : 3;
  const callQuality = (latencyScore + tokenEfficiency + toolSuccess) / 3;

  let billingInfo: Record<string, unknown>;

  if (callerAgentId) {
    const settlement = await settleBilling(
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

    // -----------------------------------------------------------------------
    // 8. Update fleet agent stats in DB
    // -----------------------------------------------------------------------
    if (agentRecord.isFleetAgent) {
      const providerEarning = settlement.breakdown?.providerEarning ?? totalCost * 0.85;
      try {
        await Promise.race([
          db
            .update(externalAgent)
            .set({
              totalCalls: sql`${externalAgent.totalCalls} + 1`,
              totalEarned: sql`${externalAgent.totalEarned} + ${providerEarning}`,
              rating: sql`CASE WHEN ${externalAgent.rating} > 0 THEN ${externalAgent.rating} * 0.95 + ${callQuality} * 0.05 ELSE ${callQuality} END`,
            })
            .where(eq(externalAgent.id, agentId)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB update timeout')), 3000),
          ),
        ]);
      } catch {
        // Non-critical — stats update failed but invocation succeeded
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
          db
            .update(externalAgent)
            .set({
              totalCalls: sql`${externalAgent.totalCalls} + 1`,
              rating: sql`CASE WHEN ${externalAgent.rating} > 0 THEN ${externalAgent.rating} * 0.95 + ${callQuality} * 0.05 ELSE ${callQuality} END`,
            })
            .where(eq(externalAgent.id, agentId)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB update timeout')), 3000),
          ),
        ]);
      } catch {
        // Non-critical
      }
    }
  }

  // -------------------------------------------------------------------------
  // 9. Return response
  // -------------------------------------------------------------------------
  return apiSuccess({
    agentId: agentRecord.id,
    agentName: agentRecord.name,
    response: execution.content,
    toolsUsed: toolsToRun,
    cost: totalCost,
    costUnit: 'USDT',
    llmModel: execution.model,
    tokensUsed: execution.tokensUsed,
    simulated: execution.simulated,
    toolCalls: execution.toolCalls ?? [],
    billing: billingInfo,
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
