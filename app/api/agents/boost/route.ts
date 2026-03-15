export const runtime = 'nodejs';

/**
 * POST /api/agents/boost
 *
 * Manually trigger a batch of autonomous agent-to-agent calls.
 * Like a mini-heartbeat that can be called on demand.
 */

import { generateScenarios } from '@/lib/agent-scheduler';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST() {
  const batchSize = 3;
  const errors: string[] = [];
  let scenariosRun = 0;
  let totalBilled = 0;
  let rebalanced = 0;

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // 1. Generate & execute scenarios
    const scenarios = await generateScenarios(batchSize);

    for (const scenario of scenarios) {
      try {
        // Ensure wallets (inline createAgentWallet / getAgentWallet)
        for (const aId of [scenario.callerId, scenario.providerId]) {
          const existing = await sql`
            SELECT agent_id FROM agent_wallet WHERE agent_id = ${aId} LIMIT 1
          `;
          if (existing.length === 0) {
            await sql`
              INSERT INTO agent_wallet (agent_id, balance, total_spent, total_received, is_active)
              VALUES (${aId}, 1000, 0, 0, true)
              ON CONFLICT (agent_id) DO NOTHING
            `;
          }
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

        // Inline settleBilling: 85% provider, 15% platform
        const platformFee = Number((cost * 0.15).toFixed(4));
        const providerEarning = Number((cost * 0.85).toFixed(4));
        const toolsUsed = result.toolCalls?.map((tc) => tc.tool) ?? ['general_query'];

        try {
          await sql`
            INSERT INTO billing_record (caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, timestamp)
            VALUES (${scenario.callerId}, ${scenario.providerId}, ${JSON.stringify(toolsUsed)}, ${cost}, ${platformFee}, ${providerEarning}, NOW())
          `;

          // Update wallets
          await sql`
            UPDATE agent_wallet
            SET balance = balance - ${cost}, total_spent = total_spent + ${cost}
            WHERE agent_id = ${scenario.callerId}
          `;
          await sql`
            UPDATE agent_wallet
            SET balance = balance + ${providerEarning}, total_received = total_received + ${providerEarning}
            WHERE agent_id = ${scenario.providerId}
          `;

          totalBilled += cost;

          // Update provider stats
          await sql`
            UPDATE external_agent
            SET total_calls = total_calls + 1,
                total_earned = total_earned + ${providerEarning}
            WHERE id = ${scenario.providerId}
          `;

          // Update caller stats
          await sql`
            UPDATE external_agent
            SET total_calls = total_calls + 1
            WHERE id = ${scenario.callerId}
          `;
        } catch (billingErr) {
          errors.push(`Billing error: ${billingErr instanceof Error ? billingErr.message : 'error'}`);
        }

        scenariosRun++;
      } catch (err) {
        errors.push(`${scenario.callerName}->${scenario.providerName}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }

    // 2. Rebalance low wallets
    try {
      const lowWallets = await sql`
        SELECT agent_id, balance FROM agent_wallet
        WHERE balance <= 50
        LIMIT 5
      `;

      for (const w of lowWallets) {
        const diff = 200 - Number(w.balance);
        if (diff > 0) {
          await sql`
            UPDATE agent_wallet
            SET balance = balance + ${diff}, total_received = total_received + ${diff}
            WHERE agent_id = ${w.agent_id}
          `;
          await sql`
            INSERT INTO wallet_transaction (agent_id, type, amount, balance_after, description, timestamp)
            VALUES (${w.agent_id}, 'top_up', ${diff}, ${Number(w.balance) + diff}, 'Auto-rebalance top-up', NOW())
          `;
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
