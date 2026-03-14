export const runtime = 'edge';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/economy - Global economy stats + top earning agents
 * DB-first with empty fallback. Each query wrapped independently.
 */
export async function GET(_request: NextRequest) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ success: true, data: emptyResponse() });
    }

    const sql = neon(dbUrl);

    // Query agent_wallet stats (this table exists for sure)
    let walletStats = { total_agents: 0, total_volume: 0, total_balance: 0 };
    try {
      const rows = await sql`
        SELECT count(*) as total_agents,
               coalesce(sum(total_spent), 0) as total_volume,
               coalesce(sum(balance), 0) as total_balance
        FROM agent_wallet
      `;
      if (rows[0]) walletStats = rows[0] as any;
    } catch { /* table may not exist */ }

    // Query billing_record stats (may not exist)
    let billingStats = { total_contracts: 0, completed_contracts: 0, total_fees: 0, active_24h: 0 };
    try {
      const rows = await sql`
        SELECT count(*) as total_contracts,
               count(*) filter (where status = 'completed') as completed_contracts,
               coalesce(sum(platform_fee), 0) as total_fees
        FROM billing_record
      `;
      if (rows[0]) billingStats = { ...billingStats, ...rows[0] as any };

      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const active = await sql`
        SELECT count(*) as cnt FROM billing_record WHERE created_at >= ${oneDayAgo}
      `;
      billingStats.active_24h = Number(active[0]?.cnt ?? 0);
    } catch { /* table may not exist */ }

    // Top earners from agent_wallet
    let topEarners: any[] = [];
    try {
      const rows = await sql`
        SELECT w.agent_id, w.balance, w.total_earned, w.total_spent,
               a.name as agent_name, a.specialization
        FROM agent_wallet w
        LEFT JOIN external_agent a ON a.id = w.agent_id
        ORDER BY w.total_earned DESC
        LIMIT 10
      `;
      topEarners = rows.map((w: any) => ({
        agentId: w.agent_id,
        agentName: w.agent_name ?? 'Unknown',
        specialization: w.specialization ?? 'general',
        balance: Number(w.balance ?? 0),
        totalEarned: Number(w.total_earned ?? 0),
        totalSpent: Number(w.total_spent ?? 0),
      }));
    } catch { /* */ }

    // Recent transactions from point_transaction (exists from BP system)
    let recentTxs: any[] = [];
    try {
      const rows = await sql`
        SELECT id, action, points, wallet_address, created_at
        FROM point_transaction
        ORDER BY created_at DESC
        LIMIT 20
      `;
      recentTxs = rows.map((tx: any) => ({
        id: tx.id,
        type: tx.action,
        amount: Number(tx.points ?? 0),
        currency: 'BP',
        wallet: tx.wallet_address,
        timestamp: tx.created_at,
      }));
    } catch { /* table may not exist */ }

    const totalVolume = Number(walletStats.total_volume ?? 0);
    const totalAgents = Number(walletStats.total_agents ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalVolume,
          totalBalance: Number(walletStats.total_balance ?? 0),
          activeContracts: billingStats.active_24h,
          completedContracts: Number(billingStats.completed_contracts ?? 0),
          totalContracts: Number(billingStats.total_contracts ?? 0),
          totalDividends: Number(billingStats.total_fees ?? 0),
          avgRevenuePerAgent: totalAgents > 0 ? +(totalVolume / totalAgents).toFixed(2) : 0,
          totalAgents,
        },
        topEarners,
        recentTransactions: recentTxs,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch economy stats';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function emptyResponse() {
  return {
    stats: { totalVolume: 0, totalBalance: 0, activeContracts: 0, completedContracts: 0, totalContracts: 0, totalDividends: 0, avgRevenuePerAgent: 0, totalAgents: 0 },
    topEarners: [],
    recentTransactions: [],
  };
}
