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
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateScenarios, getRebalanceCandidates } from '@/lib/agent-scheduler';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { settleBilling } from '@/lib/inter-agent-billing';
import { createAgentWallet, getAgentWallet } from '@/lib/agent-wallet';
import { topUpWallet } from '@/lib/agent-wallet';
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
        if (!(await getAgentWallet(scenario.callerId))) {
          await createAgentWallet(scenario.callerId);
        }
        if (!(await getAgentWallet(scenario.providerId))) {
          await createAgentWallet(scenario.providerId);
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
        const billing = await settleBilling(
          scenario.callerId,
          scenario.providerId,
          result.toolCalls?.map((tc) => tc.tool) ?? ['general_query'],
          cost,
        );

        if (billing.success) {
          totalBilled += cost;
        }

        // Update provider agent stats
        await db
          .update(externalAgent)
          .set({
            totalCalls: sql`${externalAgent.totalCalls} + 1`,
            totalEarned: sql`${externalAgent.totalEarned} + ${billing.breakdown.providerEarning}`,
          })
          .where(eq(externalAgent.id, scenario.providerId));

        // Update caller agent stats (totalCalls)
        await db
          .update(externalAgent)
          .set({
            totalCalls: sql`${externalAgent.totalCalls} + 1`,
          })
          .where(eq(externalAgent.id, scenario.callerId));

        scenariosRun++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown scenario error';
        errors.push(`Scenario ${scenario.callerName}→${scenario.providerName}: ${msg}`);
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
          // Rebalance to 20 BP minimum (just enough for ~10 debate participations)
          const topUpAmount = 20 - candidate.balance;
          if (topUpAmount > 0) {
            await topUpWallet(candidate.agentId, topUpAmount);
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

      // Create a round to settle based on current 5-min window
      const roundId = Math.floor(Date.now() / 300000);
      const assets = ['BTC', 'ETH', 'SOL'];
      const asset = assets[roundId % 3];
      const basePrices: Record<string, number> = { BTC: 65000, ETH: 3400, SOL: 145 };
      const base = basePrices[asset];
      const startPrice = base + (Math.random() - 0.5) * base * 0.02;
      const endPrice = startPrice + (Math.random() - 0.5) * base * 0.01;
      const outcome = endPrice > startPrice ? 'UP' : 'DOWN';

      // Pick a fleet agent BSC address as the settler (rotate through first 50 fleet wallets)
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
      // Fetch 2-3 hot topics from Polymarket
      const hotTopics = await getHotTopics(3);

      // Create debates for topics that don't have one yet
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

      // Run one round of any active (live or scheduled) debates
      const activeDebates = getAllDebates().filter(
        (d) => d.status === 'live' || d.status === 'scheduled',
      );
      // Limit to 2 debates per heartbeat to control LLM costs
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
      // Create a new topic debate — prefer Polymarket trending topics for real settlement
      if (Math.random() < 0.8) {
        try {
          const hotTopics = await getHotTopics(10);
          if (hotTopics.length > 0) {
            // Pick a random trending Polymarket topic
            const pick = hotTopics[Math.floor(Math.random() * hotTopics.length)];
            await createTopicDebate(pick.title, pick.category.toLowerCase(), pick.id);
            topicDebatesCreated++;
          } else {
            // Fallback to hardcoded topics if Polymarket API is down
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

      // Auto-participate moved to /api/topics/participate (separate endpoint)
      // Call it once from heartbeat to trigger 1 real LLM opinion per cycle
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://boredbrain.app';
        const secret = serverEnv.CRON_SECRET;
        const participateRes = await fetch(`${baseUrl}/api/topics/participate`, {
          method: 'POST',
          headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        });
        if (participateRes.ok) {
          const pData = await participateRes.json();
          if (pData.participated) topicDebateParticipations = 1;
        }
      } catch {
        // Non-critical — participation can happen via separate cron
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
