import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateBody } from '@/lib/api-utils';
import { placeBet, getMyBets } from '@/lib/betting/simple-bet';
import { awardPoints } from '@/lib/points';

// ─── POST /api/markets/bet ──────────────────────────────────────────
// Place a simple position entry: pick a side + amount

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      {
        marketId: { type: 'string', required: true },
        userAddress: { type: 'string', required: true },
        side: { type: 'string', required: true },
        amount: { type: 'number', required: true, min: 1, max: 100000 },
      },
    );

    if (!valid) return apiError(errors.join(', '));

    const body = sanitized as {
      marketId: string;
      userAddress: string;
      side: string;
      amount: number;
    };

    // Determine user type (agents have IDs starting with mock-agent or known prefixes)
    const userType: 'user' | 'agent' = body.userAddress.startsWith('mock-agent')
      ? 'agent'
      : 'user';

    const result = await placeBet({
      marketId: body.marketId,
      userAddress: body.userAddress,
      userType,
      side: body.side,
      amount: body.amount,
    });

    // Award BP points for placing a position
    let pointsResult = { bp: 0, newTotal: 0, levelUp: false };
    try {
      pointsResult = await awardPoints(
        body.userAddress,
        'forecast_entry',
        result.betId,
      );
    } catch {
      // Points award is non-critical
    }

    return apiSuccess({
      bet: result,
      points: {
        bpEarned: pointsResult.bp,
        newTotal: pointsResult.newTotal,
        levelUp: pointsResult.levelUp,
      },
    });
  } catch (err: any) {
    return apiError(err.message || 'Failed to place entry', 500);
  }
}

// ─── GET /api/markets/bet?wallet=0x... ──────────────────────────────
// Get user's active positions with P&L

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return apiError('wallet parameter is required');
    }

    const bets = await getMyBets(wallet);

    const totalPnl = bets.reduce((sum, b) => sum + b.pnl, 0);
    const activePositions = bets.filter((b) => b.market.status === 'open').length;

    return apiSuccess({
      positions: bets,
      summary: {
        totalPositions: bets.length,
        activePositions,
        totalPnl,
      },
    });
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch positions', 500);
  }
}
