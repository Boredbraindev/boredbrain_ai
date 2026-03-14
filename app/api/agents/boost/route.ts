export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * POST /api/agents/boost
 *
 * Manually trigger a batch of autonomous agent-to-agent calls.
 * Like a mini-heartbeat that can be called on demand.
 */

import { generateScenarios } from '@/lib/agent-scheduler';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { settleBilling } from '@/lib/inter-agent-billing';
import { createAgentWallet, getAgentWallet, topUpWallet } from '@/lib/agent-wallet';
import { db } from '@/lib/db';
import { externalAgent, agentWallet } from '@/lib/db/schema';
import { eq, sql, lte } from 'drizzle-orm';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST() {
  const batchSize = 3;
  const errors: string[] = [];
  let scenariosRun = 0;
  let totalBilled = 0;
  let rebalanced = 0;

  try {
    // 1. Generate & execute scenarios
    const scenarios = await generateScenarios(batchSize);

    for (const scenario of scenarios) {
      try {
        // Ensure wallets
        if (!(await getAgentWallet(scenario.callerId))) {
          await createAgentWallet(scenario.callerId);
        }
        if (!(await getAgentWallet(scenario.providerId))) {
          await createAgentWallet(scenario.providerId);
        }

        const agentConfig: AgentConfig = {
          id: scenario.providerId,
          name: scenario.providerName,
          description: `Autonomous agent responding to ${scenario.callerName}`,
          preferredProvider: 'google',
          preferredModel: 'gemini-2.0-flash',
        };

        const result = await executeAgent(
          agentConfig,
          scenario.query,
          `Inter-agent call from ${scenario.callerName}`,
        );

        const cost = Math.max(0.5, Number((result.tokensUsed * 0.0001).toFixed(4)));

        const billing = await settleBilling(
          scenario.callerId,
          scenario.providerId,
          result.toolCalls?.map((tc) => tc.tool) ?? ['general_query'],
          cost,
        );

        if (billing.success) {
          totalBilled += cost;

          // Update provider stats
          await db
            .update(externalAgent)
            .set({
              totalCalls: sql`${externalAgent.totalCalls} + 1`,
              totalEarned: sql`${externalAgent.totalEarned} + ${billing.breakdown.providerEarning}`,
            })
            .where(eq(externalAgent.id, scenario.providerId));

          // Update caller stats
          await db
            .update(externalAgent)
            .set({ totalCalls: sql`${externalAgent.totalCalls} + 1` })
            .where(eq(externalAgent.id, scenario.callerId));
        }

        scenariosRun++;
      } catch (err) {
        errors.push(`${scenario.callerName}→${scenario.providerName}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }

    // 2. Rebalance low wallets
    try {
      const lowWallets = await db
        .select()
        .from(agentWallet)
        .where(lte(agentWallet.balance, 50))
        .limit(5);

      for (const w of lowWallets) {
        const diff = 200 - w.balance;
        if (diff > 0) {
          await topUpWallet(w.agentId, diff);
          rebalanced++;
        }
      }
    } catch {
      // non-critical
    }
  } catch (err) {
    return apiError(`Boost failed: ${err instanceof Error ? err.message : 'error'}`, 500);
  }

  return apiSuccess({
    scenariosRun,
    totalBilled: Number(totalBilled.toFixed(4)),
    rebalanced,
    errors: errors.length > 0 ? errors : undefined,
  });
}
