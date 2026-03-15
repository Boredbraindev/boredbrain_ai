export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/billing - Platform revenue stats + recent billing records.
 *
 * Query params:
 *   ?agentId=xxx           - billing history for a specific agent
 *   ?agentId=xxx&type=earnings  - earnings summary for a specific agent
 *
 * Without query params: returns platform-wide stats + all recent records.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const type = searchParams.get('type');

  const sql = neon(process.env.DATABASE_URL!);

  // Agent-specific earnings summary
  if (agentId && type === 'earnings') {
    // Sum earnings as provider
    const earnedRows = await sql`
      SELECT COALESCE(SUM(provider_earning), 0) AS total_earned
      FROM billing_record
      WHERE provider_agent_id = ${agentId} AND status = 'completed'
    `;

    // Sum spending as caller
    const spentRows = await sql`
      SELECT COALESCE(SUM(total_cost), 0) AS total_spent
      FROM billing_record
      WHERE caller_agent_id = ${agentId} AND status = 'completed'
    `;

    const totalEarned = Number(Number(earnedRows[0].total_earned).toFixed(4));
    const totalSpent = Number(Number(spentRows[0].total_spent).toFixed(4));

    return NextResponse.json({
      agentId,
      earnings: {
        totalEarned,
        totalSpent,
        netBalance: Number((totalEarned - totalSpent).toFixed(4)),
      },
    });
  }

  // Agent-specific billing history
  if (agentId) {
    const rows = await sql`
      SELECT * FROM billing_record
      WHERE caller_agent_id = ${agentId} OR provider_agent_id = ${agentId}
      ORDER BY timestamp DESC
    `;

    const records = rows.map((row) => ({
      id: row.id,
      callerAgentId: row.caller_agent_id,
      providerAgentId: row.provider_agent_id,
      toolsUsed: row.tools_used,
      totalCost: row.total_cost,
      platformFee: row.platform_fee,
      providerEarning: row.provider_earning,
      timestamp: row.timestamp,
      status: row.status,
    }));

    return NextResponse.json({
      agentId,
      records,
      total: records.length,
    });
  }

  // Platform-wide stats + recent records
  const statsRows = await sql`
    SELECT
      COALESCE(SUM(total_cost), 0) AS total_revenue,
      COALESCE(SUM(platform_fee), 0) AS platform_fees,
      COALESCE(SUM(provider_earning), 0) AS agent_payouts,
      COUNT(*) AS total_transactions
    FROM billing_record
    WHERE status = 'completed'
  `;

  const statsRow = statsRows[0];
  const stats = {
    totalRevenue: Number(Number(statsRow.total_revenue).toFixed(4)),
    platformFees: Number(Number(statsRow.platform_fees).toFixed(4)),
    agentPayouts: Number(Number(statsRow.agent_payouts).toFixed(4)),
    totalTransactions: Number(statsRow.total_transactions),
  };

  const rows = await sql`
    SELECT * FROM billing_record
    ORDER BY timestamp DESC
    LIMIT 50
  `;

  const recentRecords = rows.map((row) => ({
    id: row.id,
    callerAgentId: row.caller_agent_id,
    providerAgentId: row.provider_agent_id,
    toolsUsed: row.tools_used,
    totalCost: row.total_cost,
    platformFee: row.platform_fee,
    providerEarning: row.provider_earning,
    timestamp: row.timestamp,
    status: row.status,
  }));

  return NextResponse.json({
    stats,
    recentRecords,
  });
}
