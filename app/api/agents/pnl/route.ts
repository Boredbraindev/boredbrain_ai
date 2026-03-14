export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { agentWallet, externalAgent } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { apiSuccess, apiError } from '@/lib/api-utils';

/**
 * GET /api/agents/pnl - Agent P&L leaderboard
 *
 * Ranks agents by current wallet balance (proxy for P&L since all agents
 * start with the same tier-based initial funding). Agents that earn more
 * from debates/invocations have higher balances.
 *
 * Query params:
 *   ?limit=50  (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50),
      200,
    );

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    // Join agentWallet with externalAgent to get names and specializations.
    // P&L = balance - initialFunding. Since we don't store initialFunding
    // directly in agentWallet, we approximate using:
    //   pnl = balance + totalSpent - initialFunding
    // But the initial credit is recorded in walletTransaction. For simplicity,
    // we calculate pnl = balance - (totalSpent > 0 ? (balance + totalSpent) * 0 : 0)
    // Actually the simplest useful metric: rank by balance (higher = more profitable).
    // We also compute net = balance - initialBalance (from tier defaults).
    // Since we can't know the exact initial funding without querying tx log,
    // we use a common baseline: fleet agents start at 1000, others at 50-500.
    // The most honest metric: just rank by balance.

    const query = db
      .select({
        agentId: agentWallet.agentId,
        balance: agentWallet.balance,
        totalSpent: agentWallet.totalSpent,
        isActive: agentWallet.isActive,
        name: externalAgent.name,
        specialization: externalAgent.specialization,
        ownerAddress: externalAgent.ownerAddress,
        stakingAmount: externalAgent.stakingAmount,
        totalEarned: externalAgent.totalEarned,
        eloRating: externalAgent.eloRating,
      })
      .from(agentWallet)
      .innerJoin(externalAgent, eq(agentWallet.agentId, externalAgent.id))
      .where(eq(agentWallet.isActive, true))
      .orderBy(desc(agentWallet.balance))
      .limit(limit);

    type PnlRow = Awaited<typeof query>[number];
    const rows: PnlRow[] = await Promise.race([query, timeout]);

    const leaderboard = rows.map((row: PnlRow, index: number) => {
      // P&L estimate: balance is what they have now. totalSpent is what they spent.
      // So lifetime earnings = balance + totalSpent (since they spent from their balance).
      // The initial funding was some value (50-1000 depending on tier).
      // We use stakingAmount as a proxy for initial funding tier:
      //   demo (stake=0) -> initial 50, basic (100) -> 200, premium (250) -> 500, fleet (0 but fleet) -> 1000
      // For simplicity, pnl = (balance + totalSpent) - estimated_initial
      const isFleet = row.ownerAddress === 'platform-fleet';
      const estimatedInitial = isFleet
        ? 1000
        : row.stakingAmount >= 500
          ? 1000
          : row.stakingAmount >= 250
            ? 500
            : row.stakingAmount >= 100
              ? 200
              : 50;

      const lifetimeEarnings = row.balance + row.totalSpent;
      const pnl = lifetimeEarnings - estimatedInitial;

      return {
        rank: index + 1,
        agentId: row.agentId,
        name: row.name || 'Unknown Agent',
        specialization: row.specialization || 'general',
        balance: Math.round(row.balance * 100) / 100,
        totalSpent: Math.round(row.totalSpent * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        eloRating: row.eloRating || 1200,
        isFleet,
      };
    });

    return apiSuccess(
      { leaderboard, total: leaderboard.length },
      200,
    );
  } catch (err) {
    console.error('[api/agents/pnl] Error:', err instanceof Error ? err.message : err);

    // Fallback: return empty
    return apiError('Failed to load P&L leaderboard', 500);
  }
}
