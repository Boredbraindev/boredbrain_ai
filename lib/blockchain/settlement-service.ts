/**
 * PredictionSettlement Service — BSC Testnet / Mainnet
 *
 * Hybrid model:
 * - Bets: off-chain (BBAI Points in PostgreSQL)
 * - Settlement: on-chain (PredictionSettlement contract on BSC)
 *
 * Requires SETTLEMENT_CONTRACT_BSC_TESTNET env to be set.
 * If the contract is not deployed, settlement calls return an error.
 */

import {
  getSettlementChainConfig,
  isSettlementEnabled,
  type SettlementChainId,
} from './config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettlementResult {
  success: boolean;
  roundId: number;
  txHash: string | null;
  blockNumber: number | null;
  chain: string;
  explorer: string | null;
  isSimulated: boolean;
  settledAt: number;
  error?: string;
}

export interface OnChainRound {
  roundId: number;
  asset: string;
  startPrice: number;
  endPrice: number;
  outcome: 'UP' | 'DOWN';
  upPool: number;
  downPool: number;
  totalBets: number;
  settledAt: number;
  txHash: string;
  explorer: string;
  isSimulated: boolean;
}

export interface SettlementStats {
  totalRoundsSettled: number;
  totalVolumeSettled: number;
  chain: string;
  contractAddress: string | null;
  isLive: boolean;
  latestRounds: OnChainRound[];
}

// ---------------------------------------------------------------------------
// In-memory settlement ledger
// ---------------------------------------------------------------------------

const settledRounds: OnChainRound[] = [];

// ---------------------------------------------------------------------------
// JSON-RPC helper
// ---------------------------------------------------------------------------

let rpcId = 1;

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
  });
  if (!res.ok) throw new Error(`RPC error: ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ---------------------------------------------------------------------------
// Settlement Functions
// ---------------------------------------------------------------------------

/**
 * Settle a prediction round — record result on-chain.
 */
export async function settleRound(
  roundId: number,
  asset: string,
  startPrice: number,
  endPrice: number,
  outcome: 'UP' | 'DOWN',
  upPool: number,
  downPool: number,
  totalBets: number,
  chainId?: SettlementChainId,
): Promise<SettlementResult> {
  const config = getSettlementChainConfig(chainId);

  // Check if already settled
  const existing = settledRounds.find(r => r.roundId === roundId);
  if (existing) {
    return {
      success: true,
      roundId,
      txHash: existing.txHash,
      blockNumber: null,
      chain: config.name,
      explorer: existing.explorer,
      isSimulated: existing.isSimulated,
      settledAt: existing.settledAt,
    };
  }

  if (!isSettlementEnabled(chainId)) {
    return {
      success: false,
      roundId,
      txHash: null,
      blockNumber: null,
      chain: config.name,
      explorer: null,
      isSimulated: false,
      settledAt: 0,
      error: 'Settlement contract not deployed. Set SETTLEMENT_CONTRACT_BSC_TESTNET env var.',
    };
  }

  // ── On-chain mode (contract deployed) ──
  try {
    // For server-side settlement, we need the operator private key.
    // The operator wallet signs settleRound() transactions.
    const operatorKey = process.env.SETTLEMENT_OPERATOR_KEY;
    if (!operatorKey) {
      throw new Error('SETTLEMENT_OPERATOR_KEY not configured');
    }

    // Use viem for transaction signing and sending
    const { createWalletClient, http, parseAbi } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { bscTestnet, bsc } = await import('viem/chains');

    const chain = config.isTestnet ? bscTestnet : bsc;
    const account = privateKeyToAccount(operatorKey as `0x${string}`);

    const client = createWalletClient({
      account,
      chain,
      transport: http(config.rpcUrl),
    });

    const { createPublicClient } = await import('viem');
    const publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });

    // Convert prices to 8-decimal fixed point
    const startPrice8 = BigInt(Math.round(startPrice * 1e8));
    const endPrice8 = BigInt(Math.round(endPrice * 1e8));

    const txHash = await client.writeContract({
      address: config.settlementContract as `0x${string}`,
      abi: parseAbi([
        'function settleRound(uint256,string,uint256,uint256,uint8,uint256,uint256,uint256) external',
      ]),
      functionName: 'settleRound',
      args: [
        BigInt(roundId),
        asset,
        startPrice8,
        endPrice8,
        outcome === 'UP' ? 0 : 1,
        BigInt(Math.round(upPool)),
        BigInt(Math.round(downPool)),
        BigInt(totalBets),
      ],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const explorerUrl = `${config.blockExplorerUrl}/tx/${txHash}`;

    const round: OnChainRound = {
      roundId,
      asset,
      startPrice,
      endPrice,
      outcome,
      upPool,
      downPool,
      totalBets,
      settledAt: Math.floor(Date.now() / 1000),
      txHash,
      explorer: explorerUrl,
      isSimulated: false,
    };

    settledRounds.unshift(round);
    if (settledRounds.length > 100) settledRounds.pop();

    return {
      success: true,
      roundId,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      chain: config.name,
      explorer: explorerUrl,
      isSimulated: false,
      settledAt: Math.floor(Date.now() / 1000),
    };
  } catch (err) {
    return {
      success: false,
      roundId,
      txHash: null,
      blockNumber: null,
      chain: config.name,
      explorer: null,
      isSimulated: false,
      settledAt: 0,
      error: err instanceof Error ? err.message : 'Settlement failed',
    };
  }
}

/**
 * Get settlement statistics and recent settled rounds.
 */
export function getSettlementStats(chainId?: SettlementChainId): SettlementStats {
  const config = getSettlementChainConfig(chainId);

  const totalVolume = settledRounds.reduce(
    (sum, r) => sum + r.upPool + r.downPool,
    0,
  );

  return {
    totalRoundsSettled: settledRounds.length,
    totalVolumeSettled: totalVolume,
    chain: config.name,
    contractAddress: config.settlementContract,
    isLive: isSettlementEnabled(chainId),
    latestRounds: settledRounds.slice(0, 20),
  };
}

/**
 * Get a specific settled round.
 */
export function getSettledRound(roundId: number): OnChainRound | null {
  return settledRounds.find(r => r.roundId === roundId) ?? null;
}

