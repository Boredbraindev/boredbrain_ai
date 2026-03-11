import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getHotMarkets } from '@/lib/betting/simple-bet';

// ─── GET /api/markets/hot?limit=10 ─────────────────────────────────
// Returns hot markets with probability, volume, participants

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 10), 50);

    const markets = await getHotMarkets(limit);

    return apiSuccess({
      markets,
      total: markets.length,
    });
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch hot markets', 500);
  }
}
