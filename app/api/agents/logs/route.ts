import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { walletTransaction, agentWallet, externalAgent } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

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
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );

    if (agentId) {
      // --- Agent-specific wallet, transactions, and info ---
      const [wallet, transactions, agentInfo] = await Promise.race([
        Promise.all([
          db
            .select()
            .from(agentWallet)
            .where(eq(agentWallet.agentId, agentId))
            .limit(1),
          db
            .select()
            .from(walletTransaction)
            .where(eq(walletTransaction.agentId, agentId))
            .orderBy(desc(walletTransaction.timestamp))
            .limit(limit)
            .offset(offset),
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
        db
          .select({
            totalWallets: sql<number>`COUNT(*)`,
            totalBalance: sql<number>`COALESCE(SUM(${agentWallet.balance}), 0)`,
            totalTransactions: sql<number>`(SELECT COUNT(*) FROM wallet_transaction)`,
          })
          .from(agentWallet),
        db
          .select()
          .from(walletTransaction)
          .orderBy(desc(walletTransaction.timestamp))
          .limit(Math.min(limit, 50))
          .offset(offset),
      ]),
      timeout,
    ]);

    const stats = summaryStats[0];
    const response = apiSuccess({
      summary: {
        totalWallets: stats?.totalWallets ?? 0,
        totalBalance: stats?.totalBalance ?? 0,
        totalTransactions: stats?.totalTransactions ?? 0,
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
