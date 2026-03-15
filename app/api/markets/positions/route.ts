export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

// ─── GET /api/markets/positions?wallet=0x... ────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return apiError('wallet query parameter is required');
    }

    try {
      const sql = neon(process.env.DATABASE_URL!);

      const dbPromise = sql`
        SELECT * FROM betting_position
        WHERE user_address = ${wallet}
        ORDER BY updated_at DESC
      `;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      const positionRows = await Promise.race([dbPromise, timeout]);

      const positions = positionRows.map((p: any) => ({
        id: p.id,
        marketId: p.market_id,
        userAddress: p.user_address,
        outcome: p.outcome,
        shares: p.shares,
        avgPrice: p.avg_price,
        realizedPnl: p.realized_pnl,
      }));

      // Enrich positions with market info
      const enriched = await Promise.all(
        positions.map(async (pos: any) => {
          try {
            const marketRows = await sql`
              SELECT title, status, resolved_outcome, outcomes
              FROM betting_market WHERE id = ${pos.marketId} LIMIT 1
            `;
            const market = marketRows[0] ? {
              title: marketRows[0].title,
              status: marketRows[0].status,
              resolvedOutcome: marketRows[0].resolved_outcome,
              outcomes: marketRows[0].outcomes,
            } : null;

            return {
              ...pos,
              market,
              currentValue: pos.shares * pos.avgPrice,
              currency: 'BBAI',
            };
          } catch {
            return {
              ...pos,
              market: null,
              currentValue: pos.shares * pos.avgPrice,
              currency: 'BBAI',
            };
          }
        }),
      );

      // Summary
      const totalInvested = enriched.reduce(
        (sum: number, p: any) => sum + p.shares * p.avgPrice,
        0,
      );
      const totalPnl = enriched.reduce((sum: number, p: any) => sum + p.realizedPnl, 0);
      const activePositions = enriched.filter(
        (p: any) => p.shares > 0 && p.market?.status === 'open',
      );

      return apiSuccess({
        positions: enriched,
        summary: {
          totalPositions: enriched.length,
          activePositions: activePositions.length,
          totalInvested,
          totalPnl,
          currency: 'BBAI',
        },
      });
    } catch {
      // Fallback
      return apiSuccess({
        positions: [],
        summary: {
          totalPositions: 0,
          activePositions: 0,
          totalInvested: 0,
          totalPnl: 0,
          currency: 'BBAI',
        },
        _source: 'mock',
      });
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch positions', 500);
  }
}
