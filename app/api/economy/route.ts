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
        SELECT count(*) as cnt FROM billing_record WHERE timestamp >= ${oneDayAgo}
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

    // Fallback: if no wallet data, pull top earners from external_agent table
    if (topEarners.length === 0) {
      try {
        const rows = await sql`
          SELECT id, name, specialization, total_earned, total_calls, rating
          FROM external_agent
          WHERE total_earned > 0
          ORDER BY total_earned DESC
          LIMIT 10
        `;
        topEarners = rows.map((a: any) => ({
          agentId: a.id,
          agentName: a.name ?? 'Unknown',
          specialization: a.specialization ?? 'general',
          balance: Number(a.total_earned ?? 0),
          totalEarned: Number(a.total_earned ?? 0),
          totalSpent: 0,
        }));
      } catch { /* */ }
    }

    // If wallet stats are empty, enrich from external_agent
    if (Number(walletStats.total_agents) === 0) {
      try {
        const agentRows = await sql`
          SELECT count(*) as cnt,
                 coalesce(sum(total_earned), 0) as total_earned
          FROM external_agent
          WHERE status IN ('active', 'verified')
        `;
        if (agentRows[0]) {
          walletStats.total_agents = Number(agentRows[0].cnt ?? 0);
          walletStats.total_volume = Number(agentRows[0].total_earned ?? 0);
        }
      } catch { /* */ }
    }

    // Recent transactions — combine billing_record, wallet_transaction, and point_transaction
    let recentTxs: any[] = [];

    // 1) billing_record (agent-to-agent payments) — column is "timestamp" not "created_at"
    try {
      const rows = await sql`
        SELECT br.id, br.caller_agent_id, br.provider_agent_id, br.total_cost,
               br.platform_fee, br.provider_earning, br.status, br.timestamp,
               ca.name as caller_name, pa.name as provider_name
        FROM billing_record br
        LEFT JOIN external_agent ca ON ca.id = br.caller_agent_id
        LEFT JOIN external_agent pa ON pa.id = br.provider_agent_id
        WHERE br.status = 'completed'
        ORDER BY br.timestamp DESC
        LIMIT 15
      `;
      for (const r of rows) {
        recentTxs.push({
          id: r.id,
          type: 'a2a_payment',
          amount: Number(r.total_cost ?? 0),
          currency: 'BBAI',
          wallet: r.caller_agent_id,
          fromAgentId: r.caller_agent_id,
          fromAgentName: r.caller_name ?? 'Unknown',
          toAgentId: r.provider_agent_id,
          toAgentName: r.provider_name ?? 'Unknown',
          description: `${r.caller_name ?? 'Agent'} → ${r.provider_name ?? 'Agent'} (${Number(r.provider_earning ?? 0).toFixed(2)} BBAI)`,
          timestamp: r.timestamp,
        });
      }
    } catch { /* table may not exist */ }

    // 2) wallet_transaction (credits/debits) — column is "timestamp" not "created_at"
    try {
      const rows = await sql`
        SELECT wt.id, wt.agent_id, wt.amount, wt.type, wt.reason, wt.balance_after, wt.timestamp,
               a.name as agent_name
        FROM wallet_transaction wt
        LEFT JOIN external_agent a ON a.id = wt.agent_id
        WHERE wt.reason NOT IN ('Initial wallet funding', 'Wallet top-up')
        ORDER BY wt.timestamp DESC
        LIMIT 15
      `;
      for (const r of rows) {
        recentTxs.push({
          id: r.id,
          type: r.type === 'credit' ? 'earning' : 'spending',
          amount: Number(r.amount ?? 0),
          currency: 'BBAI',
          wallet: r.agent_id,
          fromAgentId: r.type === 'debit' ? r.agent_id : null,
          toAgentId: r.type === 'credit' ? r.agent_id : null,
          description: `${r.agent_name ?? 'Agent'}: ${r.reason ?? r.type}`,
          timestamp: r.timestamp,
        });
      }
    } catch { /* table may not exist */ }

    // 3) point_transaction (BP points — correct column names: amount, reason)
    try {
      const rows = await sql`
        SELECT id, reason, amount, wallet_address, created_at
        FROM point_transaction
        ORDER BY created_at DESC
        LIMIT 10
      `;
      for (const tx of rows) {
        recentTxs.push({
          id: tx.id,
          type: 'earning',
          amount: Number(tx.amount ?? 0),
          currency: 'BP',
          wallet: tx.wallet_address,
          description: `BP: ${tx.reason ?? 'points'}`,
          timestamp: tx.created_at,
        });
      }
    } catch { /* table may not exist */ }

    // Sort combined feed by timestamp descending, take top 20
    recentTxs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    recentTxs = recentTxs.slice(0, 20);

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
