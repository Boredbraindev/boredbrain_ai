export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

// ─── GET /api/markets/feed?limit=30&since=<ISO> ─────────────────────
//
// Returns recent trades across ALL markets for a live activity ticker.
// Queries DB directly (no in-memory feed in Edge).

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 30), 1), 100);

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const trades = await sql`
      SELECT
        t.id,
        t.market_id,
        m.title AS market_title,
        t.buyer_address,
        t.seller_address,
        t.outcome AS side,
        t.price,
        t.shares,
        t.bbai_amount AS amount,
        t.created_at AS timestamp
      FROM betting_trade t
      INNER JOIN betting_market m ON t.market_id = m.id
      ORDER BY t.created_at DESC
      LIMIT ${limit}
    `;

    const feed = trades.map((t: any) => ({
      id: t.id,
      marketId: t.market_id,
      marketTitle: t.market_title,
      user: truncateAddress(t.buyer_address),
      userType: 'user' as const,
      side: t.side,
      amount: t.amount,
      price: t.price,
      shares: t.shares,
      timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString(),
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
