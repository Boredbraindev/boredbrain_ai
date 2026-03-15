export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';
import { neon } from '@neondatabase/serverless';

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
      const sql = neon(process.env.DATABASE_URL!);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const [walletRows, txRows, billingRows] = await Promise.race([
        Promise.all([
          sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId}`,
          sql`SELECT * FROM wallet_transaction WHERE agent_id = ${agentId} ORDER BY timestamp DESC LIMIT 50`,
          sql`SELECT * FROM billing_record WHERE caller_agent_id = ${agentId} OR provider_agent_id = ${agentId} ORDER BY timestamp DESC LIMIT 20`,
        ]),
        timeout,
      ]);

      if (walletRows.length > 0) {
        const w = walletRows[0];
        const wallet = {
          agentId: w.agent_id,
          balance: w.balance,
          totalEarned: w.total_spent, // totalSpent as throughput proxy
          totalSpent: w.total_spent,
          dividendsPaid: 0,
          ownerAddress: w.address,
          transactions: txRows.map((tx: any) => ({
            id: tx.id,
            type: tx.type as string,
            amount: tx.amount,
            currency: 'BBAI' as const,
            fromAgentId: tx.type === 'debit' ? tx.agent_id : null,
            toAgentId: tx.type === 'credit' ? tx.agent_id : null,
            description: tx.reason,
            timestamp: new Date(tx.timestamp).toISOString(),
          })),
        };

        const contracts = billingRows.map((b: any) => ({
          id: b.id,
          hiringAgentId: b.caller_agent_id,
          hiredAgentId: b.provider_agent_id,
          task: `Billing: ${(b.tools_used as string[])?.join(', ') || 'agent call'}`,
          budget: b.total_cost,
          status: b.status as string,
          result: b.status === 'completed' ? 'Completed' : null,
          cost: b.total_cost,
          createdAt: new Date(b.timestamp).toISOString(),
          completedAt: b.status === 'completed' ? new Date(b.timestamp).toISOString() : null,
        }));

        const revenueShare = {
          agentId,
          ownerAddress: w.address,
          totalRevenue: w.total_spent,
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
