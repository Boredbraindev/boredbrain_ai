export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getAllWallets, getAgentWallet } from '@/lib/agent-wallet';
import { apiError } from '@/lib/api-utils';

/**
 * GET /api/agent-wallet - List all agent wallets or get a specific one.
 *
 * Query params:
 *   ?agentId=xxx  - return a single wallet
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (agentId) {
      const wallet = await getAgentWallet(agentId);
      if (!wallet) {
        return NextResponse.json(
          { error: `Wallet not found for agent: ${agentId}` },
          { status: 404 },
        );
      }
      return NextResponse.json({ wallet });
    }

    const wallets = await getAllWallets();
    return NextResponse.json({
      wallets,
      total: wallets.length,
    });
  } catch (error) {
    console.error('[agent-wallet] GET error:', error);
    return apiError('Failed to fetch agent wallets', 500);
  }
}
