/**
 * NFT Holder Checker
 *
 * Checks wallet NFT holdings for tier benefits:
 * - BAYC/MAYC holders → Premium agent registration (staking waived)
 * - Blue-chip NFT holders → Agent fee discount (10%)
 * - BoredBrain NFT holders → Governance + unlimited demo agents
 */

import { createPublicClient, http, type Address } from 'viem';
import { mainnet, base } from 'viem/chains';

// ERC-721 balanceOf ABI
const ERC721_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// NFT Collection addresses (Ethereum mainnet)
const NFT_COLLECTIONS = {
  // Yuga Labs
  BAYC: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' as Address,
  MAYC: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6' as Address,
  BAKC: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623' as Address,
  // Other blue-chips
  CRYPTOPUNKS: '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB' as Address,
  AZUKI: '0xED5AF388653567Af2F388E6224dC7C4b3241C544' as Address,
  DOODLES: '0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e' as Address,
  PUDGY_PENGUINS: '0xBd3531dA5CF5857e7CfAA92426877b022e612cf8' as Address,
  MILADY: '0x5Af0D9827E0c53E4799BB226655A1de152A425a5' as Address,
  CLONE_X: '0x49cF6f5d44E70224e2E23fDcdd2C053F30aDA28B' as Address,
} as const;

// BoredBrain NFT (Base chain) - placeholder address for future deployment
const BOREDBRAIN_NFT = '0x0000000000000000000000000000000000000000' as Address;

export type NftTier = 'ape' | 'bluechip' | 'boredbrain' | 'none';

export interface NftHoldings {
  tier: NftTier;
  collections: string[];
  benefits: string[];
  stakingDiscount: number;   // 0-100 percentage
  feeDiscount: number;       // 0-100 percentage
  extraDemoAgents: number;   // additional demo agents allowed
  totalNfts: number;
}

// Ethereum mainnet client
const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'),
});

// Base client
const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

async function getBalance(
  client: ReturnType<typeof createPublicClient>,
  contractAddress: Address,
  walletAddress: Address,
): Promise<number> {
  try {
    const balance = await client.readContract({
      address: contractAddress,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    return Number(balance);
  } catch {
    return 0;
  }
}

/**
 * Check all NFT holdings for a wallet address.
 * Returns tier, collections held, and applicable benefits.
 */
export async function checkNftHoldings(walletAddress: string): Promise<NftHoldings> {
  const address = walletAddress as Address;
  const collections: string[] = [];
  let totalNfts = 0;

  // Check all Ethereum mainnet collections in parallel
  const [bayc, mayc, bakc, punks, azuki, doodles, pudgy, milady, clonex] =
    await Promise.all([
      getBalance(ethClient, NFT_COLLECTIONS.BAYC, address),
      getBalance(ethClient, NFT_COLLECTIONS.MAYC, address),
      getBalance(ethClient, NFT_COLLECTIONS.BAKC, address),
      getBalance(ethClient, NFT_COLLECTIONS.CRYPTOPUNKS, address),
      getBalance(ethClient, NFT_COLLECTIONS.AZUKI, address),
      getBalance(ethClient, NFT_COLLECTIONS.DOODLES, address),
      getBalance(ethClient, NFT_COLLECTIONS.PUDGY_PENGUINS, address),
      getBalance(ethClient, NFT_COLLECTIONS.MILADY, address),
      getBalance(ethClient, NFT_COLLECTIONS.CLONE_X, address),
    ]);

  // Check BoredBrain NFT on Base (skip if not deployed)
  let boredbrainBalance = 0;
  if (BOREDBRAIN_NFT !== '0x0000000000000000000000000000000000000000') {
    boredbrainBalance = await getBalance(baseClient, BOREDBRAIN_NFT, address);
  }

  // Build collections list
  if (bayc > 0) { collections.push('BAYC'); totalNfts += bayc; }
  if (mayc > 0) { collections.push('MAYC'); totalNfts += mayc; }
  if (bakc > 0) { collections.push('BAKC'); totalNfts += bakc; }
  if (punks > 0) { collections.push('CryptoPunks'); totalNfts += punks; }
  if (azuki > 0) { collections.push('Azuki'); totalNfts += azuki; }
  if (doodles > 0) { collections.push('Doodles'); totalNfts += doodles; }
  if (pudgy > 0) { collections.push('Pudgy Penguins'); totalNfts += pudgy; }
  if (milady > 0) { collections.push('Milady'); totalNfts += milady; }
  if (clonex > 0) { collections.push('Clone X'); totalNfts += clonex; }
  if (boredbrainBalance > 0) { collections.push('BoredBrain'); totalNfts += boredbrainBalance; }

  // Determine tier
  const isApe = bayc > 0 || mayc > 0;
  const isBluechip = punks > 0 || azuki > 0 || doodles > 0 || pudgy > 0 || milady > 0 || clonex > 0 || bakc > 0;
  const isBoredbrain = boredbrainBalance > 0;

  if (isApe) {
    return {
      tier: 'ape',
      collections,
      benefits: [
        'Free premium agent registration (staking waived)',
        '15% fee discount on all tool usage',
        'Priority placement in marketplace',
        'Exclusive Ape-tier badge',
        '3 free demo agents',
      ],
      stakingDiscount: 100,
      feeDiscount: 15,
      extraDemoAgents: 3,
      totalNfts,
    };
  }

  if (isBoredbrain) {
    return {
      tier: 'boredbrain',
      collections,
      benefits: [
        'Governance voting rights',
        'Unlimited demo agents',
        '20% fee discount',
        'Early access to new features',
        'Revenue sharing from platform fees',
      ],
      stakingDiscount: 50,
      feeDiscount: 20,
      extraDemoAgents: 99,
      totalNfts,
    };
  }

  if (isBluechip) {
    return {
      tier: 'bluechip',
      collections,
      benefits: [
        '10% fee discount on all tool usage',
        'Blue-chip holder badge',
        '2 free demo agents',
        'Reduced staking requirement (50 USDT)',
      ],
      stakingDiscount: 50,
      feeDiscount: 10,
      extraDemoAgents: 2,
      totalNfts,
    };
  }

  return {
    tier: 'none',
    collections: [],
    benefits: [],
    stakingDiscount: 0,
    feeDiscount: 0,
    extraDemoAgents: 0,
    totalNfts: 0,
  };
}

/**
 * Tier display configuration
 */
export const TIER_CONFIG = {
  ape: {
    label: 'Ape Holder',
    color: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/50',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    emoji: '🦍',
  },
  bluechip: {
    label: 'Blue-Chip Holder',
    color: 'from-blue-500 to-cyan-500',
    borderColor: 'border-blue-500/50',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    emoji: '💎',
  },
  boredbrain: {
    label: 'BoredBrain OG',
    color: 'from-purple-500 to-pink-500',
    borderColor: 'border-purple-500/50',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    emoji: '🧠',
  },
  none: {
    label: '',
    color: '',
    borderColor: 'border-border/50',
    bgColor: '',
    textColor: 'text-muted-foreground',
    emoji: '',
  },
} as const;
