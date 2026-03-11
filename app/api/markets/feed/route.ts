import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { bettingTrade, bettingMarket } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getFeed, getFeedSize } from '@/lib/betting/feed-store';

export const dynamic = 'force-dynamic';

// ─── GET /api/markets/feed?limit=30&since=<ISO> ─────────────────────
//
// Returns recent trades across ALL markets for a live activity ticker.
// Tries the in-memory feed-store first (fast, zero DB cost).
// Falls back to a DB query when the buffer is empty (cold start).

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 30), 1), 100);
  const since = searchParams.get('since') || undefined;

  try {
    // ── Fast path: in-memory feed ────────────────────────────────
    if (getFeedSize() > 0) {
      const entries = getFeed(limit, since);
      return apiSuccess({
        feed: entries,
        count: entries.length,
        source: 'memory',
      });
    }

    // ── Cold-start path: query DB ────────────────────────────────
    const trades = await db
      .select({
        id: bettingTrade.id,
        marketId: bettingTrade.marketId,
        marketTitle: bettingMarket.title,
        buyerAddress: bettingTrade.buyerAddress,
        sellerAddress: bettingTrade.sellerAddress,
        side: bettingTrade.outcome,
        price: bettingTrade.price,
        shares: bettingTrade.shares,
        amount: bettingTrade.bbaiAmount,
        timestamp: bettingTrade.createdAt,
      })
      .from(bettingTrade)
      .innerJoin(bettingMarket, eq(bettingTrade.marketId, bettingMarket.id))
      .orderBy(desc(bettingTrade.createdAt))
      .limit(limit);

    const feed = trades.map((t: typeof trades[number]) => ({
      id: t.id,
      marketId: t.marketId,
      marketTitle: t.marketTitle,
      user: truncateAddress(t.buyerAddress),
      userType: 'user' as const,
      side: t.side,
      amount: t.amount,
      price: t.price,
      shares: t.shares,
      timestamp: t.timestamp?.toISOString() ?? new Date().toISOString(),
    }));

    return apiSuccess({
      feed,
      count: feed.length,
      source: 'db',
    });
  } catch (err) {
    console.error('[markets/feed] Error:', err);
    return apiError('Failed to fetch activity feed', 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
