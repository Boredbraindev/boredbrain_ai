export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/agents/logs - Real-time call logs and wallet transactions
 *
 * Query params:
 *   ?agentId=xxx  - Filter by agent
 *   ?limit=50     - Pagination (max 200)
 *   ?offset=0     - Offset
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );

    if (agentId) {
      // --- Agent-specific wallet, transactions, and info ---
      const [wallet, transactions, agentInfo] = await Promise.race([
        Promise.all([
          sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`,
          sql`
            SELECT * FROM wallet_transaction
            WHERE agent_id = ${agentId}
            ORDER BY timestamp DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`SELECT * FROM external_agent WHERE id = ${agentId} LIMIT 1`,
        ]),
        timeout,
      ]);

      const response = apiSuccess({
        agentId,
        agent: agentInfo[0] ?? null,
        wallet: wallet[0] ?? null,
        transactions,
        pagination: { limit, offset, total: transactions.length },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
      return response;
    }

    // --- Platform-wide summary + recent transactions ---
    const [summaryStats, recentTransactions] = await Promise.race([
      Promise.all([
        sql`
          SELECT COUNT(*) as total_wallets,
                 COALESCE(SUM(balance), 0) as total_balance,
                 (SELECT COUNT(*) FROM wallet_transaction) as total_transactions
          FROM agent_wallet
        `,
        sql`
          SELECT * FROM wallet_transaction
          ORDER BY timestamp DESC
          LIMIT ${Math.min(limit, 50)} OFFSET ${offset}
        `,
      ]),
      timeout,
    ]);

    const stats = summaryStats[0];
    const response = apiSuccess({
      summary: {
        totalWallets: Number(stats?.total_wallets ?? 0),
        totalBalance: Number(stats?.total_balance ?? 0),
        totalTransactions: Number(stats?.total_transactions ?? 0),
      },
      recentTransactions,
      pagination: { limit: Math.min(limit, 50), offset, total: recentTransactions.length },
    });
    response.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'DB timeout') {
      return apiError('Database request timed out. Please try again.', 504);
    }
    return apiError(`Failed to fetch logs: ${message}`, 500);
  }
}
