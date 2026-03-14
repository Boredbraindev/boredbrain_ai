export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const BAYC_CONTRACT = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
const MAYC_CONTRACT = '0x60E4d786628Fea6478F785A6d7e704777c86a7c6';

/**
 * Check if a wallet holds NFTs from a specific contract using Alchemy API.
 */
async function checkNftOwnership(
  walletAddress: string,
  contractAddress: string,
  alchemyApiKey: string,
): Promise<boolean> {
  try {
    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyApiKey}/isHolderOfContract?wallet=${walletAddress}&contractAddress=${contractAddress}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(`Alchemy NFT check failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    return data.isHolderOfContract === true;
  } catch (error) {
    console.error(`Error checking NFT ownership for ${contractAddress}:`, error);
    return false;
  }
}

/**
 * Determine the user tier based on NFT holdings.
 */
async function determineNftTier(
  walletAddress: string,
  alchemyApiKey: string,
): Promise<string | null> {
  // Check BAYC first (higher tier)
  const holdsBayc = await checkNftOwnership(walletAddress, BAYC_CONTRACT, alchemyApiKey);
  if (holdsBayc) {
    return 'bayc_holder';
  }

  // Check MAYC
  const holdsMayc = await checkNftOwnership(walletAddress, MAYC_CONTRACT, alchemyApiKey);
  if (holdsMayc) {
    return 'mayc_holder';
  }

  return null;
}

/**
 * POST /api/auth/link-wallet
 *
 * Links a wallet address to the authenticated user's account.
 * Also checks for BAYC/MAYC NFT holdings and assigns a tier.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    // Check if wallet is already linked to another user
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.walletAddress, walletAddress))
      .limit(1);

    if (existingUser.length > 0 && existingUser[0].id !== currentUser.id) {
      return NextResponse.json(
        { error: 'This wallet address is already linked to another account' },
        { status: 409 },
      );
    }

    // Update user with wallet address
    await db
      .update(user)
      .set({
        walletAddress,
        updatedAt: new Date(),
      })
      .where(eq(user.id, currentUser.id));

    // Check for BAYC/MAYC NFT holdings if Alchemy API key is available
    let tier: string | null = null;
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;

    if (alchemyApiKey && alchemyApiKey.length > 0) {
      tier = await determineNftTier(walletAddress, alchemyApiKey);
    }

    return NextResponse.json({
      success: true,
      walletAddress,
      tier,
    });
  } catch (error) {
    console.error('Error in link-wallet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
