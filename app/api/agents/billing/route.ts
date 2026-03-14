export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { billingRecord, externalAgent, agentWallet, walletTransaction } from '@/lib/db/schema';
import { eq, or, desc, sql, and } from 'drizzle-orm';

/**
 * GET /api/agents/billing - Transparent billing data for DD audit
 *
 * Query params:
 *   ?agentId=xxx     - Get billing for specific agent
 *   ?type=caller|provider - Filter by role
 *   ?limit=50        - Pagination (max 100)
 *   ?offset=0        - Offset
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );

    if (agentId) {
      // --- Agent-specific billing history + earnings ---
      const billingCondition = type === 'caller'
        ? eq(billingRecord.callerAgentId, agentId)
        : type === 'provider'
          ? eq(billingRecord.providerAgentId, agentId)
          : or(
              eq(billingRecord.callerAgentId, agentId),
              eq(billingRecord.providerAgentId, agentId)
            );

      const [records, earningsSummary, agentInfo] = await Promise.race([
        Promise.all([
          db
            .select()
            .from(billingRecord)
            .where(billingCondition)
            .orderBy(desc(billingRecord.timestamp))
            .limit(limit)
            .offset(offset),
          db
            .select({
              totalCost: sql<number>`COALESCE(SUM(${billingRecord.totalCost}), 0)`,
              totalPlatformFees: sql<number>`COALESCE(SUM(${billingRecord.platformFee}), 0)`,
              totalProviderEarnings: sql<number>`COALESCE(SUM(${billingRecord.providerEarning}), 0)`,
              transactionCount: sql<number>`COUNT(*)`,
            })
            .from(billingRecord)
            .where(billingCondition),
          db
            .select()
            .from(externalAgent)
            .where(eq(externalAgent.id, agentId))
            .limit(1),
        ]),
        timeout,
      ]);

      const response = apiSuccess({
        agentId,
        agent: agentInfo[0] ?? null,
        earnings: earningsSummary[0] ?? null,
        records,
        pagination: { limit, offset, total: records.length },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return response;
    }

    // --- Platform-wide billing stats ---
    const [recentRecords, platformStats] = await Promise.race([
      Promise.all([
        db
          .select()
          .from(billingRecord)
          .orderBy(desc(billingRecord.timestamp))
          .limit(limit)
          .offset(offset),
        db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(${billingRecord.totalCost}), 0)`,
            platformFees: sql<number>`COALESCE(SUM(${billingRecord.platformFee}), 0)`,
            agentPayouts: sql<number>`COALESCE(SUM(${billingRecord.providerEarning}), 0)`,
            totalTransactions: sql<number>`COUNT(*)`,
          })
          .from(billingRecord),
      ]),
      timeout,
    ]);

    const stats = platformStats[0];
    const response = apiSuccess({
      platformRevenue: {
        totalRevenue: stats?.totalRevenue ?? 0,
        platformFees: stats?.platformFees ?? 0,
        agentPayouts: stats?.agentPayouts ?? 0,
        totalTransactions: stats?.totalTransactions ?? 0,
      },
      records: recentRecords,
      pagination: { limit, offset, total: recentRecords.length },
    });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'DB timeout') {
      return apiError('Database request timed out. Please try again.', 504);
    }
    return apiError(`Failed to fetch billing data: ${message}`, 500);
  }
}
