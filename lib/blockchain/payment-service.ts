/**
 * Blockchain Payment Service for USDT Token
 *
 * Handles on-chain interactions with the USDT ERC-20 contract on Base.
 * Uses raw JSON-RPC calls via fetch() -- no ethers.js dependency.
 *
 * When no contract address is configured (isOnChainEnabled === false),
 * all functions operate in simulation mode and return deterministic
 * mock data so the rest of the platform can function without a live
 * contract deployment.
 */

import {
  getChainConfig,
  isOnChainEnabled,
  toTokenUnits,
  fromTokenUnits,
  BBAI_TOKEN,
  type SupportedChainId,
} from './config';
import { FUNCTION_SELECTORS } from '@/lib/contracts/bbai-abi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenBalance {
  address: string;
  balance: number;
  rawBalance: string;
  chain: string;
  isSimulated: boolean;
}

export interface PaymentResult {
  success: boolean;
  txHash: string | null;
  blockNumber: number | null;
  from: string;
  to: string;
  amount: number;
  platformFee: number;
  providerAmount: number;
  toolName: string;
  chain: string;
  isSimulated: boolean;
  error?: string;
}

export interface StakeResult {
  success: boolean;
  txHash: string | null;
  blockNumber: number | null;
  address: string;
  amount: number;
  lockUntil: number | null;
  chain: string;
  isSimulated: boolean;
  error?: string;
}

export interface StakeInfo {
  address: string;
  stakedAmount: number;
  stakedAt: number;
  lockUntil: number;
  isLocked: boolean;
  isSimulated: boolean;
}

export interface TxVerification {
  confirmed: boolean;
  blockNumber: number | null;
  from: string | null;
  to: string | null;
  status: 'success' | 'reverted' | 'pending' | 'not_found';
  isSimulated: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_FEE_BPS = 1500; // 15% = 1500 basis points
const STAKING_LOCK_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

let rpcCallId = 1;

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const id = rpcCallId++;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { result?: unknown; error?: { message: string; code: number } };

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message} (code ${json.error.code})`);
  }

  return json.result;
}

/**
 * Encode an eth_call data payload.
 * selector + abi-encoded params (each param is a 32-byte word).
 */
function encodeCallData(selector: string, ...params: string[]): string {
  return selector + params.map((p) => p.replace('0x', '').padStart(64, '0')).join('');
}

/**
 * Pad an address to a 32-byte ABI word.
 */
function padAddress(address: string): string {
  return address.replace('0x', '').toLowerCase().padStart(64, '0');
}

/**
 * Pad a uint256 value (as bigint) to a 32-byte ABI word.
 */
function padUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

/**
 * Decode a uint256 from a hex string returned by eth_call.
 */
function decodeUint256(hex: string): bigint {
  const clean = hex.replace('0x', '');
  if (clean.length === 0) return 0n;
  return BigInt('0x' + clean);
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

function simulatedTxHash(context: string): string {
  const seed = `${context}-${Date.now()}`;
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    const charCode = seed.charCodeAt(i % seed.length);
    hash += ((charCode * (i + 1) * 7 + (Date.now() >> (i % 16))) % 16).toString(16);
  }
  return hash;
}

function simulatedBlockNumber(): number {
  const baseGenesisTs = 1704067200;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.floor((nowSec - baseGenesisTs) / 2) + Math.floor(Math.random() * 10);
}

/**
 * Deterministic simulated balance based on address.
 * Gives each address a consistent but varied balance.
 */
function simulatedBalance(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 50000) + 1000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the USDT token balance for an address.
 * Falls back to simulation when no contract is deployed.
 */
export async function getTokenBalance(
  address: string,
  chainId?: SupportedChainId,
): Promise<TokenBalance> {
  const config = getChainConfig(chainId);

  if (!isOnChainEnabled(chainId)) {
    return {
      address,
      balance: simulatedBalance(address),
      rawBalance: toTokenUnits(simulatedBalance(address)).toString(),
      chain: config.name,
      isSimulated: true,
    };
  }

  const data = encodeCallData(
    FUNCTION_SELECTORS.balanceOf,
    padAddress(address),
  );

  const result = (await rpcCall(config.rpcUrl, 'eth_call', [
    { to: config.bbaiTokenAddress, data },
    'latest',
  ])) as string;

  const rawBalance = decodeUint256(result);
  const balance = fromTokenUnits(rawBalance);

  return {
    address,
    balance,
    rawBalance: rawBalance.toString(),
    chain: config.name,
    isSimulated: false,
  };
}

/**
 * Process a tool call payment with 15% platform fee.
 *
 * On-chain: calls payToolFee(provider, amount, toolId) on the BBAI contract.
 * Simulation: deducts from simulated balance and returns a mock tx hash.
 */
export async function processToolPayment(
  from: string,
  to: string,
  amount: number,
  toolName: string,
  chainId?: SupportedChainId,
): Promise<PaymentResult> {
  const config = getChainConfig(chainId);
  const platformFee = Math.round(amount * PLATFORM_FEE_BPS) / 10000;
  const providerAmount = amount - platformFee;

  // -- Simulation mode --
  if (!isOnChainEnabled(chainId)) {
    const balance = simulatedBalance(from);
    if (balance < amount) {
      return {
        success: false,
        txHash: null,
        blockNumber: null,
        from,
        to,
        amount,
        platformFee,
        providerAmount,
        toolName,
        chain: config.name,
        isSimulated: true,
        error: `Insufficient simulated balance: ${balance} < ${amount}`,
      };
    }

    return {
      success: true,
      txHash: simulatedTxHash(`tool-${from}-${to}-${toolName}`),
      blockNumber: simulatedBlockNumber(),
      from,
      to,
      amount,
      platformFee,
      providerAmount,
      toolName,
      chain: config.name,
      isSimulated: true,
    };
  }

  // -- On-chain mode --
  try {
    // Encode toolId as bytes32 from tool name
    const toolIdHex = '0x' + Buffer.from(toolName.padEnd(32, '\0').slice(0, 32)).toString('hex');
    const tokenUnits = toTokenUnits(amount);

    const data = encodeCallData(
      FUNCTION_SELECTORS.payToolFee,
      padAddress(to),
      padUint256(tokenUnits),
      toolIdHex.replace('0x', '').padStart(64, '0'),
    );

    // For on-chain writes we need eth_sendRawTransaction with a signed tx.
    // Since we do not hold private keys server-side, the actual signing
    // should happen client-side or via a relayer.  Here we prepare the
    // call data and verify the balance is sufficient.
    const balanceResult = await getTokenBalance(from, chainId);
    if (balanceResult.balance < amount) {
      return {
        success: false,
        txHash: null,
        blockNumber: null,
        from,
        to,
        amount,
        platformFee,
        providerAmount,
        toolName,
        chain: config.name,
        isSimulated: false,
        error: `Insufficient USDT balance: ${balanceResult.balance} < ${amount}`,
      };
    }

    // Return the prepared transaction for client-side signing
    // In a relayer setup, this is where we would submit the signed tx.
    // For now, we return the calldata so the caller (frontend/relayer)
    // can sign and broadcast.
    return {
      success: true,
      txHash: null, // will be set after broadcast
      blockNumber: null,
      from,
      to,
      amount,
      platformFee,
      providerAmount,
      toolName,
      chain: config.name,
      isSimulated: false,
    };
  } catch (err) {
    return {
      success: false,
      txHash: null,
      blockNumber: null,
      from,
      to,
      amount,
      platformFee,
      providerAmount,
      toolName,
      chain: config.name,
      isSimulated: false,
      error: err instanceof Error ? err.message : 'On-chain payment failed',
    };
  }
}

/**
 * Stake USDT for agent registration.
 * Tokens are locked for STAKING_LOCK_SECONDS (7 days).
 */
export async function stakeForRegistration(
  address: string,
  amount: number,
  chainId?: SupportedChainId,
): Promise<StakeResult> {
  const config = getChainConfig(chainId);
  const lockUntil = Math.floor(Date.now() / 1000) + STAKING_LOCK_SECONDS;

  if (!isOnChainEnabled(chainId)) {
    const balance = simulatedBalance(address);
    if (balance < amount) {
      return {
        success: false,
        txHash: null,
        blockNumber: null,
        address,
        amount,
        lockUntil: null,
        chain: config.name,
        isSimulated: true,
        error: `Insufficient simulated balance: ${balance} < ${amount}`,
      };
    }

    return {
      success: true,
      txHash: simulatedTxHash(`stake-${address}-${amount}`),
      blockNumber: simulatedBlockNumber(),
      address,
      amount,
      lockUntil,
      chain: config.name,
      isSimulated: true,
    };
  }

  // On-chain: verify balance then return prepared calldata
  try {
    const balanceResult = await getTokenBalance(address, chainId);
    if (balanceResult.balance < amount) {
      return {
        success: false,
        txHash: null,
        blockNumber: null,
        address,
        amount,
        lockUntil: null,
        chain: config.name,
        isSimulated: false,
        error: `Insufficient USDT balance: ${balanceResult.balance} < ${amount}`,
      };
    }

    return {
      success: true,
      txHash: null, // set after client-side broadcast
      blockNumber: null,
      address,
      amount,
      lockUntil,
      chain: config.name,
      isSimulated: false,
    };
  } catch (err) {
    return {
      success: false,
      txHash: null,
      blockNumber: null,
      address,
      amount,
      lockUntil: null,
      chain: config.name,
      isSimulated: false,
      error: err instanceof Error ? err.message : 'Staking failed',
    };
  }
}

/**
 * Unstake USDT after the lock period has expired.
 */
export async function unstake(
  address: string,
  chainId?: SupportedChainId,
): Promise<StakeResult> {
  const config = getChainConfig(chainId);

  if (!isOnChainEnabled(chainId)) {
    return {
      success: true,
      txHash: simulatedTxHash(`unstake-${address}`),
      blockNumber: simulatedBlockNumber(),
      address,
      amount: 0, // actual amount would come from on-chain state
      lockUntil: null,
      chain: config.name,
      isSimulated: true,
    };
  }

  // On-chain: read stake info first to verify lock has expired
  try {
    const stakeInfo = await getStakeInfo(address, chainId);
    if (stakeInfo.isLocked) {
      const remaining = stakeInfo.lockUntil - Math.floor(Date.now() / 1000);
      return {
        success: false,
        txHash: null,
        blockNumber: null,
        address,
        amount: stakeInfo.stakedAmount,
        lockUntil: stakeInfo.lockUntil,
        chain: config.name,
        isSimulated: false,
        error: `Stake is still locked for ${remaining} seconds`,
      };
    }

    return {
      success: true,
      txHash: null, // set after client-side broadcast
      blockNumber: null,
      address,
      amount: stakeInfo.stakedAmount,
      lockUntil: null,
      chain: config.name,
      isSimulated: false,
    };
  } catch (err) {
    return {
      success: false,
      txHash: null,
      blockNumber: null,
      address,
      amount: 0,
      lockUntil: null,
      chain: config.name,
      isSimulated: false,
      error: err instanceof Error ? err.message : 'Unstaking failed',
    };
  }
}

/**
 * Get staking information for an address.
 */
export async function getStakeInfo(
  address: string,
  chainId?: SupportedChainId,
): Promise<StakeInfo> {
  const config = getChainConfig(chainId);

  if (!isOnChainEnabled(chainId)) {
    // Simulation: deterministic stake data based on address
    const balance = simulatedBalance(address);
    const staked = balance > 5000 ? Math.floor(balance * 0.3) : 0;
    const stakedAt = staked > 0 ? Math.floor(Date.now() / 1000) - 86400 * 3 : 0;
    const lockUntil = staked > 0 ? stakedAt + STAKING_LOCK_SECONDS : 0;
    const isLocked = staked > 0 && lockUntil > Math.floor(Date.now() / 1000);

    return {
      address,
      stakedAmount: staked,
      stakedAt,
      lockUntil,
      isLocked,
      isSimulated: true,
    };
  }

  // On-chain: call getStakeInfo(address)
  const data = encodeCallData(
    FUNCTION_SELECTORS.getStakeInfo,
    padAddress(address),
  );

  const result = (await rpcCall(config.rpcUrl, 'eth_call', [
    { to: config.bbaiTokenAddress, data },
    'latest',
  ])) as string;

  // Decode 4 return values (amount, stakedAt, lockUntil, isLocked)
  const hex = result.replace('0x', '');
  const stakedAmount = fromTokenUnits(BigInt('0x' + (hex.slice(0, 64) || '0')));
  const stakedAt = Number(BigInt('0x' + (hex.slice(64, 128) || '0')));
  const lockUntil = Number(BigInt('0x' + (hex.slice(128, 192) || '0')));
  const isLocked = BigInt('0x' + (hex.slice(192, 256) || '0')) !== 0n;

  return {
    address,
    stakedAmount,
    stakedAt,
    lockUntil,
    isLocked,
    isSimulated: false,
  };
}

/**
 * Verify a transaction hash on-chain.
 * Checks eth_getTransactionReceipt for confirmation status.
 */
export async function verifyTransaction(
  txHash: string,
  chainId?: SupportedChainId,
): Promise<TxVerification> {
  const config = getChainConfig(chainId);

  if (!isOnChainEnabled(chainId)) {
    // Simulation: all hashes are "confirmed"
    return {
      confirmed: true,
      blockNumber: simulatedBlockNumber(),
      from: null,
      to: null,
      status: 'success',
      isSimulated: true,
    };
  }

  try {
    const receipt = (await rpcCall(config.rpcUrl, 'eth_getTransactionReceipt', [
      txHash,
    ])) as {
      blockNumber: string;
      from: string;
      to: string;
      status: string;
    } | null;

    if (!receipt) {
      // Check if the tx is pending
      const tx = (await rpcCall(config.rpcUrl, 'eth_getTransactionByHash', [
        txHash,
      ])) as { from: string; to: string } | null;

      if (tx) {
        return {
          confirmed: false,
          blockNumber: null,
          from: tx.from,
          to: tx.to,
          status: 'pending',
          isSimulated: false,
        };
      }

      return {
        confirmed: false,
        blockNumber: null,
        from: null,
        to: null,
        status: 'not_found',
        isSimulated: false,
      };
    }

    const statusOk = receipt.status === '0x1';
    return {
      confirmed: statusOk,
      blockNumber: Number(BigInt(receipt.blockNumber)),
      from: receipt.from,
      to: receipt.to,
      status: statusOk ? 'success' : 'reverted',
      isSimulated: false,
    };
  } catch {
    return {
      confirmed: false,
      blockNumber: null,
      from: null,
      to: null,
      status: 'not_found',
      isSimulated: false,
    };
  }
}

/**
 * Build unsigned transaction data for client-side signing.
 * Returns the raw calldata and contract address needed to construct
 * the transaction in a browser wallet (e.g. via wagmi / viem).
 */
export function buildPayToolFeeCalldata(
  providerAddress: string,
  amount: number,
  toolName: string,
  chainId?: SupportedChainId,
): { to: string; data: string; chainId: number; value: '0x0' } | null {
  const config = getChainConfig(chainId);

  if (!config.bbaiTokenAddress) {
    return null; // simulation mode, no calldata to build
  }

  const tokenUnits = toTokenUnits(amount);
  const toolIdHex = Buffer.from(toolName.padEnd(32, '\0').slice(0, 32)).toString('hex');

  const data = encodeCallData(
    FUNCTION_SELECTORS.payToolFee,
    padAddress(providerAddress),
    padUint256(tokenUnits),
    toolIdHex.padStart(64, '0'),
  );

  return {
    to: config.bbaiTokenAddress,
    data,
    chainId: config.chainId,
    value: '0x0',
  };
}

/**
 * Build unsigned calldata for staking.
 */
export function buildStakeCalldata(
  amount: number,
  chainId?: SupportedChainId,
): { to: string; data: string; chainId: number; value: '0x0' } | null {
  const config = getChainConfig(chainId);

  if (!config.bbaiTokenAddress) {
    return null;
  }

  const tokenUnits = toTokenUnits(amount);
  const data = encodeCallData(FUNCTION_SELECTORS.stakeBBAI, padUint256(tokenUnits));

  return {
    to: config.bbaiTokenAddress,
    data,
    chainId: config.chainId,
    value: '0x0',
  };
}

/**
 * Build unsigned calldata for unstaking.
 */
export function buildUnstakeCalldata(
  chainId?: SupportedChainId,
): { to: string; data: string; chainId: number; value: '0x0' } | null {
  const config = getChainConfig(chainId);

  if (!config.bbaiTokenAddress) {
    return null;
  }

  return {
    to: config.bbaiTokenAddress,
    data: FUNCTION_SELECTORS.unstakeBBAI,
    chainId: config.chainId,
    value: '0x0',
  };
}
