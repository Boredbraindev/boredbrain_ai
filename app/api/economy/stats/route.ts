export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { billingRecord, agentWallet, walletTransaction, externalAgent } from '@/lib/db/schema';
import { sql, desc } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const timeout = <T>(promise: Promise<T>) =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
      ]);

    const [
      volumeResult,
      platformFeesResult,
      agentPayoutsResult,
      totalTransactionsResult,
      activeWalletsResult,
      circulationResult,
      topEarnersResult,
      topSpendersResult,
      recentActivityResult,
    ] = await timeout(
      Promise.all([
        // 1. Total billing volume
        db
          .select({ total: sql<number>`coalesce(sum(${billingRecord.totalCost}), 0)` })
          .from(billingRecord)
          .where(sql`${billingRecord.status} = 'completed'`),

        // 2. Platform fees
        db
          .select({ total: sql<number>`coalesce(sum(${billingRecord.platformFee}), 0)` })
          .from(billingRecord)
          .where(sql`${billingRecord.status} = 'completed'`),

        // 3. Agent payouts
        db
          .select({ total: sql<number>`coalesce(sum(${billingRecord.providerEarning}), 0)` })
          .from(billingRecord)
          .where(sql`${billingRecord.status} = 'completed'`),

        // 4. Total transactions
        db
          .select({ count: sql<number>`count(*)` })
          .from(billingRecord),

        // 5. Active wallets
        db
          .select({ count: sql<number>`count(*)` })
          .from(agentWallet),

        // 6 & 7. Total circulation & average balance
        db
          .select({
            total: sql<number>`coalesce(sum(${agentWallet.balance}), 0)`,
            avg: sql<number>`coalesce(avg(${agentWallet.balance}), 0)`,
          })
          .from(agentWallet),

        // 8. Top earners
        db
          .select({
            name: externalAgent.name,
            specialization: externalAgent.specialization,
            totalEarned: externalAgent.totalEarned,
            totalCalls: externalAgent.totalCalls,
            rating: externalAgent.rating,
          })
          .from(externalAgent)
          .orderBy(desc(externalAgent.totalEarned))
          .limit(5),

        // 9. Top spenders
        db
          .select({
            agentId: agentWallet.agentId,
            totalSpent: agentWallet.totalSpent,
            balance: agentWallet.balance,
          })
          .from(agentWallet)
          .orderBy(desc(agentWallet.totalSpent))
          .limit(5),

        // 10. Recent activity
        db
          .select({
            id: billingRecord.id,
            callerAgentId: billingRecord.callerAgentId,
            providerAgentId: billingRecord.providerAgentId,
            totalCost: billingRecord.totalCost,
            platformFee: billingRecord.platformFee,
            providerEarning: billingRecord.providerEarning,
            status: billingRecord.status,
            timestamp: billingRecord.timestamp,
          })
          .from(billingRecord)
          .orderBy(desc(billingRecord.timestamp))
          .limit(10),
      ]),
    );

    return apiSuccess(
      {
        volume: Number(volumeResult[0]?.total ?? 0),
        platformFees: Number(platformFeesResult[0]?.total ?? 0),
        agentPayouts: Number(agentPayoutsResult[0]?.total ?? 0),
        totalTransactions: Number(totalTransactionsResult[0]?.count ?? 0),
        activeWallets: Number(activeWalletsResult[0]?.count ?? 0),
        totalCirculation: Number(circulationResult[0]?.total ?? 0),
        avgWalletBalance: Number(circulationResult[0]?.avg ?? 0),
        topEarners: topEarnersResult,
        topSpenders: topSpendersResult,
        recentActivity: recentActivityResult,
      },
    );
  } catch (error) {
    console.error('[economy/stats] Error:', error);
    return apiError('Failed to fetch economic stats', 500);
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 30;
