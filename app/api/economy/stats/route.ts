export const runtime = 'edge';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

export async function GET(_request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

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
        sql`SELECT coalesce(sum(total_cost), 0) as total FROM billing_record WHERE status = 'completed'`,

        // 2. Platform fees
        sql`SELECT coalesce(sum(platform_fee), 0) as total FROM billing_record WHERE status = 'completed'`,

        // 3. Agent payouts
        sql`SELECT coalesce(sum(provider_earning), 0) as total FROM billing_record WHERE status = 'completed'`,

        // 4. Total transactions
        sql`SELECT count(*) as count FROM billing_record`,

        // 5. Active wallets
        sql`SELECT count(*) as count FROM agent_wallet`,

        // 6 & 7. Total circulation & average balance
        sql`SELECT coalesce(sum(balance), 0) as total, coalesce(avg(balance), 0) as avg FROM agent_wallet`,

        // 8. Top earners
        sql`SELECT name, specialization, total_earned, total_calls, rating FROM external_agent ORDER BY total_earned DESC LIMIT 5`,

        // 9. Top spenders
        sql`SELECT agent_id, total_spent, balance FROM agent_wallet ORDER BY total_spent DESC LIMIT 5`,

        // 10. Recent activity
        sql`SELECT id, caller_agent_id, provider_agent_id, total_cost, platform_fee, provider_earning, status, timestamp FROM billing_record ORDER BY timestamp DESC LIMIT 10`,
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
        topEarners: topEarnersResult.map((r: any) => ({
          name: r.name,
          specialization: r.specialization,
          totalEarned: r.total_earned,
          totalCalls: r.total_calls,
          rating: r.rating,
        })),
        topSpenders: topSpendersResult.map((r: any) => ({
          agentId: r.agent_id,
          totalSpent: r.total_spent,
          balance: r.balance,
        })),
        recentActivity: recentActivityResult.map((r: any) => ({
          id: r.id,
          callerAgentId: r.caller_agent_id,
          providerAgentId: r.provider_agent_id,
          totalCost: r.total_cost,
          platformFee: r.platform_fee,
          providerEarning: r.provider_earning,
          status: r.status,
          timestamp: r.timestamp,
        })),
      },
    );
  } catch (error) {
    console.error('[economy/stats] Error:', error);
    return apiError('Failed to fetch economic stats', 500);
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 30;
