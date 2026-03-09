/**
 * Bridge API Route
 *
 * GET  /api/bridge                    - List supported routes and chains
 * GET  /api/bridge?txHash=0x...       - Check bridge transaction status
 * POST /api/bridge                    - Initiate a bridge transfer (returns unsigned tx)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupportedRoutes,
  getBridgeStatus,
  initiateBridge,
} from '@/lib/bridge/bridge-service';
import type { BridgeChainId, BridgeProvider } from '@/lib/bridge/config';
import { SUPPORTED_CHAINS } from '@/lib/bridge/config';

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get('txHash');
    const provider = searchParams.get('provider') as BridgeProvider | null;

    // --- Check bridge status ---
    if (txHash) {
      if (!txHash.startsWith('0x') || txHash.length < 10) {
        return NextResponse.json(
          { error: 'Invalid transaction hash format' },
          { status: 400 },
        );
      }

      const status = await getBridgeStatus(txHash, provider ?? undefined);
      return NextResponse.json({ status });
    }

    // --- List supported routes ---
    const routes = getSupportedRoutes();
    return NextResponse.json(routes);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

interface BridgeRequestBody {
  fromChain: string;
  toChain: string;
  amount: number;
  recipient: string;
  provider?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BridgeRequestBody;

    // Validate required fields
    if (!body.fromChain || !body.toChain || !body.amount || !body.recipient) {
      return NextResponse.json(
        { error: 'Missing required fields: fromChain, toChain, amount, recipient' },
        { status: 400 },
      );
    }

    // Validate chains
    const fromChain = body.fromChain.toLowerCase() as BridgeChainId;
    const toChain = body.toChain.toLowerCase() as BridgeChainId;

    if (!SUPPORTED_CHAINS.includes(fromChain)) {
      return NextResponse.json(
        { error: `Unsupported source chain: ${body.fromChain}. Supported: ${SUPPORTED_CHAINS.join(', ')}` },
        { status: 400 },
      );
    }

    if (!SUPPORTED_CHAINS.includes(toChain)) {
      return NextResponse.json(
        { error: `Unsupported destination chain: ${body.toChain}. Supported: ${SUPPORTED_CHAINS.join(', ')}` },
        { status: 400 },
      );
    }

    if (fromChain === toChain) {
      return NextResponse.json(
        { error: 'Source and destination chains must be different' },
        { status: 400 },
      );
    }

    // Validate amount
    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 },
      );
    }

    // Validate recipient
    if (!body.recipient.startsWith('0x') || body.recipient.length !== 42) {
      return NextResponse.json(
        { error: 'Invalid recipient address' },
        { status: 400 },
      );
    }

    // Validate provider if specified
    const provider = body.provider?.toLowerCase() as BridgeProvider | undefined;
    if (provider && provider !== 'layerzero' && provider !== 'wormhole') {
      return NextResponse.json(
        { error: 'Invalid provider. Supported: layerzero, wormhole' },
        { status: 400 },
      );
    }

    const result = await initiateBridge(
      fromChain,
      toChain,
      body.amount,
      body.recipient,
      provider,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Bridge initiation failed', result },
        { status: 422 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
