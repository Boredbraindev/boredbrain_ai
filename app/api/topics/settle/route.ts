export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * POST /api/topics/settle — Auto-settle completed debates.
 *
 * For debates linked to Polymarket: checks if the Polymarket event has resolved,
 * then distributes the prize pool to agents who picked the winning side.
 *
 * For debates without Polymarket link: uses LLM scoring (existing system).
 *
 * Called by heartbeat cron or manually.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { serverEnv } from '@/env/server';
import { db } from '@/lib/db';
import { topicDebate, debateOpinion, debateStake } from '@/lib/db/schema';
import { eq, sql, and, isNotNull } from 'drizzle-orm';
import { topUpWallet, getAgentWallet, createAgentWallet } from '@/lib/agent-wallet';
import { awardPoints } from '@/lib/points';

const GAMMA_API = 'https://gamma-api.polymarket.com';

function verifyCron(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  if (request.headers.get('x-vercel-cron') === '1') return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }
  return false;
}

/**
 * Check Polymarket event resolution status.
 * Returns the winning outcome string or null if not yet resolved.
 */
async function checkPolymarketResolution(eventId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GAMMA_API}/events/${eventId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const event = await res.json();
    // Check if event is closed/resolved
    if (!event.closed && event.active !== false) return null;

    const markets = event.markets ?? [];
    if (markets.length === 0) return null;

    // Binary market: check which outcome won
    if (markets.length === 1) {
      const m = markets[0];
      if (m.resolved) {
        // outcomePrices after resolution: winner = "1.0", loser = "0.0"
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices;
        if (Array.isArray(prices)) {
          const yesPrice = parseFloat(prices[0]);
          return yesPrice > 0.5 ? 'Yes' : 'No';
        }
      }
      return null;
    }

    // Multi-outcome: find the resolved winner
    for (const m of markets) {
      if (m.resolved) {
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices;
        if (Array.isArray(prices) && parseFloat(prices[0]) > 0.9) {
          return m.groupItemTitle ?? m.question ?? 'Yes';
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Map Polymarket outcome to debate position.
 * "Yes" → "for", "No" → "against"
 */
function outcomeToPosition(outcome: string): 'for' | 'against' | 'neutral' {
  const lower = outcome.toLowerCase();
  if (lower === 'yes' || lower === 'true') return 'for';
  if (lower === 'no' || lower === 'false') return 'against';
  return 'neutral';
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  try {
    // Find debates that are completed/scoring AND have a Polymarket link but no resolved outcome yet
    const unsettledDebates = await db
      .select()
      .from(topicDebate)
      .where(
        and(
          isNotNull(topicDebate.polymarketEventId),
          sql`${topicDebate.resolvedOutcome} IS NULL`,
          sql`${topicDebate.status} IN ('open', 'scoring', 'completed')`,
        ),
      )
      .limit(10);

    let settled = 0;
    const results: { debateId: string; topic: string; outcome: string; winnersCount: number; poolDistributed: number; stakesSettled?: number }[] = [];

    for (const debate of unsettledDebates) {
      if (!debate.polymarketEventId) continue;

      const outcome = await checkPolymarketResolution(debate.polymarketEventId);
      if (!outcome) continue; // Not yet resolved on Polymarket

      // Get all opinions for this debate
      const opinions = await db
        .select()
        .from(debateOpinion)
        .where(eq(debateOpinion.debateId, debate.id));

      if (opinions.length === 0) continue;

      // Determine winning position
      const winningPosition = outcomeToPosition(outcome);

      // Find winners (agents who picked the right side)
      const winners = opinions.filter((o) => o.position === winningPosition);
      const losers = opinions.filter((o) => o.position !== winningPosition);

      // Calculate pool: totalPool from debate, or participation count * 2 BBAI
      const pool = debate.totalPool ?? (opinions.length * 2);

      // Distribute pool to winners
      let distributed = 0;
      if (winners.length > 0) {
        const sharePerWinner = Math.floor(pool / winners.length);

        for (const winner of winners) {
          try {
            // Ensure wallet exists
            let wallet = await getAgentWallet(winner.agentId);
            if (!wallet) {
              wallet = await createAgentWallet(winner.agentId, 500, 0);
            }
            await topUpWallet(winner.agentId, sharePerWinner);
            distributed += sharePerWinner;

            // Award bonus BP
            await awardPoints(
              winner.agentId,
              'arena_stake_win',
              debate.id,
              sharePerWinner,
            );
          } catch {
            // Non-critical, continue with other winners
          }
        }
      }

      // ── Settle user stakes ──────────────────────────────────────────
      // Winners = users who staked on the #1 agent (top scorer or winning side)
      let stakesSettled = 0;
      try {
        const allStakes = await db
          .select()
          .from(debateStake)
          .where(and(
            eq(debateStake.debateId, debate.id),
            eq(debateStake.status, 'active'),
          ));

        if (allStakes.length > 0) {
          // Determine winning agents: those on the winning position
          const winnerAgentIds = new Set(winners.map(w => w.agentId));
          const totalStakePool = allStakes.reduce((sum, s) => sum + s.amount, 0);
          const winningStakes = allStakes.filter(s => winnerAgentIds.has(s.agentId));
          const losingStakes = allStakes.filter(s => !winnerAgentIds.has(s.agentId));

          const winningTotal = winningStakes.reduce((sum, s) => sum + s.amount, 0);

          // Distribute pool to winning stakers proportionally
          for (const stake of winningStakes) {
            const share = winningTotal > 0
              ? Math.floor((stake.amount / winningTotal) * totalStakePool)
              : stake.amount; // refund if no total
            try {
              await awardPoints(stake.walletAddress, 'arena_stake_win', debate.id, share);
              await db
                .update(debateStake)
                .set({ status: 'won', payout: share, settledAt: new Date() })
                .where(eq(debateStake.id, stake.id));
              stakesSettled++;
            } catch {
              // Non-critical
            }
          }

          // Mark losing stakes
          for (const stake of losingStakes) {
            try {
              await db
                .update(debateStake)
                .set({ status: 'lost', payout: 0, settledAt: new Date() })
                .where(eq(debateStake.id, stake.id));
            } catch {
              // Non-critical
            }
          }
        }
      } catch {
        // Stake settlement non-critical
      }

      // Update debate record
      await db
        .update(topicDebate)
        .set({
          resolvedOutcome: outcome,
          status: 'completed',
        })
        .where(eq(topicDebate.id, debate.id));

      settled++;
      results.push({
        debateId: debate.id,
        topic: debate.topic.slice(0, 60),
        outcome,
        winnersCount: winners.length,
        poolDistributed: distributed,
        stakesSettled,
      });
    }

    return apiSuccess({
      settled,
      checked: unsettledDebates.length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(`Settlement failed: ${msg}`, 500);
  }
}
