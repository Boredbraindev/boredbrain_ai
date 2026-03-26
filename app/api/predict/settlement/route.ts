export const runtime = 'edge';
/**
 * GET  /api/predict/settlement — Get settlement stats + recent on-chain rounds
 * POST /api/predict/settlement — Settle a round on-chain (called by heartbeat cron)
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  settleRound,
  getSettlementStats,
} from '@/lib/blockchain/settlement-service';
import { verifyCron } from '@/lib/verify-cron';

// ─── GET: Settlement stats ────────────────────────────────────────────────────

export async function GET() {
  const stats = getSettlementStats();

  return apiSuccess({
    settlement: {
      chain: stats.chain,
      contractAddress: stats.contractAddress,
      isLive: stats.isLive,
      mode: stats.isLive ? 'on-chain' : 'ready',
      totalRoundsSettled: stats.totalRoundsSettled,
      totalVolumeSettled: stats.totalVolumeSettled,
    },
    rounds: stats.latestRounds,
  });
}

// ─── POST: Settle a round ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const {
      roundId,
      asset,
      startPrice,
      endPrice,
      outcome,
      upPool,
      downPool,
      totalEntries,
    } = body;

    if (!roundId || !asset || !startPrice || !endPrice || !outcome) {
      return apiError('Missing required fields: roundId, asset, startPrice, endPrice, outcome', 400);
    }

    const result = await settleRound(
      roundId,
      asset,
      startPrice,
      endPrice,
      outcome,
      upPool ?? 0,
      downPool ?? 0,
      totalEntries ?? 0,
    );

    if (!result.success) {
      return apiError(result.error || 'Settlement failed', 500);
    }

    return apiSuccess({
      settled: true,
      roundId: result.roundId,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      chain: result.chain,
      explorer: result.explorer,
      isSimulated: result.isSimulated,
    });
  } catch (err) {
    return apiError(
      'Settlement failed',
      500,
    );
  }
}
