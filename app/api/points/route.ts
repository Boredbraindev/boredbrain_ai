import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { getUserPoints, awardPoints, getPointHistory, getLevelInfo, POINT_VALUES } from '@/lib/points';

// ── GET /api/points?wallet=0x... ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');

    if (!wallet) {
      return apiError('wallet query parameter is required', 400);
    }

    const points = await getUserPoints(wallet);
    const levelInfo = getLevelInfo(points.totalBp);
    const history = await getPointHistory(wallet, 20);

    return apiSuccess({
      points: {
        ...points,
        ...levelInfo,
      },
      history,
    });
  } catch (err) {
    console.error('[points] GET error:', err);
    return apiError('Failed to fetch points', 500);
  }
}

// ── POST /api/points ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { walletAddress, reason, referenceId } = parsed.data as {
      walletAddress?: string;
      reason?: string;
      referenceId?: string;
    };

    if (!walletAddress) {
      return apiError('walletAddress is required', 400);
    }

    if (!reason) {
      return apiError('reason is required', 400);
    }

    if (!(reason in POINT_VALUES)) {
      return apiError(
        `Invalid reason. Supported: ${Object.keys(POINT_VALUES).join(', ')}`,
        400,
      );
    }

    const result = await awardPoints(walletAddress, reason, referenceId);

    return apiSuccess({
      awarded: result.bp,
      newTotal: result.newTotal,
      levelUp: result.levelUp,
    });
  } catch (err) {
    console.error('[points] POST error:', err);
    return apiError('Failed to award points', 500);
  }
}
