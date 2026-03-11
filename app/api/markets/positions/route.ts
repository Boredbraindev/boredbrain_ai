import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getUserPositions } from '@/lib/betting/matching-engine';
import { db } from '@/lib/db';
import { bettingPosition, bettingMarket } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// ─── GET /api/markets/positions?wallet=0x... ────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return apiError('wallet query parameter is required');
    }

    try {
      const dbPromise = getUserPositions(wallet);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      const positions = await Promise.race([dbPromise, timeout]);

      // Enrich positions with market info
      const enriched = await Promise.all(
        positions.map(async (pos) => {
          try {
            const [market] = await db
              .select({
                title: bettingMarket.title,
                status: bettingMarket.status,
                resolvedOutcome: bettingMarket.resolvedOutcome,
                outcomes: bettingMarket.outcomes,
              })
              .from(bettingMarket)
              .where(eq(bettingMarket.id, pos.marketId))
              .limit(1);

            return {
              ...pos,
              market: market || null,
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
        (sum, p) => sum + p.shares * p.avgPrice,
        0,
      );
      const totalPnl = enriched.reduce((sum, p) => sum + p.realizedPnl, 0);
      const activePositions = enriched.filter(
        (p) => p.shares > 0 && p.market?.status === 'open',
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
