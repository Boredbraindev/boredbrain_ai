import { NextRequest, NextResponse } from 'next/server';
import {
  getRevenueStats,
  getBillingHistory,
  getAgentEarnings,
} from '@/lib/inter-agent-billing';
import { db } from '@/lib/db';
import { billingRecord } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import type { BillingRecord } from '@/lib/inter-agent-billing';

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

  // Agent-specific earnings summary
  if (agentId && type === 'earnings') {
    const earnings = await getAgentEarnings(agentId);
    return NextResponse.json({
      agentId,
      earnings,
    });
  }

  // Agent-specific billing history
  if (agentId) {
    const history = await getBillingHistory(agentId);
    return NextResponse.json({
      agentId,
      records: history,
      total: history.length,
    });
  }

  // Platform-wide stats + recent records
  const stats = await getRevenueStats();

  const rows = await db
    .select()
    .from(billingRecord)
    .orderBy(desc(billingRecord.timestamp))
    .limit(50);

  const recentRecords: BillingRecord[] = rows.map((row) => ({
    id: row.id,
    callerAgentId: row.callerAgentId,
    providerAgentId: row.providerAgentId,
    toolsUsed: row.toolsUsed,
    totalCost: row.totalCost,
    platformFee: row.platformFee,
    providerEarning: row.providerEarning,
    timestamp: row.timestamp.toISOString(),
    status: row.status as 'completed' | 'failed' | 'refunded',
  }));

  return NextResponse.json({
    stats,
    recentRecords,
  });
}
