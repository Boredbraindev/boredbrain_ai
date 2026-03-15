export const runtime = 'edge';

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
        // 1. Fleet overview
        sql`
          SELECT
            count(*) as total,
            count(*) filter (where status in ('active', 'verified')) as online,
            coalesce(sum(total_calls), 0) as total_calls,
            coalesce(sum(total_earned), 0) as total_earned,
            coalesce(avg(rating), 0) as avg_rating,
            coalesce(avg(elo_rating), 1200) as avg_elo
          FROM external_agent
        `,

        // 2. Wallet stats
        sql`
          SELECT
            count(*) as total_wallets,
            coalesce(sum(balance), 0) as total_balance,
            coalesce(avg(balance), 0) as avg_balance,
            coalesce(sum(total_spent), 0) as total_spent,
            count(*) filter (where is_active = true) as active_wallets
          FROM agent_wallet
        `,

        // 3. Top 10 earners
        sql`
          SELECT id, name, specialization, total_earned, total_calls, rating, elo_rating, metadata
          FROM external_agent
          ORDER BY total_earned DESC
          LIMIT 10
        `,

        // 4. Top 10 most active by calls
        sql`
          SELECT id, name, specialization, total_calls, total_earned, rating, metadata
          FROM external_agent
          ORDER BY total_calls DESC
          LIMIT 10
        `,

        // 5. Recent wallet transactions (last 20)
        sql`
          SELECT id, agent_id, amount, type, reason, timestamp, balance_after
          FROM wallet_transaction
          ORDER BY timestamp DESC
          LIMIT 20
        `,

        // 6. Specialization breakdown
        sql`
          SELECT
            specialization,
            count(*) as count,
            coalesce(sum(total_calls), 0) as total_calls,
            coalesce(sum(total_earned), 0) as total_earned,
            coalesce(avg(rating), 0) as avg_rating
          FROM external_agent
          GROUP BY specialization
          ORDER BY sum(total_earned) DESC
        `,

        // 7. Recent billing records (A2A activity)
        sql`
          SELECT id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status, timestamp
          FROM billing_record
          ORDER BY timestamp DESC
          LIMIT 15
        `,

        // 8. Hourly activity (last 24h)
        sql`
          SELECT
            to_char(timestamp, 'HH24:00') as hour,
            count(*) as count,
            coalesce(sum(total_cost), 0) as volume
          FROM billing_record
          WHERE timestamp > now() - interval '24 hours'
          GROUP BY to_char(timestamp, 'HH24:00')
          ORDER BY to_char(timestamp, 'HH24:00')
        `,
      ]),
    );

    // Enrich top earners with BSC address
    const enrichAgent = (a: any) => ({
      id: a.id,
      name: a.name,
      specialization: a.specialization,
      totalEarned: a.total_earned,
      totalCalls: a.total_calls,
      rating: a.rating,
      eloRating: a.elo_rating,
      bscAddress: a.metadata?.bscAddress ?? null,
    });

    return apiSuccess({
      overview: {
        totalAgents: Number(fleetOverview[0]?.total ?? 0),
        onlineAgents: Number(fleetOverview[0]?.online ?? 0),
        totalCalls: Number(fleetOverview[0]?.total_calls ?? 0),
        totalEarned: Number(fleetOverview[0]?.total_earned ?? 0),
        avgRating: Number(Number(fleetOverview[0]?.avg_rating ?? 0).toFixed(2)),
        avgElo: Math.round(Number(fleetOverview[0]?.avg_elo ?? 1200)),
      },
      wallets: {
        totalWallets: Number(walletStats[0]?.total_wallets ?? 0),
        totalBalance: Number(walletStats[0]?.total_balance ?? 0),
        avgBalance: Number(Number(walletStats[0]?.avg_balance ?? 0).toFixed(2)),
        totalSpent: Number(walletStats[0]?.total_spent ?? 0),
        activeWallets: Number(walletStats[0]?.active_wallets ?? 0),
      },
      topEarners: topEarners.map(enrichAgent),
      topActive: topActive.map(enrichAgent),
      recentTransactions: recentTransactions.map((t: any) => ({
        id: t.id,
        agentId: t.agent_id,
        amount: t.amount,
        type: t.type,
        reason: t.reason,
        timestamp: t.timestamp,
        balanceAfter: t.balance_after,
      })),
      specBreakdown: specBreakdown.map((s: any) => ({
        specialization: s.specialization,
        count: Number(s.count),
        totalCalls: Number(s.total_calls),
        totalEarned: Number(s.total_earned),
        avgRating: Number(Number(s.avg_rating).toFixed(2)),
      })),
      recentBilling: recentBilling.map((b: any) => ({
        id: b.id,
        callerAgentId: b.caller_agent_id,
        providerAgentId: b.provider_agent_id,
        toolsUsed: b.tools_used,
        totalCost: b.total_cost,
        platformFee: b.platform_fee,
        providerEarning: b.provider_earning,
        status: b.status,
        timestamp: b.timestamp,
      })),
      hourlyActivity: hourlyActivity.map((h: any) => ({
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
