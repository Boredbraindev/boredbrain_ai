export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { checkNftHoldings } from '@/lib/nft-checker';

/**
 * GET /api/wallets/nft-check?address=0x...
 *
 * Check NFT holdings for a wallet address and return tier + benefits.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return NextResponse.json(
      { error: 'Valid Ethereum address required (0x... 42 chars)' },
      { status: 400 },
    );
  }

  try {
    const holdings = await checkNftHoldings(address);

    return NextResponse.json(holdings, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    console.error('[nft-check] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to check NFT holdings', details: error.message },
      { status: 500 },
    );
  }
}
