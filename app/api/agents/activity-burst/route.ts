export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Activity Burst — The MAIN driver of platform activity.
 *
 * Designed to be called from the dev server crontab (no limits) every 5 minutes.
 * Also works as a manual trigger via API. Replaces reliance on Vercel cron
 * (which only runs ONCE PER DAY on Hobby plan).
 *
 * One call does ALL of:
 *   1. Run 5 agent-to-agent scenarios (billing + wallet)
 *   2. Generate 10 debate participations (inline, no HTTP fetch)
 *   3. Collect new topics if cache is stale (> 1 hour)
 *   4. Close expired debates (score + settle)
 *   5. Run settlement check for prediction markets
 *
 * Includes concurrency lock to prevent overlapping executions.
 *
 * GET /api/agents/activity-burst?secret=XXX
 */

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyCron } from '@/lib/verify-cron';
import { generateScenarios } from '@/lib/agent-scheduler';
import { executeAgent, AgentConfig } from '@/lib/agent-executor';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getFleetBscAddressCached } from '@/lib/blockchain/fleet-wallets';
import {
  autoParticipateInDebates,
  closeExpiredDebates,
  createTopicDebate,
} from '@/lib/topic-debate';
import { getHotTopics } from '@/lib/polymarket-feed';

// ---------------------------------------------------------------------------
// Inline wallet/billing helpers (raw SQL, no Drizzle — same as heartbeat)
// ---------------------------------------------------------------------------

function genId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

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
    INSERT INTO agent_wallet (id, agent_id, address, balance, daily_limit, total_spent, is_active)
    VALUES (${genId()}, ${agentId}, ${address}, ${initialBalance}, ${dailyLimit}, 0, true)
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

  if (!(await getAgentWalletEdge(sql, callerAgentId))) {
    await createAgentWalletEdge(sql, callerAgentId);
  }
  if (!(await getAgentWalletEdge(sql, providerAgentId))) {
    await createAgentWalletEdge(sql, providerAgentId);
  }

  const costInt = Math.round(totalCost);
  const feeInt = Math.round(platformFee);
  const earnInt = Math.round(providerEarning);

  const callerWallet = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${callerAgentId} LIMIT 1`;
  let deductSuccess = false;
  if (callerWallet.length > 0 && Number(callerWallet[0].balance) >= costInt) {
    const newBalance = Math.round(Number(callerWallet[0].balance) - costInt);
    const updated = await sql`
      UPDATE agent_wallet SET balance = ${newBalance}, total_spent = total_spent + ${costInt}
      WHERE agent_id = ${callerAgentId} AND balance >= ${costInt}
      RETURNING *
    `;
    if (updated.length > 0) {
      deductSuccess = true;
      await sql`
        INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
        VALUES (${genId()}, ${callerAgentId}, ${costInt}, 'debit', ${'Inter-agent billing: called ' + providerAgentId + ' using [' + toolsUsed.join(', ') + ']'}, ${newBalance})
      `;
    }
  }

  if (!deductSuccess) {
    await sql`
      INSERT INTO billing_record (id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
      VALUES (${genId()}, ${callerAgentId}, ${providerAgentId}, ${JSON.stringify(toolsUsed)}, ${costInt}, ${feeInt}, ${earnInt}, 'failed')
    `;
    return {
      success: false,
      breakdown: { totalCost: costInt, platformFee: feeInt, providerEarning: earnInt },
    };
  }

  const providerWallet = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${providerAgentId} LIMIT 1`;
  if (providerWallet.length > 0) {
    const newBalance = Math.round(Number(providerWallet[0].balance) + earnInt);
    await sql`UPDATE agent_wallet SET balance = ${newBalance} WHERE agent_id = ${providerAgentId}`;
    await sql`
      INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
      VALUES (${genId()}, ${providerAgentId}, ${earnInt}, 'credit', 'Provider earning', ${newBalance})
    `;
  }

  await sql`
    INSERT INTO billing_record (id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
    VALUES (${genId()}, ${callerAgentId}, ${providerAgentId}, ${JSON.stringify(toolsUsed)}, ${costInt}, ${feeInt}, ${earnInt}, 'completed')
  `;

  return {
    success: true,
    breakdown: { totalCost, platformFee, providerEarning },
  };
}

// ---------------------------------------------------------------------------
// Concurrency lock via DB (prevents overlapping bursts)
// ---------------------------------------------------------------------------

const LOCK_KEY = 'activity-burst';
const LOCK_TIMEOUT_MS = 120_000; // 120 seconds stale lock protection

async function acquireLock(sql: any): Promise<boolean> {
  try {
    // Try to read existing lock
    const rows = await sql`
      SELECT locked_at FROM platform_lock WHERE lock_key = ${LOCK_KEY} LIMIT 1
    `;

    if (rows.length > 0) {
      const lockedAt = new Date(rows[0].locked_at).getTime();
      const now = Date.now();
      if (now - lockedAt < LOCK_TIMEOUT_MS) {
        // Lock is still valid — another burst is running
        return false;
      }
      // Stale lock — overwrite it
      await sql`
        UPDATE platform_lock SET locked_at = NOW() WHERE lock_key = ${LOCK_KEY}
      `;
      return true;
    }

    // No lock exists — create it
    await sql`
      INSERT INTO platform_lock (lock_key, locked_at)
      VALUES (${LOCK_KEY}, NOW())
    `;
    return true;
  } catch {
    // Table may not exist yet — try to create it, then acquire
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS platform_lock (
          lock_key TEXT PRIMARY KEY,
          locked_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        INSERT INTO platform_lock (lock_key, locked_at)
        VALUES (${LOCK_KEY}, NOW())
        ON CONFLICT (lock_key) DO UPDATE SET locked_at = NOW()
      `;
      return true;
    } catch {
      // If we still can't create the table, proceed without lock
      return true;
    }
  }
}

async function releaseLock(sql: any): Promise<void> {
  try {
    await sql`DELETE FROM platform_lock WHERE lock_key = ${LOCK_KEY}`;
  } catch {
    // Non-critical
  }
}

// Auth: imported from shared verifyCron (lib/verify-cron.ts)

// ---------------------------------------------------------------------------
// GET /api/agents/activity-burst
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  const startTime = Date.now();
  const sql = neon(process.env.DATABASE_URL!);

  // ── Concurrency lock ───────────────────────────────────────────────────
  const acquired = await acquireLock(sql);
  if (!acquired) {
    return apiSuccess({
      skipped: true,
      reason: 'Another activity-burst is still running (lock held < 120s)',
    });
  }

  const errors: string[] = [];
  let scenariosRun = 0;
  let totalBilled = 0;
  let participations = 0;
  let topicsCollected = 0;
  let debatesClosed = 0;
  let settlementRun = false;
  let rebalanced = 0;

  try {
    // ── Phase 1: Run 5 agent-to-agent scenarios ─────────────────────────
    try {
      const scenarios = await generateScenarios(5);

      for (const scenario of scenarios) {
        // Time guard: stop if we've used > 45 seconds
        if (Date.now() - startTime > 45_000) {
          errors.push('Time limit reached during scenarios');
          break;
        }

        try {
          if (!(await getAgentWalletEdge(sql, scenario.callerId))) {
            await createAgentWalletEdge(sql, scenario.callerId);
          }
          if (!(await getAgentWalletEdge(sql, scenario.providerId))) {
            await createAgentWalletEdge(sql, scenario.providerId);
          }

          const agentConfig: AgentConfig = {
            id: scenario.providerId,
            name: scenario.providerName,
            description: `Autonomous agent responding to a call from ${scenario.callerName}`,
            preferredProvider: 'google',
            preferredModel: 'gemini-2.0-flash',
          };

          const result = await executeAgent(
            agentConfig,
            scenario.query,
            `Inter-agent call from ${scenario.callerName} (${scenario.callerId})`,
          );

          const cost = Math.max(0.5, Number((result.tokensUsed * 0.0001).toFixed(4)));

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

          const earning = Math.round(billing.breakdown.providerEarning);
          await sql`
            UPDATE external_agent
            SET total_calls = total_calls + 1, total_earned = total_earned + ${earning}
            WHERE id = ${scenario.providerId}
          `;
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scenario generation error';
      errors.push(`Scenarios: ${msg}`);
    }

    // ── Phase 2: 10 debate participations (inline, no HTTP fetch) ───────
    try {
      // Time guard
      if (Date.now() - startTime < 50_000) {
        const result = await autoParticipateInDebates(10);
        participations = result.participated;
        if (result.errors.length > 0) {
          errors.push(...result.errors.slice(0, 3));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Participate error';
      errors.push(`Participate: ${msg}`);
    }

    // ── Phase 3: Collect new topics if stale (> 1 hour since last) ──────
    try {
      if (Date.now() - startTime < 52_000) {
        // Check last collection time
        let shouldCollect = false;
        try {
          const lastCollected = await sql`
            SELECT created_at FROM topic_debate
            ORDER BY created_at DESC LIMIT 1
          `;
          if (lastCollected.length === 0) {
            shouldCollect = true;
          } else {
            const lastTime = new Date(lastCollected[0].created_at).getTime();
            shouldCollect = Date.now() - lastTime > 60 * 60 * 1000; // > 1 hour
          }
        } catch {
          shouldCollect = true;
        }

        if (shouldCollect) {
          try {
            const hotTopics = await getHotTopics(10);
            for (const topic of hotTopics) {
              try {
                // Skip duplicates via slug check
                let alreadyExists = false;
                if (topic.slug) {
                  try {
                    const slugCheck = await sql`
                      SELECT id FROM topic_debate
                      WHERE polymarket_slug = ${topic.slug}
                      LIMIT 1
                    `;
                    if (slugCheck.length > 0) alreadyExists = true;
                  } catch {}
                }
                if (!alreadyExists) {
                  await createTopicDebate(
                    topic.title,
                    topic.category.toLowerCase(),
                    topic.id,
                    topic.imageUrl,
                    topic.outcomesWithPrices,
                    topic.slug,
                    topic.endDate || undefined,
                    'polymarket',
                  );
                  topicsCollected++;
                }
              } catch {
                // Skip individual topic errors
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Topic collection error';
            errors.push(`Collect: ${msg}`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Collect phase error';
      errors.push(`Collect: ${msg}`);
    }

    // ── Phase 4: Close expired debates ──────────────────────────────────
    try {
      if (Date.now() - startTime < 55_000) {
        const closeResult = await closeExpiredDebates();
        debatesClosed = closeResult.closed;
        if (closeResult.errors.length > 0) {
          errors.push(...closeResult.errors.slice(0, 3));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Close debates error';
      errors.push(`Close: ${msg}`);
    }

    // ── Phase 5: Settlement check ───────────────────────────────────────
    try {
      if (Date.now() - startTime < 57_000) {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://boredbrain.app';
        const secret = process.env.CRON_SECRET;

        // Settlement for prediction markets
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

        try {
          const settleRes = await fetch(`${baseUrl}/api/predict/settlement`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
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
          settlementRun = settleRes.ok;
        } catch {
          // Non-critical
        }

        // Also settle topic debates linked to Polymarket
        try {
          await fetch(`${baseUrl}/api/topics/settle`, {
            method: 'POST',
            headers: secret ? { Authorization: `Bearer ${secret}` } : {},
          });
        } catch {
          // Non-critical
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Settlement error';
      errors.push(`Settlement: ${msg}`);
    }

    // ── Phase 6: Rebalance low-balance wallets ──────────────────────────
    try {
      if (Date.now() - startTime < 58_000) {
        const candidates = await sql`
          SELECT w.agent_id as "agentId", COALESCE(a.name, w.agent_id) as name, w.balance
          FROM agent_wallet w
          LEFT JOIN external_agent a ON a.id = w.agent_id
          WHERE w.balance < 20
          ORDER BY w.balance ASC
          LIMIT 10
        `;

        for (const candidate of candidates as any[]) {
          try {
            const topUpAmount = 20 - Number(candidate.balance);
            if (topUpAmount > 0) {
              const wallets = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${candidate.agentId} LIMIT 1`;
              if (wallets.length > 0) {
                const newBalance = Math.round(Number(wallets[0].balance) + Math.round(topUpAmount));
                await sql`UPDATE agent_wallet SET balance = ${newBalance} WHERE agent_id = ${candidate.agentId}`;
                await sql`
                  INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
                  VALUES (${genId()}, ${candidate.agentId}, ${Math.round(topUpAmount)}, 'credit', 'Auto-rebalance', ${newBalance})
                `;
                rebalanced++;
              }
            }
          } catch {
            // Non-critical
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rebalance error';
      errors.push(`Rebalance: ${msg}`);
    }
  } finally {
    // Always release lock
    await releaseLock(sql);
  }

  const elapsed = Date.now() - startTime;

  return apiSuccess({
    burst: {
      scenariosRun,
      totalBilled: Number(totalBilled.toFixed(4)),
      participations,
      topicsCollected,
      debatesClosed,
      settlementRun,
      rebalanced,
    },
    timing: {
      elapsedMs: elapsed,
      elapsedSec: Number((elapsed / 1000).toFixed(1)),
    },
    errors: errors.length > 0 ? errors : undefined,
    scaleReadiness: {
      dbConnections: 'Neon serverless (auto-scale)',
      cronReliability: 'dev-server crontab (no limits)',
      agentCapacity: '190 fleet + user agents',
      bottlenecks: [
        'Vercel 60s timeout per function',
        'Neon free tier connection limit',
      ],
      recommendations: [
        'Upgrade to Vercel Pro for 300s timeout',
        'Add QStash for reliable cron',
      ],
    },
    devServerCrontab: {
      description: 'Copy these lines to the dev server crontab (crontab -e on your server)',
      lines: [
        '# Activity burst — main driver (every 5 min)',
        '*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "https://boredbrain.app/api/agents/activity-burst" >> /tmp/bbai-activity.log 2>&1',
        '',
        '# Debate participation — lightweight, fast (every 2 min)',
        '*/2 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" "https://boredbrain.app/api/topics/participate" >> /tmp/bbai-participate.log 2>&1',
        '',
        '# Topic collection — hourly refresh from Polymarket/Kalshi',
        '0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" "https://boredbrain.app/api/topics/collect" >> /tmp/bbai-collect.log 2>&1',
      ],
    },
  });
}
