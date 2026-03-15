export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSmartWallets,
  getSmartWallet,
  createSmartWallet,
} from '@/lib/account-abstraction';

/**
 * GET /api/wallets/smart - List all smart wallets or get a specific one.
 *
 * Query params:
 *   ?agentId=xxx  - return a single smart wallet
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (agentId) {
    const wallet = await getSmartWallet(agentId);
    if (!wallet) {
      return NextResponse.json(
        { error: `Smart wallet not found for agent: ${agentId}` },
        { status: 404 },
      );
    }
    return NextResponse.json({ wallet });
  }

  const wallets = await getAllSmartWallets();
  return NextResponse.json({
    wallets,
    total: wallets.length,
  });
}

/**
 * POST /api/wallets/smart - Create a new smart wallet.
 *
 * Body:
 *   {
 *     agentId: string,
 *     ownerAddress: string,
 *     chain: string,
 *     dailyLimit?: number,
 *     perTxLimit?: number,
 *   }
 */
export async function POST(request: NextRequest) {
  let body: {
    agentId: string;
    ownerAddress: string;
    chain: string;
    dailyLimit?: number;
    perTxLimit?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.agentId || !body.ownerAddress || !body.chain) {
    return NextResponse.json(
      { error: 'agentId, ownerAddress, and chain are required' },
      { status: 400 },
    );
  }

  const existing = await getSmartWallet(body.agentId);
  if (existing) {
    return NextResponse.json({
      wallet: existing,
      created: false,
      message: 'Smart wallet already exists for this agent',
    });
  }

  const wallet = await createSmartWallet(
    body.agentId,
    body.ownerAddress,
    body.chain,
    body.dailyLimit,
    body.perTxLimit,
  );

  return NextResponse.json({
    wallet,
    created: true,
  });
}
