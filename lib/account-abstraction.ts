/**
 * ERC-4337 Account Abstraction Helpers
 *
 * Agent smart wallet management backed by Drizzle ORM (PostgreSQL).
 * Each agent gets an ERC-4337 smart account that can execute gasless
 * transactions, enforce spending limits, and support social recovery.
 */

import { db } from '@/lib/db';
import { smartWallet } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateMockTxHash, generateMockBlockNumber } from '@/lib/payment-pipeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmartWallet {
  agentId: string;
  smartWalletAddress: string; // ERC-4337 smart account address
  ownerAddress: string;
  chain: string;
  isDeployed: boolean;
  nonce: number;
  guardians: string[]; // recovery addresses
  spendingLimits: {
    daily: number;
    perTransaction: number;
  };
  createdAt: string;
}

export interface UserOperation {
  sender: string;
  nonce: number;
  initCode: string;
  callData: string;
  callGasLimit: number;
  verificationGasLimit: number;
  preVerificationGas: number;
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
  paymasterAndData: string;
  signature: string;
}

export interface GasEstimate {
  callGas: number;
  verificationGas: number;
  preVerificationGas: number;
}

export interface UserOpResult {
  txHash: string;
  gasUsed: number;
  status: 'success' | 'reverted';
  blockNumber: number;
}

// ---------------------------------------------------------------------------
// Deterministic smart wallet address generation
// ---------------------------------------------------------------------------

function generateSmartWalletAddress(agentId: string, chain: string): string {
  let hash = 0;
  const input = `${agentId}-smart-${chain}`;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  let hex = '';
  let seed = Math.abs(hash);
  while (hex.length < 40) {
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    hex += seed.toString(16);
  }
  return '0x' + hex.slice(0, 40);
}

function generateGuardianAddress(agentId: string, index: number): string {
  let hash = 0;
  const input = `${agentId}-guardian-${index}`;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  let hex = '';
  let seed = Math.abs(hash);
  while (hex.length < 40) {
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    hex += seed.toString(16);
  }
  return '0x' + hex.slice(0, 40);
}

// ---------------------------------------------------------------------------
// Helpers – convert DB row to SmartWallet interface
// ---------------------------------------------------------------------------

function toSmartWallet(row: typeof smartWallet.$inferSelect): SmartWallet {
  return {
    agentId: row.agentId,
    smartWalletAddress: row.smartWalletAddress,
    ownerAddress: row.ownerAddress,
    chain: row.chain,
    isDeployed: row.isDeployed,
    nonce: row.nonce,
    guardians: row.guardians,
    spendingLimits: row.spendingLimits,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new ERC-4337 smart wallet for an agent.
 */
export async function createSmartWallet(
  agentId: string,
  ownerAddress: string,
  chain: string,
  dailyLimit: number = 500,
  perTxLimit: number = 100,
): Promise<SmartWallet> {
  // Check for existing wallet
  const existing = await db
    .select()
    .from(smartWallet)
    .where(eq(smartWallet.agentId, agentId))
    .limit(1);

  if (existing.length > 0) {
    return toSmartWallet(existing[0]);
  }

  const rows = await db
    .insert(smartWallet)
    .values({
      agentId,
      smartWalletAddress: generateSmartWalletAddress(agentId, chain),
      ownerAddress,
      chain,
      isDeployed: true, // mock: assume deployed
      nonce: 0,
      guardians: [
        generateGuardianAddress(agentId, 0),
        generateGuardianAddress(agentId, 1),
      ],
      spendingLimits: {
        daily: dailyLimit,
        perTransaction: perTxLimit,
      },
    })
    .returning();

  return toSmartWallet(rows[0]);
}

/**
 * Get a smart wallet by agentId.
 */
export async function getSmartWallet(agentId: string): Promise<SmartWallet | undefined> {
  const rows = await db
    .select()
    .from(smartWallet)
    .where(eq(smartWallet.agentId, agentId))
    .limit(1);

  if (rows.length === 0) return undefined;
  return toSmartWallet(rows[0]);
}

/**
 * Get all smart wallets.
 */
export async function getAllSmartWallets(): Promise<SmartWallet[]> {
  const rows = await db.select().from(smartWallet);
  return rows.map(toSmartWallet);
}

/**
 * Build a mock ERC-4337 UserOperation.
 * (Will be replaced with real bundler integration in Phase 4.)
 */
export function buildUserOperation(
  wallet: SmartWallet,
  to: string,
  value: number,
  data: string,
): UserOperation {
  const userOp: UserOperation = {
    sender: wallet.smartWalletAddress,
    nonce: wallet.nonce,
    initCode: wallet.isDeployed ? '0x' : '0x' + 'ff'.repeat(42), // mock initCode
    callData: data || '0x',
    callGasLimit: 200000,
    verificationGasLimit: 150000,
    preVerificationGas: 21000,
    maxFeePerGas: 1500000000, // 1.5 gwei
    maxPriorityFeePerGas: 100000000, // 0.1 gwei
    paymasterAndData: '0x', // no paymaster in mock
    signature: '0x',
  };

  return userOp;
}

/**
 * Estimate gas for a UserOperation (mock values).
 * (Will be replaced with real bundler integration in Phase 4.)
 */
export function estimateGas(_userOp: UserOperation): GasEstimate {
  return {
    callGas: 150000 + Math.floor(Math.random() * 50000),
    verificationGas: 100000 + Math.floor(Math.random() * 50000),
    preVerificationGas: 21000,
  };
}

/**
 * Sign a UserOperation (mock signature).
 * (Will be replaced with real signing in Phase 4.)
 */
export function signUserOperation(_userOp: UserOperation, _privateKey: string): string {
  // Mock: generate a fake 65-byte signature (130 hex chars)
  let sig = '0x';
  for (let i = 0; i < 130; i++) {
    sig += Math.floor(Math.random() * 16).toString(16);
  }
  return sig;
}

/**
 * Execute a user operation (mock). Increments the wallet nonce in the DB.
 */
export async function executeUserOperation(
  wallet: SmartWallet,
  _userOp: UserOperation,
): Promise<UserOpResult> {
  // Increment nonce in the database
  const newNonce = wallet.nonce + 1;
  await db
    .update(smartWallet)
    .set({ nonce: newNonce })
    .where(eq(smartWallet.agentId, wallet.agentId));

  // Update the in-memory wallet object so callers see the new nonce
  wallet.nonce = newNonce;

  const gasUsed = 100000 + Math.floor(Math.random() * 100000);

  return {
    txHash: generateMockTxHash(),
    gasUsed,
    status: 'success',
    blockNumber: generateMockBlockNumber(),
  };
}
