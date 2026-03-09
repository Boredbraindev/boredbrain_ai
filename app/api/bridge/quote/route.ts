/**
 * Bridge Quote API Route
 *
 * GET /api/bridge/quote?from=base&to=bsc&amount=1000
 * GET /api/bridge/quote?from=base&to=bsc&amount=1000&provider=wormhole
 *
 * Returns a fee breakdown and estimated time for bridging BBAI tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBridgeQuote } from '@/lib/bridge/bridge-service';
import type { BridgeChainId, BridgeProvider } from '@/lib/bridge/config';
import { SUPPORTED_CHAINS } from '@/lib/bridge/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from')?.toLowerCase() as BridgeChainId | undefined;
    const to = searchParams.get('to')?.toLowerCase() as BridgeChainId | undefined;
    const amountStr = searchParams.get('amount');
    const provider = searchParams.get('provider')?.toLowerCase() as BridgeProvider | undefined;

    // Validate required params
    if (!from || !to || !amountStr) {
      return NextResponse.json(
        {
          error: 'Missing required query parameters: from, to, amount',
          example: '/api/bridge/quote?from=base&to=bsc&amount=1000',
        },
        { status: 400 },
      );
    }

    // Validate chains
    if (!SUPPORTED_CHAINS.includes(from)) {
      return NextResponse.json(
        { error: `Unsupported source chain: ${from}. Supported: ${SUPPORTED_CHAINS.join(', ')}` },
        { status: 400 },
      );
    }

    if (!SUPPORTED_CHAINS.includes(to)) {
      return NextResponse.json(
        { error: `Unsupported destination chain: ${to}. Supported: ${SUPPORTED_CHAINS.join(', ')}` },
        { status: 400 },
      );
    }

    if (from === to) {
      return NextResponse.json(
        { error: 'Source and destination chains must be different' },
        { status: 400 },
      );
    }

    // Validate amount
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 },
      );
    }

    // Validate provider if specified
    if (provider && provider !== 'layerzero' && provider !== 'wormhole') {
      return NextResponse.json(
        { error: 'Invalid provider. Supported: layerzero, wormhole' },
        { status: 400 },
      );
    }

    const quote = await getBridgeQuote(from, to, amount, provider);

    return NextResponse.json({
      quote,
      summary: {
        send: `${amount} BBAI on ${from}`,
        receive: `${quote.receiveAmount.toFixed(4)} BBAI on ${to}`,
        fees: {
          platform: `${quote.platformFee.toFixed(4)} BBAI (0.1%)`,
          protocol: `${quote.protocolFee.toFixed(4)} BBAI`,
          gas: `~$${quote.bridgeGasCostUsd.toFixed(2)} USD`,
          total: `${quote.totalFee.toFixed(4)} BBAI + gas`,
        },
        estimatedTime: `~${quote.estimatedTimeMinutes} minutes`,
        provider: quote.provider,
        simulated: quote.isSimulated,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('No bridge route') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
