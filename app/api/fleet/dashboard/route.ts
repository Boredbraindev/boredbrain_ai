import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import {
  externalAgent,
  agentWallet,
  walletTransaction,
  billingRecord,
} from '@/lib/db/schema';
import { sql, desc, eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const timeout = <T>(promise: Promise<T>) =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 5000),
        ),
      ]);

    const [
      fleetOverview,
      walletStats,
      topEarners,
      topActive,
      recentTransactions,
      specBreakdown,
      recentBilling,
      hourlyActivity,
    ] = await timeout(
      Promise.all([
        // 1. Fleet overview — total agents, online, total calls, total earned
        db
          .select({
            total: sql<number>`count(*)`,
            online: sql<number>`count(*) filter (where ${externalAgent.status} in ('active', 'verified'))`,
            totalCalls: sql<number>`coalesce(sum(${externalAgent.totalCalls}), 0)`,
            totalEarned: sql<number>`coalesce(sum(${externalAgent.totalEarned}), 0)`,
            avgRating: sql<number>`coalesce(avg(${externalAgent.rating}), 0)`,
            avgElo: sql<number>`coalesce(avg(${externalAgent.eloRating}), 1200)`,
          })
          .from(externalAgent),

        // 2. Wallet stats — total wallets, total balance, avg balance, total spent
        db
          .select({
            totalWallets: sql<number>`count(*)`,
            totalBalance: sql<number>`coalesce(sum(${agentWallet.balance}), 0)`,
            avgBalance: sql<number>`coalesce(avg(${agentWallet.balance}), 0)`,
            totalSpent: sql<number>`coalesce(sum(${agentWallet.totalSpent}), 0)`,
            activeWallets: sql<number>`count(*) filter (where ${agentWallet.isActive} = true)`,
          })
          .from(agentWallet),

        // 3. Top 10 earners with BSC address from metadata
        db
          .select({
            id: externalAgent.id,
            name: externalAgent.name,
            specialization: externalAgent.specialization,
            totalEarned: externalAgent.totalEarned,
            totalCalls: externalAgent.totalCalls,
            rating: externalAgent.rating,
            eloRating: externalAgent.eloRating,
            metadata: externalAgent.metadata,
          })
          .from(externalAgent)
          .orderBy(desc(externalAgent.totalEarned))
          .limit(10),

        // 4. Top 10 most active by calls
        db
          .select({
            id: externalAgent.id,
            name: externalAgent.name,
            specialization: externalAgent.specialization,
            totalCalls: externalAgent.totalCalls,
            totalEarned: externalAgent.totalEarned,
            rating: externalAgent.rating,
            metadata: externalAgent.metadata,
          })
          .from(externalAgent)
          .orderBy(desc(externalAgent.totalCalls))
          .limit(10),

        // 5. Recent wallet transactions (last 20)
        db
          .select({
            id: walletTransaction.id,
            agentId: walletTransaction.agentId,
            amount: walletTransaction.amount,
            type: walletTransaction.type,
            reason: walletTransaction.reason,
            timestamp: walletTransaction.timestamp,
            balanceAfter: walletTransaction.balanceAfter,
          })
          .from(walletTransaction)
          .orderBy(desc(walletTransaction.timestamp))
          .limit(20),

        // 6. Specialization breakdown
        db
          .select({
            specialization: externalAgent.specialization,
            count: sql<number>`count(*)`,
            totalCalls: sql<number>`coalesce(sum(${externalAgent.totalCalls}), 0)`,
            totalEarned: sql<number>`coalesce(sum(${externalAgent.totalEarned}), 0)`,
            avgRating: sql<number>`coalesce(avg(${externalAgent.rating}), 0)`,
          })
          .from(externalAgent)
          .groupBy(externalAgent.specialization)
          .orderBy(desc(sql`sum(${externalAgent.totalEarned})`)),

        // 7. Recent billing records (A2A activity)
        db
          .select({
            id: billingRecord.id,
            callerAgentId: billingRecord.callerAgentId,
            providerAgentId: billingRecord.providerAgentId,
            toolsUsed: billingRecord.toolsUsed,
            totalCost: billingRecord.totalCost,
            platformFee: billingRecord.platformFee,
            providerEarning: billingRecord.providerEarning,
            status: billingRecord.status,
            timestamp: billingRecord.timestamp,
          })
          .from(billingRecord)
          .orderBy(desc(billingRecord.timestamp))
          .limit(15),

        // 8. Hourly activity (last 24h)
        db
          .select({
            hour: sql<string>`to_char(${billingRecord.timestamp}, 'HH24:00')`,
            count: sql<number>`count(*)`,
            volume: sql<number>`coalesce(sum(${billingRecord.totalCost}), 0)`,
          })
          .from(billingRecord)
          .where(sql`${billingRecord.timestamp} > now() - interval '24 hours'`)
          .groupBy(sql`to_char(${billingRecord.timestamp}, 'HH24:00')`)
          .orderBy(sql`to_char(${billingRecord.timestamp}, 'HH24:00')`),
      ]),
    );

    // Enrich top earners with BSC address
    const enrichAgent = (a: any) => ({
      ...a,
      bscAddress: a.metadata?.bscAddress ?? null,
      metadata: undefined,
    });

    return apiSuccess({
      overview: {
        totalAgents: Number(fleetOverview[0]?.total ?? 0),
        onlineAgents: Number(fleetOverview[0]?.online ?? 0),
        totalCalls: Number(fleetOverview[0]?.totalCalls ?? 0),
        totalEarned: Number(fleetOverview[0]?.totalEarned ?? 0),
        avgRating: Number(Number(fleetOverview[0]?.avgRating ?? 0).toFixed(2)),
        avgElo: Math.round(Number(fleetOverview[0]?.avgElo ?? 1200)),
      },
      wallets: {
        totalWallets: Number(walletStats[0]?.totalWallets ?? 0),
        totalBalance: Number(walletStats[0]?.totalBalance ?? 0),
        avgBalance: Number(Number(walletStats[0]?.avgBalance ?? 0).toFixed(2)),
        totalSpent: Number(walletStats[0]?.totalSpent ?? 0),
        activeWallets: Number(walletStats[0]?.activeWallets ?? 0),
      },
      topEarners: topEarners.map(enrichAgent),
      topActive: topActive.map(enrichAgent),
      recentTransactions,
      specBreakdown: specBreakdown.map((s) => ({
        specialization: s.specialization,
        count: Number(s.count),
        totalCalls: Number(s.totalCalls),
        totalEarned: Number(s.totalEarned),
        avgRating: Number(Number(s.avgRating).toFixed(2)),
      })),
      recentBilling,
      hourlyActivity: hourlyActivity.map((h) => ({
        hour: h.hour,
        count: Number(h.count),
        volume: Number(h.volume),
      })),
    });
  } catch (error) {
    console.error('[fleet/dashboard] Error:', error);
    return apiError('Failed to fetch fleet dashboard data', 500);
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 30;
