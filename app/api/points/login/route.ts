export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { checkDailyLogin, getUserPoints, getLevelInfo } from '@/lib/points';

// ── POST /api/points/login ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { walletAddress } = parsed.data as { walletAddress?: string };

    if (!walletAddress) {
      return apiError('walletAddress is required', 400);
    }

    const loginResult = await checkDailyLogin(walletAddress);
    const points = await getUserPoints(walletAddress);
    const levelInfo = getLevelInfo(points.totalBp);

    return apiSuccess({
      login: {
        awarded: loginResult.awarded,
        streakDays: loginResult.streakDays,
        bonusBp: loginResult.bonusBp,
      },
      points: {
        totalBp: points.totalBp,
        level: levelInfo.level,
        title: levelInfo.title,
        nextLevel: levelInfo.nextLevel,
        nextLevelBp: levelInfo.nextLevelBp,
        progress: levelInfo.progress,
        rank: points.rank,
      },
    });
  } catch (err) {
    console.error('[points/login] POST error:', err);
    return apiError('Failed to process daily login', 500);
  }
}
