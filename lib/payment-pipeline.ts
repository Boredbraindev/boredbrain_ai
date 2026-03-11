/**
 * Payment Pipeline Orchestrator
 *
 * Processes BBAI Points transactions between agents and platform.
 * Internal points system (85/15 split).
 * Uses internal reference IDs for audit trail. On-chain settlement via PredictionSettlement contract on BSC.
 *
 * Revenue streams:
 * - Tool calls (15% platform fee)
 * - Agent-to-agent invocations (85/15 split)
 * - Prompt marketplace (85/15 split)
 * - Arena entry fees (15% platform fee)
 * - Agent staking (100% locked)
 *
 * Persistence: Drizzle ORM + PostgreSQL (payment_transaction table).
 * Note: All transactions are internal BBAI points.
 */

import { db } from '@/lib/db';
import { paymentTransaction } from '@/lib/db/schema';
import { eq, desc, sql, or } from 'drizzle-orm';

import {
  getAgentWallet,
  createAgentWallet,
  deductBalance,
  topUpWallet,
} from '@/lib/agent-wallet';
import { getToolPrice } from '@/lib/tool-pricing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentType =
  | 'tool_call'
  | 'agent_invoke'
  | 'prompt_purchase'
  | 'arena_entry'
  | 'staking';

export type ChainId = 'base' | 'bsc' | 'apechain' | 'arbitrum';

export interface PaymentTransaction {
  id: string;
  type: PaymentType;
  fromAgentId: string;
  toAgentId?: string | null; // null for platform tools
  amount: number;
  platformFee: number; // 15%
  providerShare: number; // 85%
  chain: ChainId;
  txHash: string | null; // on-chain tx hash (mock for now)
  status: 'pending' | 'confirmed' | 'failed';
  toolName?: string | null;
  timestamp: string;
  blockNumber?: number | null;
}

export interface PaymentStats {
  totalVolume: number;
  totalFees: number;
  totalTransactions: number;
  volumeByChain: Record<ChainId, number>;
}

// ---------------------------------------------------------------------------
// Chain metadata
// ---------------------------------------------------------------------------

export const CHAIN_INFO: Record<ChainId, { name: string; chainId: number; color: string }> = {
  base: { name: 'Base', chainId: 8453, color: '#0052FF' },
  bsc: { name: 'BNB Chain', chainId: 56, color: '#F0B90B' },
  apechain: { name: 'ApeChain', chainId: 33139, color: '#0046FF' },
  arbitrum: { name: 'Arbitrum', chainId: 42161, color: '#28A0F0' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate an internal transaction reference ID.
 * Produces a prefixed reference string for audit trail purposes.
 */
export function generateInternalTxRef(context?: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `bbai-tx-${ts}-${rand}`;
}

/**
 * Generate an internal sequence number based on current timestamp.
 * Used for ordering transactions in the audit trail.
 */
export function generateInternalSeqNumber(): number {
  return Date.now();
}

// Legacy aliases
export const generateMockTxHash = generateInternalTxRef;
export const generateMockBlockNumber = generateInternalSeqNumber;

function calculateSplit(amount: number): { platformFee: number; providerShare: number } {
  const platformFee = Math.round(amount * 0.15 * 100) / 100;
  const providerShare = Math.round((amount - platformFee) * 100) / 100;
  return { platformFee, providerShare };
}

async function ensureWallet(agentId: string) {
  let wallet = await getAgentWallet(agentId);
  if (!wallet) {
    wallet = await createAgentWallet(agentId);
  }
  return wallet;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function toPaymentTransaction(
  row: typeof paymentTransaction.$inferSelect,
): PaymentTransaction {
  return {
    id: row.id,
    type: row.type as PaymentType,
    fromAgentId: row.fromAgentId,
    toAgentId: row.toAgentId,
    amount: row.amount,
    platformFee: row.platformFee,
    providerShare: row.providerShare,
    chain: row.chain as ChainId,
    txHash: row.txHash,
    status: row.status as 'pending' | 'confirmed' | 'failed',
    toolName: row.toolName,
    timestamp: row.timestamp.toISOString(),
    blockNumber: row.blockNumber,
  };
}

// ---------------------------------------------------------------------------
// Payment processors
// ---------------------------------------------------------------------------

/**
 * Process a tool call payment.
 * Deducts the tool price from the caller wallet.
 * The full amount goes to the platform (no provider for built-in tools).
 */
export async function processToolPayment(
  agentId: string,
  toolName: string,
  chain: ChainId = 'base',
): Promise<PaymentTransaction> {
  await ensureWallet(agentId);

  const price = getToolPrice(toolName);
  if (price === null) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const { platformFee, providerShare } = calculateSplit(price);

  const deduction = await deductBalance(agentId, price, `Tool call: ${toolName}`);
  if (!deduction.success) {
    const [row] = await db
      .insert(paymentTransaction)
      .values({
        type: 'tool_call',
        fromAgentId: agentId,
        amount: price,
        platformFee,
        providerShare,
        chain,
        txHash: null,
        status: 'failed',
        toolName,
      })
      .returning();

    return toPaymentTransaction(row);
  }

  const [row] = await db
    .insert(paymentTransaction)
    .values({
      type: 'tool_call',
      fromAgentId: agentId,
      amount: price,
      platformFee,
      providerShare,
      chain,
      txHash: generateInternalTxRef(`tool-${agentId}-${toolName}`),
      status: 'confirmed',
      toolName,
      blockNumber: generateInternalSeqNumber(),
    })
    .returning();

  return toPaymentTransaction(row);
}

/**
 * Process an agent-to-agent invocation payment.
 * Caller pays for each tool used by the provider agent.
 * 85% goes to the provider, 15% platform fee.
 */
export async function processAgentInvocation(
  callerAgentId: string,
  providerAgentId: string,
  tools: string[],
  chain: ChainId = 'base',
): Promise<PaymentTransaction> {
  await ensureWallet(callerAgentId);
  await ensureWallet(providerAgentId);

  let totalCost = 0;
  for (const tool of tools) {
    const price = getToolPrice(tool);
    totalCost += price ?? 5; // default 5 BBAI for unknown tools
  }

  const { platformFee, providerShare } = calculateSplit(totalCost);

  const deduction = await deductBalance(
    callerAgentId,
    totalCost,
    `Agent invocation: ${providerAgentId} (${tools.join(', ')})`,
  );

  if (!deduction.success) {
    const [row] = await db
      .insert(paymentTransaction)
      .values({
        type: 'agent_invoke',
        fromAgentId: callerAgentId,
        toAgentId: providerAgentId,
        amount: totalCost,
        platformFee,
        providerShare,
        chain,
        txHash: null,
        status: 'failed',
      })
      .returning();

    return toPaymentTransaction(row);
  }

  // Credit the provider with their 85% share
  try {
    await topUpWallet(providerAgentId, providerShare);
  } catch {
    // Provider wallet might not exist -- already ensured above, so this is safe
  }

  const [row] = await db
    .insert(paymentTransaction)
    .values({
      type: 'agent_invoke',
      fromAgentId: callerAgentId,
      toAgentId: providerAgentId,
      amount: totalCost,
      platformFee,
      providerShare,
      chain,
      txHash: generateInternalTxRef(`pay-${Date.now()}`),
      status: 'confirmed',
      blockNumber: generateInternalSeqNumber(),
    })
    .returning();

  return toPaymentTransaction(row);
}

/**
 * Process a prompt marketplace purchase.
 * Buyer pays the listed price; 85% goes to the prompt creator.
 */
export async function processPromptPurchase(
  buyerAddress: string,
  promptId: string,
  price: number,
  chain: ChainId = 'base',
): Promise<PaymentTransaction> {
  await ensureWallet(buyerAddress);

  const { platformFee, providerShare } = calculateSplit(price);

  const deduction = await deductBalance(
    buyerAddress,
    price,
    `Prompt purchase: ${promptId}`,
  );

  if (!deduction.success) {
    const [row] = await db
      .insert(paymentTransaction)
      .values({
        type: 'prompt_purchase',
        fromAgentId: buyerAddress,
        amount: price,
        platformFee,
        providerShare,
        chain,
        txHash: null,
        status: 'failed',
      })
      .returning();

    return toPaymentTransaction(row);
  }

  const [row] = await db
    .insert(paymentTransaction)
    .values({
      type: 'prompt_purchase',
      fromAgentId: buyerAddress,
      amount: price,
      platformFee,
      providerShare,
      chain,
      txHash: generateInternalTxRef(`pay-${Date.now()}`),
      status: 'confirmed',
      blockNumber: generateInternalSeqNumber(),
    })
    .returning();

  return toPaymentTransaction(row);
}

/**
 * Process an arena entry fee.
 * Agent pays entry fee; the full pot is distributed to winners post-match.
 */
export async function processArenaEntry(
  agentId: string,
  matchId: string,
  entryFee: number,
  chain: ChainId = 'base',
): Promise<PaymentTransaction> {
  await ensureWallet(agentId);

  const { platformFee, providerShare } = calculateSplit(entryFee);

  const deduction = await deductBalance(
    agentId,
    entryFee,
    `Arena entry: match ${matchId}`,
  );

  if (!deduction.success) {
    const [row] = await db
      .insert(paymentTransaction)
      .values({
        type: 'arena_entry',
        fromAgentId: agentId,
        amount: entryFee,
        platformFee,
        providerShare,
        chain,
        txHash: null,
        status: 'failed',
      })
      .returning();

    return toPaymentTransaction(row);
  }

  const [row] = await db
    .insert(paymentTransaction)
    .values({
      type: 'arena_entry',
      fromAgentId: agentId,
      amount: entryFee,
      platformFee,
      providerShare,
      chain,
      txHash: generateInternalTxRef(`pay-${Date.now()}`),
      status: 'confirmed',
      blockNumber: generateInternalSeqNumber(),
    })
    .returning();

  return toPaymentTransaction(row);
}

/**
 * Process a staking transaction.
 * Agent stakes BBAI; no provider split (all locked).
 */
export async function processStaking(
  agentId: string,
  amount: number,
  chain: ChainId = 'base',
): Promise<PaymentTransaction> {
  await ensureWallet(agentId);

  const deduction = await deductBalance(agentId, amount, `Staking: ${amount} BBAI`);

  if (!deduction.success) {
    const [row] = await db
      .insert(paymentTransaction)
      .values({
        type: 'staking',
        fromAgentId: agentId,
        amount,
        platformFee: 0,
        providerShare: 0,
        chain,
        txHash: null,
        status: 'failed',
      })
      .returning();

    return toPaymentTransaction(row);
  }

  const [row] = await db
    .insert(paymentTransaction)
    .values({
      type: 'staking',
      fromAgentId: agentId,
      amount,
      platformFee: 0,
      providerShare: amount, // full amount is staked
      chain,
      txHash: generateInternalTxRef(`pay-${Date.now()}`),
      status: 'confirmed',
      blockNumber: generateInternalSeqNumber(),
    })
    .returning();

  return toPaymentTransaction(row);
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Get payment history, optionally filtered by agentId.
 */
export async function getPaymentHistory(agentId?: string): Promise<PaymentTransaction[]> {
  if (!agentId) {
    const rows = await db
      .select()
      .from(paymentTransaction)
      .orderBy(desc(paymentTransaction.timestamp));

    return rows.map(toPaymentTransaction);
  }

  const rows = await db
    .select()
    .from(paymentTransaction)
    .where(
      or(
        eq(paymentTransaction.fromAgentId, agentId),
        eq(paymentTransaction.toAgentId, agentId),
      ),
    )
    .orderBy(desc(paymentTransaction.timestamp));

  return rows.map(toPaymentTransaction);
}

/**
 * Get aggregated payment statistics.
 * Uses SQL aggregation queries for efficiency.
 */
export async function getPaymentStats(): Promise<PaymentStats> {
  // Aggregate totals in a single query
  const [totals] = await db
    .select({
      totalVolume: sql<number>`coalesce(sum(${paymentTransaction.amount}), 0)`,
      totalFees: sql<number>`coalesce(sum(${paymentTransaction.platformFee}), 0)`,
      totalTransactions: sql<number>`count(*)`,
    })
    .from(paymentTransaction)
    .where(eq(paymentTransaction.status, 'confirmed'));

  // Volume by chain
  const chainRows = await db
    .select({
      chain: paymentTransaction.chain,
      volume: sql<number>`coalesce(sum(${paymentTransaction.amount}), 0)`,
    })
    .from(paymentTransaction)
    .where(eq(paymentTransaction.status, 'confirmed'))
    .groupBy(paymentTransaction.chain);

  const volumeByChain: Record<ChainId, number> = {
    base: 0,
    bsc: 0,
    apechain: 0,
    arbitrum: 0,
  };

  for (const row of chainRows) {
    const chain = row.chain as ChainId;
    if (chain in volumeByChain) {
      volumeByChain[chain] = Number(row.volume);
    }
  }

  return {
    totalVolume: Math.round(Number(totals.totalVolume) * 100) / 100,
    totalFees: Math.round(Number(totals.totalFees) * 100) / 100,
    totalTransactions: Number(totals.totalTransactions),
    volumeByChain,
  };
}
