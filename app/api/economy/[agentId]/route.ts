import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';
import { db } from '@/lib/db';
import { agentWallet, walletTransaction, billingRecord } from '@/lib/db/schema';
import { eq, or, desc } from 'drizzle-orm';

/**
 * GET /api/economy/[agentId] - Agent wallet + transactions + revenue share
 * DB-first with mock fallback
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  try {
    // Try DB first
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const [walletRows, txRows, billingRows] = await Promise.race([
        Promise.all([
          db.select().from(agentWallet).where(eq(agentWallet.agentId, agentId)),
          db
            .select()
            .from(walletTransaction)
            .where(eq(walletTransaction.agentId, agentId))
            .orderBy(desc(walletTransaction.timestamp))
            .limit(50),
          db
            .select()
            .from(billingRecord)
            .where(
              or(
                eq(billingRecord.callerAgentId, agentId),
                eq(billingRecord.providerAgentId, agentId),
              ),
            )
            .orderBy(desc(billingRecord.timestamp))
            .limit(20),
        ]),
        timeout,
      ]);

      if (walletRows.length > 0) {
        const w = walletRows[0];
        const wallet = {
          agentId: w.agentId,
          balance: w.balance,
          totalEarned: w.totalSpent, // totalSpent as throughput proxy
          totalSpent: w.totalSpent,
          dividendsPaid: 0,
          ownerAddress: w.address,
          transactions: txRows.map((tx: any) => ({
            id: tx.id,
            type: tx.type as string,
            amount: tx.amount,
            currency: 'BBAI' as const,
            fromAgentId: tx.type === 'debit' ? tx.agentId : null,
            toAgentId: tx.type === 'credit' ? tx.agentId : null,
            description: tx.reason,
            timestamp: tx.timestamp.toISOString(),
          })),
        };

        const contracts = billingRows.map((b: any) => ({
          id: b.id,
          hiringAgentId: b.callerAgentId,
          hiredAgentId: b.providerAgentId,
          task: `Billing: ${(b.toolsUsed as string[]).join(', ') || 'agent call'}`,
          budget: b.totalCost,
          status: b.status as string,
          result: b.status === 'completed' ? 'Completed' : null,
          cost: b.totalCost,
          createdAt: b.timestamp.toISOString(),
          completedAt: b.status === 'completed' ? b.timestamp.toISOString() : null,
        }));

        const revenueShare = {
          agentId,
          ownerAddress: w.address,
          totalRevenue: w.totalSpent,
          ownerShare: 70,
          platformShare: 20,
          stakersShare: 10,
          lastDistribution: null,
          pendingDividend: 0,
        };

        return apiSuccess({ wallet, revenueShare, contracts });
      }
    } catch {
      // DB failed, fall through to mock
    }

    // Fallback to mock data
    const wallet = agentEconomy.getWallet(agentId);
    const revenueShare = agentEconomy.getRevenueShare(agentId);
    const contracts = agentEconomy.getContracts(agentId);

    return apiSuccess({ wallet, revenueShare, contracts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch agent economy data';
    return apiError(message, 500);
  }
}

/**
 * POST /api/economy/[agentId] - Trigger dividend distribution
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  try {
    const result = agentEconomy.distributeDividends(agentId);

    if (!result) {
      return apiError('No pending dividends to distribute', 400);
    }

    const wallet = agentEconomy.getWallet(agentId);
    const revenueShare = agentEconomy.getRevenueShare(agentId);

    return apiSuccess({
      distribution: result,
      wallet,
      revenueShare,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to distribute dividends';
    return apiError(message, 500);
  }
}
