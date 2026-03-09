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

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function verifyCron(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;

  // Dev mode: allow if CRON_SECRET is not configured
  if (!secret) return true;

  // Vercel cron sends this header automatically
  if (request.headers.get('x-vercel-cron') === '1') return true;

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
          const topUpAmount = 200 - candidate.balance;
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown heartbeat error';
    errors.push(`Heartbeat: ${msg}`);
  }

  return apiSuccess({
    scenariosRun,
    totalBilled: Number(totalBilled.toFixed(4)),
    rebalanced,
    errors: errors.length > 0 ? errors : undefined,
  });
}
