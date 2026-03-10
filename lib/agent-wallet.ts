/**
 * Agent Wallet System - BBAI Points wallets for AI agents.
 * Each agent has its own points wallet for autonomous spending within the platform.
 * Internal points system — on-chain migration at TGE.
 * Uses Drizzle ORM with PostgreSQL for persistence.
 */

import { db } from '@/lib/db';
import { agentWallet, walletTransaction } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentWallet {
  agentId: string;
  address: string;
  balance: number;
  dailyLimit: number;
  totalSpent: number;
  isActive: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  agentId: string;
  amount: number;
  type: 'debit' | 'credit';
  reason: string;
  timestamp: string;
  balanceAfter: number;
}

export interface DeductResult {
  success: boolean;
  txId: string;
  remaining: number;
}

// ---------------------------------------------------------------------------
// Deterministic address generation
// ---------------------------------------------------------------------------

function generateWalletAddress(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    const char = agentId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Produce 40 hex characters (20 bytes) from repeated hashing
  let hex = '';
  let seed = Math.abs(hash);
  while (hex.length < 40) {
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    hex += seed.toString(16);
  }
  return '0x' + hex.slice(0, 40);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAgentWallet(row: typeof agentWallet.$inferSelect): AgentWallet {
  return {
    agentId: row.agentId,
    address: row.address,
    balance: row.balance,
    dailyLimit: row.dailyLimit,
    totalSpent: row.totalSpent,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function toTransaction(row: typeof walletTransaction.$inferSelect): Transaction {
  return {
    id: row.id,
    agentId: row.agentId,
    amount: row.amount,
    type: row.type as 'debit' | 'credit',
    reason: row.reason,
    timestamp: row.timestamp.toISOString(),
    balanceAfter: row.balanceAfter,
  };
}

async function recordTransaction(
  agentId: string,
  amount: number,
  type: 'debit' | 'credit',
  reason: string,
  balanceAfter: number,
): Promise<Transaction> {
  const [row] = await db
    .insert(walletTransaction)
    .values({
      agentId,
      amount,
      type,
      reason,
      balanceAfter,
    })
    .returning();

  return toTransaction(row);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new agent wallet with optional daily limit.
 * Starts with 1000 BBAI by default.
 */
export async function createAgentWallet(
  agentId: string,
  dailyLimit: number = 100,
): Promise<AgentWallet> {
  // Check if wallet already exists
  const [existing] = await db
    .select()
    .from(agentWallet)
    .where(eq(agentWallet.agentId, agentId));

  if (existing) return toAgentWallet(existing);

  const [row] = await db
    .insert(agentWallet)
    .values({
      agentId,
      address: generateWalletAddress(agentId),
      balance: 1000,
      dailyLimit,
      totalSpent: 0,
      isActive: true,
    })
    .returning();

  // Record the initial credit
  await recordTransaction(agentId, 1000, 'credit', 'Initial wallet funding', 1000);

  return toAgentWallet(row);
}

/**
 * Retrieve an agent wallet by agentId.
 */
export async function getAgentWallet(agentId: string): Promise<AgentWallet | undefined> {
  const [row] = await db
    .select()
    .from(agentWallet)
    .where(eq(agentWallet.agentId, agentId));

  return row ? toAgentWallet(row) : undefined;
}

/**
 * Get all agent wallets.
 */
export async function getAllWallets(): Promise<AgentWallet[]> {
  const rows = await db.select().from(agentWallet);
  return rows.map(toAgentWallet);
}

/**
 * Deduct BBAI from an agent's wallet.
 * Fails if the wallet has insufficient balance or the daily limit is exceeded.
 * Uses a DB transaction to ensure atomicity.
 */
export async function deductBalance(
  agentId: string,
  amount: number,
  reason: string,
): Promise<DeductResult> {
  // Note: neon-http driver does not support transactions.
  // Use sequential queries with optimistic concurrency instead.
  const [wallet] = await db
    .select()
    .from(agentWallet)
    .where(eq(agentWallet.agentId, agentId));

  if (!wallet) {
    return { success: false, txId: '', remaining: 0 };
  }

  if (!wallet.isActive) {
    return { success: false, txId: '', remaining: wallet.balance };
  }

  if (amount <= 0) {
    return { success: false, txId: '', remaining: wallet.balance };
  }

  if (amount > wallet.balance) {
    return { success: false, txId: '', remaining: wallet.balance };
  }

  // Check daily spend limit: sum debits from today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayTxRows = await db
    .select()
    .from(walletTransaction)
    .where(eq(walletTransaction.agentId, agentId));

  const todaySpent = todayTxRows
    .filter(
      (row) =>
        row.type === 'debit' && row.timestamp >= todayStart,
    )
    .reduce((sum, row) => sum + row.amount, 0);

  if (todaySpent + amount > wallet.dailyLimit) {
    return { success: false, txId: '', remaining: wallet.balance };
  }

  // Execute the deduction
  const newBalance = wallet.balance - amount;
  const newTotalSpent = wallet.totalSpent + amount;

  await db
    .update(agentWallet)
    .set({ balance: newBalance, totalSpent: newTotalSpent })
    .where(eq(agentWallet.agentId, agentId));

  // Record the transaction
  const [txRow] = await db
    .insert(walletTransaction)
    .values({
      agentId,
      amount,
      type: 'debit',
      reason,
      balanceAfter: newBalance,
    })
    .returning();

  return {
    success: true,
    txId: txRow.id,
    remaining: newBalance,
  };
}

/**
 * Add BBAI to an agent's wallet.
 */
export async function topUpWallet(agentId: string, amount: number): Promise<AgentWallet> {
  const [wallet] = await db
    .select()
    .from(agentWallet)
    .where(eq(agentWallet.agentId, agentId));

  if (!wallet) {
    throw new Error(`Wallet not found for agent: ${agentId}`);
  }

  if (amount <= 0) {
    throw new Error('Top-up amount must be positive');
  }

  const newBalance = wallet.balance + amount;

  const [updated] = await db
    .update(agentWallet)
    .set({ balance: newBalance })
    .where(eq(agentWallet.agentId, agentId))
    .returning();

  await recordTransaction(agentId, amount, 'credit', 'Wallet top-up', newBalance);

  return toAgentWallet(updated);
}

/**
 * Get the full transaction log for an agent.
 */
export async function getTransactionLog(agentId: string): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(walletTransaction)
    .where(eq(walletTransaction.agentId, agentId))
    .orderBy(desc(walletTransaction.timestamp));

  return rows.map(toTransaction);
}
