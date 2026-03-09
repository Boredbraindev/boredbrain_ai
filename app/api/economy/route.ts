import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';
import { db } from '@/lib/db';
import { agentWallet, billingRecord, walletTransaction } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

/**
 * GET /api/economy - Global economy stats + top earning agents
 * DB-first with mock fallback
 */
export async function GET(_request: NextRequest) {
  try {
    // Try DB first
    let dbStats: any = null;
    let dbTopEarners: any[] = [];
    let dbRecentTxs: any[] = [];

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      // Run all DB queries in parallel
      const [walletsResult, billingResult, recentTxsResult] = await Promise.race([
        Promise.all([
          // Aggregate wallet stats
          db
            .select({
              totalAgents: sql<number>`count(*)`.as('total_agents'),
              totalVolume: sql<number>`coalesce(sum(${agentWallet.totalSpent}), 0)`.as('total_volume'),
              totalBalance: sql<number>`coalesce(sum(${agentWallet.balance}), 0)`.as('total_balance'),
            })
            .from(agentWallet),
          // Aggregate billing stats
          db
            .select({
              totalContracts: sql<number>`count(*)`.as('total_contracts'),
              completedContracts: sql<number>`count(*) filter (where ${billingRecord.status} = 'completed')`.as('completed_contracts'),
              totalBillingVolume: sql<number>`coalesce(sum(${billingRecord.totalCost}), 0)`.as('total_billing_volume'),
              totalPlatformFees: sql<number>`coalesce(sum(${billingRecord.platformFee}), 0)`.as('total_platform_fees'),
            })
            .from(billingRecord),
          // Recent transactions
          db
            .select()
            .from(walletTransaction)
            .orderBy(desc(walletTransaction.timestamp))
            .limit(20),
        ]),
        timeout,
      ]);

      const walletStats = walletsResult[0];
      const billingStats = billingResult[0];

      // Top earners: wallets ordered by totalSpent (as proxy for earnings)
      const topEarnersResult = await Promise.race([
        db
          .select()
          .from(agentWallet)
          .orderBy(desc(agentWallet.totalSpent))
          .limit(10),
        timeout,
      ]);

      dbTopEarners = topEarnersResult.map((w: any) => ({
        agentId: w.agentId,
        balance: w.balance,
        totalEarned: w.totalSpent, // totalSpent tracks total throughput
        totalSpent: w.totalSpent,
        dividendsPaid: 0,
        ownerAddress: w.address,
      }));

      dbRecentTxs = recentTxsResult.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        currency: 'USDT',
        fromAgentId: tx.type === 'debit' ? tx.agentId : null,
        toAgentId: tx.type === 'credit' ? tx.agentId : null,
        description: tx.reason,
        timestamp: tx.timestamp.toISOString(),
      }));

      const totalVolume = Number(walletStats?.totalVolume ?? 0) + Number(billingStats?.totalBillingVolume ?? 0);
      const totalAgents = Number(walletStats?.totalAgents ?? 0);

      dbStats = {
        totalVolume: +totalVolume.toFixed(2),
        activeContracts: 0, // billingRecord doesn't track active, only completed
        completedContracts: Number(billingStats?.completedContracts ?? 0),
        totalContracts: Number(billingStats?.totalContracts ?? 0),
        totalDividends: Number(billingStats?.totalPlatformFees ?? 0),
        avgRevenuePerAgent: totalAgents > 0 ? +(totalVolume / totalAgents).toFixed(2) : 0,
        totalAgents,
      };
    } catch {
      // DB failed, will use mock fallback
    }

    // If we got DB data, use it; otherwise fallback to in-memory mock
    if (dbStats && dbStats.totalAgents > 0) {
      return apiSuccess({
        stats: dbStats,
        topEarners: dbTopEarners,
        recentTransactions: dbRecentTxs,
      });
    }

    // Fallback to mock data
    const stats = agentEconomy.getEconomyStats();
    const recentTransactions = agentEconomy.getAllTransactions(20);

    return apiSuccess({
      stats: {
        totalVolume: stats.totalVolume,
        activeContracts: stats.activeContracts,
        completedContracts: stats.completedContracts,
        totalContracts: stats.totalContracts,
        totalDividends: stats.totalDividends,
        avgRevenuePerAgent: stats.avgRevenuePerAgent,
        totalAgents: stats.totalAgents,
      },
      topEarners: stats.topEarners,
      recentTransactions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch economy stats';
    return apiError(message, 500);
  }
}
