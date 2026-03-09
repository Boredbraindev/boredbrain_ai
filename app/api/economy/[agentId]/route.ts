import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';

/**
 * GET /api/economy/[agentId] - Agent wallet + transactions + revenue share
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  try {
    const wallet = agentEconomy.getWallet(agentId);
    const revenueShare = agentEconomy.getRevenueShare(agentId);
    const contracts = agentEconomy.getContracts(agentId);

    return apiSuccess({
      wallet,
      revenueShare,
      contracts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch agent economy data';
    return apiError(message, 500);
  }
}

/**
 * POST /api/economy/[agentId] - Trigger dividend distribution
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  try {
    const result = agentEconomy.distributeDividends(agentId);

    if (!result) {
      return apiError('No pending dividends to distribute', 400);
    }

    const wallet = agentEconomy.getWallet(agentId);
    const revenueShare = agentEconomy.getRevenueShare(agentId);

    return apiSuccess({
      distribution: result,
      wallet,
      revenueShare,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to distribute dividends';
    return apiError(message, 500);
  }
}
