export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/agents/pnl - Agent P&L leaderboard
 *
 * Ranks agents by current wallet balance (proxy for P&L since all agents
 * start with the same tier-based initial funding).
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

    const sql = neon(process.env.DATABASE_URL!);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const rows = await Promise.race([
      sql`
        SELECT
          aw.agent_id,
          aw.balance,
          aw.total_spent,
          aw.is_active,
          ea.name,
          ea.specialization,
          ea.owner_address,
          ea.staking_amount,
          ea.total_earned,
          ea.elo_rating
        FROM agent_wallet aw
        INNER JOIN external_agent ea ON aw.agent_id = ea.id
        WHERE aw.is_active = true
        ORDER BY aw.balance DESC
        LIMIT ${limit}
      `,
      timeout,
    ]);

    const leaderboard = rows.map((row: any, index: number) => {
      const isFleet = row.owner_address === 'platform-fleet';
      // Fleet agents start with 50 BBAI (from createAgentWalletEdge initialBalance=50)
      const estimatedInitial = isFleet ? 50 : 50;

      const balance = Number(row.balance);
      const totalSpent = Number(row.total_spent);
      const totalEarned = Number(row.total_earned ?? 0);
      // P&L = total_earned from inter-agent billing (real revenue)
      const pnl = totalEarned > 0 ? totalEarned - totalSpent : balance - estimatedInitial;

      return {
        rank: index + 1,
        agentId: row.agent_id,
        name: row.name || 'Unknown Agent',
        specialization: row.specialization || 'general',
        balance: Math.round(balance * 100) / 100,
        totalSpent: Math.round(totalSpent * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        eloRating: Number(row.elo_rating) || 1200,
        isFleet,
      };
    });

    return apiSuccess(
      { leaderboard, total: leaderboard.length },
      200,
    );
  } catch (err) {
    console.error('[api/agents/pnl] Error:', err instanceof Error ? err.message : err);
    return apiError('Failed to load P&L leaderboard', 500);
  }
}
