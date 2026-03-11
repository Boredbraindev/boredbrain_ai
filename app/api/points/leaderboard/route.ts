import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getLeaderboard, getLevelInfo } from '@/lib/points';

// ── GET /api/points/leaderboard?limit=50&season=1 ────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const seasonParam = request.nextUrl.searchParams.get('season');

    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200);
    const season = parseInt(seasonParam || '1', 10) || 1;

    const leaderboard = await getLeaderboard(limit, season);

    const enriched = leaderboard.map((entry, index) => {
      const levelInfo = getLevelInfo(entry.totalBp);
      return {
        rank: index + 1,
        walletAddress: entry.walletAddress,
        totalBp: entry.totalBp,
        level: levelInfo.level,
        title: levelInfo.title,
      };
    });

    return apiSuccess({
      leaderboard: enriched,
      season,
      total: enriched.length,
    });
  } catch (err) {
    console.error('[points/leaderboard] GET error:', err);
    return apiError('Failed to fetch leaderboard', 500);
  }
}
