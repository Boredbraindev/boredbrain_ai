export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

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
    const sql = neon(process.env.DATABASE_URL!);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );

    if (agentId) {
      // --- Agent-specific billing history + earnings ---
      let recordsQuery;
      let earningsQuery;

      if (type === 'caller') {
        recordsQuery = sql`
          SELECT * FROM billing_record
          WHERE caller_agent_id = ${agentId}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        earningsQuery = sql`
          SELECT COALESCE(SUM(total_cost), 0) as total_cost,
                 COALESCE(SUM(platform_fee), 0) as total_platform_fees,
                 COALESCE(SUM(provider_earning), 0) as total_provider_earnings,
                 COUNT(*) as transaction_count
          FROM billing_record
          WHERE caller_agent_id = ${agentId}
        `;
      } else if (type === 'provider') {
        recordsQuery = sql`
          SELECT * FROM billing_record
          WHERE provider_agent_id = ${agentId}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        earningsQuery = sql`
          SELECT COALESCE(SUM(total_cost), 0) as total_cost,
                 COALESCE(SUM(platform_fee), 0) as total_platform_fees,
                 COALESCE(SUM(provider_earning), 0) as total_provider_earnings,
                 COUNT(*) as transaction_count
          FROM billing_record
          WHERE provider_agent_id = ${agentId}
        `;
      } else {
        recordsQuery = sql`
          SELECT * FROM billing_record
          WHERE caller_agent_id = ${agentId} OR provider_agent_id = ${agentId}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        earningsQuery = sql`
          SELECT COALESCE(SUM(total_cost), 0) as total_cost,
                 COALESCE(SUM(platform_fee), 0) as total_platform_fees,
                 COALESCE(SUM(provider_earning), 0) as total_provider_earnings,
                 COUNT(*) as transaction_count
          FROM billing_record
          WHERE caller_agent_id = ${agentId} OR provider_agent_id = ${agentId}
        `;
      }

      const agentInfoQuery = sql`
        SELECT * FROM external_agent WHERE id = ${agentId} LIMIT 1
      `;

      const [records, earningsSummary, agentInfo] = await Promise.race([
        Promise.all([recordsQuery, earningsQuery, agentInfoQuery]),
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
        sql`
          SELECT * FROM billing_record
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COALESCE(SUM(total_cost), 0) as total_revenue,
                 COALESCE(SUM(platform_fee), 0) as platform_fees,
                 COALESCE(SUM(provider_earning), 0) as agent_payouts,
                 COUNT(*) as total_transactions
          FROM billing_record
        `,
      ]),
      timeout,
    ]);

    const stats = platformStats[0];
    const response = apiSuccess({
      platformRevenue: {
        totalRevenue: Number(stats?.total_revenue ?? 0),
        platformFees: Number(stats?.platform_fees ?? 0),
        agentPayouts: Number(stats?.agent_payouts ?? 0),
        totalTransactions: Number(stats?.total_transactions ?? 0),
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
