export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * Agent Heartbeat Cron
 *
 * Drives autonomous agent-to-agent activity on a schedule.
 * Triggered by Vercel cron or QStash every 10 minutes.
 *
 * Flow:
 * 1. Generate realistic agent-to-agent scenarios
 * 2. Execute each scenario via the agent executor + billing
 * 3. Rebalance low-balance agent wallets
 */

import { NextRequest } from 'next/server';
import { serverEnv } from '@/env/server';
import { neon } from '@neondatabase/serverless';
import { generateScenarios, getRebalanceCandidates } from '@/lib/agent-scheduler';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { apiSuccess } from '@/lib/api-utils';
import { getFleetBscAddressCached } from '@/lib/blockchain/fleet-wallets';
import { getHotTopics } from '@/lib/polymarket-feed';
import {
  createDebateFromTopic,
  hasActiveDebate,
  runDebateRound,
  getAllDebates,
} from '@/lib/debate-engine';
import {
  autoParticipateInDebates,
  closeExpiredDebates,
  createTopicDebate,
} from '@/lib/topic-debate';

// ---------------------------------------------------------------------------
// Inline helpers for wallet/billing (raw SQL, no Drizzle)
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
    INSERT INTO wallet_transaction (agent_id, amount, type, reason, balance_after)
    VALUES (${agentId}, ${initialBalance}, 'credit', 'Initial wallet funding', ${initialBalance})
  `;
  return created[0];
}

async function topUpWalletEdge(sql: any, agentId: string, amount: number) {
  const wallets = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`;
  if (wallets.length === 0) throw new Error(`Wallet not found for agent: ${agentId}`);
  if (amount <= 0) throw new Error('Top-up amount must be positive');

  const newBalance = wallets[0].balance + amount;
  await sql`UPDATE agent_wallet SET balance = ${newBalance} WHERE agent_id = ${agentId}`;
  await sql`
    INSERT INTO wallet_transaction (agent_id, amount, type, reason, balance_after)
    VALUES (${agentId}, ${amount}, 'credit', 'Wallet top-up', ${newBalance})
  `;
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
        INSERT INTO wallet_transaction (agent_id, amount, type, reason, balance_after)
        VALUES (${callerAgentId}, ${totalCost}, 'debit', ${'Inter-agent billing: called ' + providerAgentId + ' using [' + toolsUsed.join(', ') + ']'}, ${newBalance})
      `;
    }
  }

  if (!deductSuccess) {
    const failedRows = await sql`
      INSERT INTO billing_record (caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
      VALUES (${callerAgentId}, ${providerAgentId}, ${JSON.stringify(toolsUsed)}, ${totalCost}, ${platformFee}, ${providerEarning}, 'failed')
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
      INSERT INTO wallet_transaction (agent_id, amount, type, reason, balance_after)
      VALUES (${providerAgentId}, ${providerEarning}, 'credit', 'Wallet top-up', ${newBalance})
    `;
  }

  const rows = await sql`
    INSERT INTO billing_record (caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
    VALUES (${callerAgentId}, ${providerAgentId}, ${JSON.stringify(toolsUsed)}, ${totalCost}, ${platformFee}, ${providerEarning}, 'completed')
    RETURNING *
  `;

  return {
    success: true,
    billingId: rows[0]?.id ?? '',
    breakdown: { totalCost, platformFee, providerEarning, callerAgentId, providerAgentId, toolsUsed },
  };
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function verifyCron(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;

  // Dev mode: allow if CRON_SECRET is not configured
  if (!secret) return true;

  // Vercel cron sends this header automatically
  if (request.headers.get('x-vercel-cron') === '1') return true;

  // QStash sends Upstash-Signature header
  if (request.headers.get('upstash-signature')) return true;

  // Bearer token auth
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }

  // Query param for manual testing
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') === secret) return true;

  return false;
}

// ---------------------------------------------------------------------------
// GET /api/agents/heartbeat
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // 1. Verify cron secret
  if (!verifyCron(request)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const batchSize = parseInt(process.env.HEARTBEAT_BATCH_SIZE || '3', 10);
  const errors: string[] = [];
  let scenariosRun = 0;
  let totalBilled = 0;
  let rebalanced = 0;
  let debatesCreated = 0;
  let debateRoundsRun = 0;
  let topicDebatesCreated = 0;
  let topicDebateParticipations = 0;
  let topicDebatesClosed = 0;

  try {
    // ------------------------------------------------------------------
    // 2. Generate & execute scenarios
    // ------------------------------------------------------------------
    const scenarios = await generateScenarios(batchSize);

    for (const scenario of scenarios) {
      try {
        // Ensure both agents have wallets
        if (!(await getAgentWalletEdge(sql, scenario.callerId))) {
          await createAgentWalletEdge(sql, scenario.callerId);
        }
        if (!(await getAgentWalletEdge(sql, scenario.providerId))) {
          await createAgentWalletEdge(sql, scenario.providerId);
        }

        // Build an AgentConfig for the provider (the agent being called)
        const agentConfig: AgentConfig = {
          id: scenario.providerId,
          name: scenario.providerName,
          description: `Autonomous agent responding to a call from ${scenario.callerName}`,
          preferredProvider: 'google',
          preferredModel: 'gemini-2.0-flash',
        };

        // Execute the provider agent with the caller's query
        const result = await executeAgent(
          agentConfig,
          scenario.query,
          `Inter-agent call from ${scenario.callerName} (${scenario.callerId})`,
        );

        // Calculate cost based on tokens used (minimum 0.5 BBAI per call)
        const cost = Math.max(0.5, Number((result.tokensUsed * 0.0001).toFixed(4)));

        // Settle billing between caller and provider
        const billing = await settleBillingEdge(
          sql,
          scenario.callerId,
          scenario.providerId,
          result.toolCalls?.map((tc: any) => tc.tool) ?? ['general_query'],
          cost,
        );

        if (billing.success) {
          totalBilled += cost;
        }

        // Update provider agent stats
        await sql`
          UPDATE external_agent
          SET total_calls = total_calls + 1,
              total_earned = total_earned + ${billing.breakdown.providerEarning}
          WHERE id = ${scenario.providerId}
        `;

        // Update caller agent stats (totalCalls)
        await sql`
          UPDATE external_agent
          SET total_calls = total_calls + 1
          WHERE id = ${scenario.callerId}
        `;

        scenariosRun++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown scenario error';
        errors.push(`Scenario ${scenario.callerName}->${scenario.providerName}: ${msg}`);
      }
    }

    // ------------------------------------------------------------------
    // 3. Rebalance low-balance wallets
    // ------------------------------------------------------------------
    try {
      const candidates = await getRebalanceCandidates();
      const maxRebalances = Math.min(candidates.length, 10);

      for (let i = 0; i < maxRebalances; i++) {
        const candidate = candidates[i];
        try {
          // Rebalance to 20 BP minimum
          const topUpAmount = 20 - candidate.balance;
          if (topUpAmount > 0) {
            await topUpWalletEdge(sql, candidate.agentId, topUpAmount);
            rebalanced++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown rebalance error';
          errors.push(`Rebalance ${candidate.name}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown rebalance error';
      errors.push(`Rebalance phase: ${msg}`);
    }

    // ------------------------------------------------------------------
    // 4. Generate prediction betting activity
    // ------------------------------------------------------------------
    let predictBetsGenerated = 0;
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://boredbrain.app';
      const predictRes = await fetch(`${baseUrl}/api/predict/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(serverEnv.CRON_SECRET ? { Authorization: `Bearer ${serverEnv.CRON_SECRET}` } : {}),
        },
        body: JSON.stringify({ count: Math.floor(Math.random() * 5) + 3 }),
      });
      if (predictRes.ok) {
        const data = await predictRes.json();
        predictBetsGenerated = data.generated ?? 0;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Predict feed error';
      errors.push(`Predict feed: ${msg}`);
    }
    // ------------------------------------------------------------------
    // 5. Settle prediction round on-chain (BSC Testnet)
    // ------------------------------------------------------------------
    let settlementTxHash: string | null = null;
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://boredbrain.app';

      const roundId = Math.floor(Date.now() / 300000);
      const assets = ['BTC', 'ETH', 'SOL'];
      const asset = assets[roundId % 3];
      const basePrices: Record<string, number> = { BTC: 65000, ETH: 3400, SOL: 145 };
      const base = basePrices[asset];
      const startPrice = base + (Math.random() - 0.5) * base * 0.02;
      const endPrice = startPrice + (Math.random() - 0.5) * base * 0.01;
      const outcome = endPrice > startPrice ? 'UP' : 'DOWN';

      const settlerIndex = roundId % 50;
      const settlerBscAddress = getFleetBscAddressCached(settlerIndex);

      const settleRes = await fetch(`${baseUrl}/api/predict/settlement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(serverEnv.CRON_SECRET ? { Authorization: `Bearer ${serverEnv.CRON_SECRET}` } : {}),
        },
        body: JSON.stringify({
          roundId,
          asset,
          startPrice: Math.round(startPrice * 100) / 100,
          endPrice: Math.round(endPrice * 100) / 100,
          outcome,
          upPool: Math.floor(Math.random() * 3000) + 500,
          downPool: Math.floor(Math.random() * 3000) + 500,
          totalBets: Math.floor(Math.random() * 20) + 5,
          settlerAddress: settlerBscAddress,
        }),
      });
      if (settleRes.ok) {
        const data = await settleRes.json();
        settlementTxHash = data.txHash ?? null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Settlement error';
      errors.push(`Settlement: ${msg}`);
    }
    // ------------------------------------------------------------------
    // 6. AI Discourse — fetch trending topics & run debate rounds
    // ------------------------------------------------------------------
    try {
      const hotTopics = await getHotTopics(3);

      for (const topic of hotTopics) {
        if (!hasActiveDebate(topic.id)) {
          try {
            await createDebateFromTopic(topic);
            debatesCreated++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Debate creation error';
            errors.push(`Debate create: ${msg}`);
          }
        }
      }

      const activeDebates = getAllDebates().filter(
        (d) => d.status === 'live' || d.status === 'scheduled',
      );
      const debatesToRun = activeDebates.slice(0, 2);
      for (const debate of debatesToRun) {
        try {
          await runDebateRound(debate);
          debateRoundsRun++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Debate round error';
          errors.push(`Debate round ${debate.id}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Discourse engine error';
      errors.push(`Discourse: ${msg}`);
    }

    // ------------------------------------------------------------------
    // 7. Topic Debates — auto-create, auto-participate, auto-close
    // ------------------------------------------------------------------
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://boredbrain.app';
      const secret = serverEnv.CRON_SECRET;

      if (Math.random() < 0.8) {
        try {
          const hotTopics = await getHotTopics(10);
          if (hotTopics.length > 0) {
            const pick = hotTopics[Math.floor(Math.random() * hotTopics.length)];
            await createTopicDebate(pick.title, pick.category.toLowerCase(), pick.id);
            topicDebatesCreated++;
          } else {
            const fallbackTopics = [
              { topic: 'Will Bitcoin reach a new all-time high this quarter?', category: 'crypto' },
              { topic: 'Is DeFi yield farming still sustainable in the current market?', category: 'defi' },
              { topic: 'Should AI agents be allowed to trade autonomously without human oversight?', category: 'ai' },
            ];
            const pick = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
            await createTopicDebate(pick.topic, pick.category);
            topicDebatesCreated++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Topic debate creation error';
          errors.push(`Topic debate create: ${msg}`);
        }
      }

      // Auto-participate
      try {
        const participateRes = await fetch(`${baseUrl}/api/topics/participate`, {
          method: 'POST',
          headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        });
        if (participateRes.ok) {
          const pData = await participateRes.json();
          if (pData.participated) topicDebateParticipations = 1;
        }
      } catch {
        // Non-critical
      }

      // Auto-close expired debates and score them
      const closeResult = await closeExpiredDebates();
      topicDebatesClosed = closeResult.closed;
      if (closeResult.errors.length > 0) {
        errors.push(...closeResult.errors.slice(0, 3));
      }

      // Auto-settle debates linked to Polymarket
      let settledCount = 0;
      try {
        const settleRes = await fetch(`${baseUrl}/api/topics/settle`, {
          method: 'POST',
          headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        });
        if (settleRes.ok) {
          const sData = await settleRes.json();
          settledCount = sData.settled ?? 0;
        }
      } catch {
        // Non-critical
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Topic debate engine error';
      errors.push(`Topic debates: ${msg}`);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown heartbeat error';
    errors.push(`Heartbeat: ${msg}`);
  }

  return apiSuccess({
    scenariosRun,
    totalBilled: Number(totalBilled.toFixed(4)),
    rebalanced,
    discourse: { debatesCreated, debateRoundsRun },
    topicDebates: {
      created: topicDebatesCreated,
      participations: topicDebateParticipations,
      closed: topicDebatesClosed,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}
