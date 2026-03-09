/**
 * Inter-Agent Billing System
 *
 * Handles automatic USDT settlement when Agent A calls Agent B.
 * Revenue is split 85% to the provider agent and 15% platform fee.
 * All data is persisted via Drizzle ORM (PostgreSQL).
 */

import { db } from '@/lib/db';
import { billingRecord } from '@/lib/db/schema';
import { eq, or, desc, sql } from 'drizzle-orm';
import {
  deductBalance,
  topUpWallet,
  getAgentWallet,
  createAgentWallet,
} from '@/lib/agent-wallet';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLATFORM_FEE_PERCENT = 15;
const PROVIDER_SHARE_PERCENT = 100 - PLATFORM_FEE_PERCENT; // 85

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BillingRecord {
  id: string;
  callerAgentId: string;
  providerAgentId: string;
  toolsUsed: string[];
  totalCost: number;
  platformFee: number;
  providerEarning: number;
  timestamp: string;
  status: 'completed' | 'failed' | 'refunded';
}

export interface AgentEarnings {
  totalEarned: number;
  totalSpent: number;
  netBalance: number;
}

export interface RevenueStats {
  totalRevenue: number;
  platformFees: number;
  agentPayouts: number;
  totalTransactions: number;
}

export interface SettlementResult {
  success: boolean;
  billingId: string;
  breakdown: {
    totalCost: number;
    platformFee: number;
    providerEarning: number;
    callerAgentId: string;
    providerAgentId: string;
    toolsUsed: string[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateSplit(totalCost: number) {
  const platformFee = Number(((totalCost * PLATFORM_FEE_PERCENT) / 100).toFixed(4));
  const providerEarning = Number(((totalCost * PROVIDER_SHARE_PERCENT) / 100).toFixed(4));
  return { platformFee, providerEarning };
}

function toBillingRecord(row: typeof billingRecord.$inferSelect): BillingRecord {
  return {
    id: row.id,
    callerAgentId: row.callerAgentId,
    providerAgentId: row.providerAgentId,
    toolsUsed: row.toolsUsed,
    totalCost: row.totalCost,
    platformFee: row.platformFee,
    providerEarning: row.providerEarning,
    timestamp: row.timestamp.toISOString(),
    status: row.status as 'completed' | 'failed' | 'refunded',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a billing record without performing wallet settlement.
 * Used for recording historical / pre-seeded data.
 */
export async function createBillingRecord(
  callerAgentId: string,
  providerAgentId: string,
  toolsUsed: string[],
  totalCost: number,
): Promise<BillingRecord> {
  const { platformFee, providerEarning } = calculateSplit(totalCost);

  const [row] = await db
    .insert(billingRecord)
    .values({
      callerAgentId,
      providerAgentId,
      toolsUsed,
      totalCost,
      platformFee,
      providerEarning,
      status: 'completed',
    })
    .returning();

  return toBillingRecord(row);
}

/**
 * Get all billing records where the given agent was either caller or provider.
 */
export async function getBillingHistory(agentId: string): Promise<BillingRecord[]> {
  const rows = await db
    .select()
    .from(billingRecord)
    .where(
      or(
        eq(billingRecord.callerAgentId, agentId),
        eq(billingRecord.providerAgentId, agentId),
      ),
    )
    .orderBy(desc(billingRecord.timestamp));

  return rows.map(toBillingRecord);
}

/**
 * Calculate earnings summary for an agent across all billing records.
 * Uses SQL aggregation for efficiency.
 */
export async function getAgentEarnings(agentId: string): Promise<AgentEarnings> {
  // Sum earnings as provider
  const [earnedRow] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(${billingRecord.providerEarning}), 0)`,
    })
    .from(billingRecord)
    .where(
      sql`${billingRecord.providerAgentId} = ${agentId} AND ${billingRecord.status} = 'completed'`,
    );

  // Sum spending as caller
  const [spentRow] = await db
    .select({
      totalSpent: sql<number>`coalesce(sum(${billingRecord.totalCost}), 0)`,
    })
    .from(billingRecord)
    .where(
      sql`${billingRecord.callerAgentId} = ${agentId} AND ${billingRecord.status} = 'completed'`,
    );

  const totalEarned = Number(Number(earnedRow.totalEarned).toFixed(4));
  const totalSpent = Number(Number(spentRow.totalSpent).toFixed(4));

  return {
    totalEarned,
    totalSpent,
    netBalance: Number((totalEarned - totalSpent).toFixed(4)),
  };
}

/**
 * Get platform-wide revenue statistics.
 * Uses SQL aggregation for efficiency.
 */
export async function getRevenueStats(): Promise<RevenueStats> {
  const [row] = await db
    .select({
      totalRevenue: sql<number>`coalesce(sum(${billingRecord.totalCost}), 0)`,
      platformFees: sql<number>`coalesce(sum(${billingRecord.platformFee}), 0)`,
      agentPayouts: sql<number>`coalesce(sum(${billingRecord.providerEarning}), 0)`,
      totalTransactions: sql<number>`count(*)`,
    })
    .from(billingRecord)
    .where(eq(billingRecord.status, 'completed'));

  return {
    totalRevenue: Number(Number(row.totalRevenue).toFixed(4)),
    platformFees: Number(Number(row.platformFees).toFixed(4)),
    agentPayouts: Number(Number(row.agentPayouts).toFixed(4)),
    totalTransactions: Number(row.totalTransactions),
  };
}

/**
 * Full settlement flow:
 * 1. Deducts totalCost from the caller agent's wallet
 * 2. Credits 85% (providerEarning) to the provider agent's wallet
 * 3. The remaining 15% is retained as a platform fee
 * 4. Creates a billing record
 *
 * Auto-creates wallets for agents that don't yet have one.
 */
export async function settleBilling(
  callerAgentId: string,
  providerAgentId: string,
  toolsUsed: string[],
  totalCost: number,
): Promise<SettlementResult> {
  const { platformFee, providerEarning } = calculateSplit(totalCost);

  // Ensure both agents have wallets (auto-create if missing)
  if (!(await getAgentWallet(callerAgentId))) {
    await createAgentWallet(callerAgentId);
  }
  if (!(await getAgentWallet(providerAgentId))) {
    await createAgentWallet(providerAgentId);
  }

  // Step 1: Deduct full cost from caller
  const deductResult = await deductBalance(
    callerAgentId,
    totalCost,
    `Inter-agent billing: called ${providerAgentId} using [${toolsUsed.join(', ')}]`,
  );

  if (!deductResult.success) {
    // Record the failed billing attempt
    const [failedRow] = await db
      .insert(billingRecord)
      .values({
        callerAgentId,
        providerAgentId,
        toolsUsed,
        totalCost,
        platformFee,
        providerEarning,
        status: 'failed',
      })
      .returning();

    return {
      success: false,
      billingId: failedRow.id,
      breakdown: {
        totalCost,
        platformFee,
        providerEarning,
        callerAgentId,
        providerAgentId,
        toolsUsed,
      },
    };
  }

  // Step 2: Credit 85% to provider
  await topUpWallet(providerAgentId, providerEarning);

  // Step 3: Record the completed billing
  const [row] = await db
    .insert(billingRecord)
    .values({
      callerAgentId,
      providerAgentId,
      toolsUsed,
      totalCost,
      platformFee,
      providerEarning,
      status: 'completed',
    })
    .returning();

  return {
    success: true,
    billingId: row.id,
    breakdown: {
      totalCost,
      platformFee,
      providerEarning,
      callerAgentId,
      providerAgentId,
      toolsUsed,
    },
  };
}
