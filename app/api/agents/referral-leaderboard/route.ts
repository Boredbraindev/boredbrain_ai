import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getReferralLeaderboard } from '@/lib/agent-referral';

/**
 * GET /api/agents/referral-leaderboard
 *
 * Get top recruiters by total referral earnings.
 *
 * Query params:
 *   ?limit=20  — number of results (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);

    const leaderboard = await getReferralLeaderboard(limit);

    return apiSuccess({ leaderboard, count: leaderboard.length });
  } catch (error: any) {
    console.error('[referral-leaderboard] Error:', error.message);
    return apiError('Failed to get referral leaderboard', 500);
  }
}
