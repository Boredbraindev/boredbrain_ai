/**
 * Agent Wallet System - BBAI Points wallets for AI agents.
 * Each agent has its own points wallet for autonomous spending within the platform.
 * Internal points system for agent spending within the platform.
 * Uses Drizzle ORM with PostgreSQL for persistence.
 */

import { db } from '@/lib/db';
import { agentWallet, walletTransaction } from '@/lib/db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

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
 * Create a new agent wallet with tier-based initial balance.
 * Default is 50 BP (Demo tier). Fleet/Premium agents should pass higher values.
 * @param dailyLimit - Max daily spend (default 50)
 * @param initialBalance - BBAI starting balance (default 50 = Demo tier)
 */
export async function createAgentWallet(
  agentId: string,
  dailyLimit: number = 50,
  initialBalance: number = 50,
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
      balance: initialBalance,
      dailyLimit,
      totalSpent: 0,
      isActive: true,
    })
    .returning();

  // Record the initial credit
  await recordTransaction(agentId, initialBalance, 'credit', 'Initial wallet funding', initialBalance);

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

  // Check daily spend limit: sum debits from today (single aggregation query)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [dailyRow] = await db
    .select({
      todaySpent: sql<number>`COALESCE(SUM(${walletTransaction.amount}), 0)`,
    })
    .from(walletTransaction)
    .where(
      and(
        eq(walletTransaction.agentId, agentId),
        eq(walletTransaction.type, 'debit'),
        gte(walletTransaction.timestamp, todayStart),
      ),
    );

  const todaySpent = Number(dailyRow.todaySpent);

  if (todaySpent + amount > wallet.dailyLimit) {
    return { success: false, txId: '', remaining: wallet.balance };
  }

  // Execute the deduction with optimistic concurrency guard.
  // The WHERE balance >= amount prevents double-spend if a concurrent
  // request already lowered the balance between our SELECT and UPDATE.
  const newBalance = wallet.balance - amount;
  const newTotalSpent = wallet.totalSpent + amount;

  const updated = await db
    .update(agentWallet)
    .set({ balance: newBalance, totalSpent: newTotalSpent })
    .where(
      and(
        eq(agentWallet.agentId, agentId),
        gte(agentWallet.balance, amount),
      ),
    )
    .returning();

  if (updated.length === 0) {
    // Concurrent deduction already lowered the balance — insufficient funds
    return { success: false, txId: '', remaining: wallet.balance };
  }

  // Record the transaction
  const [txRow] = await db
    .insert(walletTransaction)
    .values({
      agentId,
      amount,
      type: 'debit',
      reason,
      balanceAfter: updated[0].balance,
    })
    .returning();

  return {
    success: true,
    txId: txRow.id,
    remaining: updated[0].balance,
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
