import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';

/**
 * GET /api/economy - Global economy stats + top earning agents
 */
export async function GET(_request: NextRequest) {
  try {
    const stats = agentEconomy.getEconomyStats();
    const recentTransactions = agentEconomy.getAllTransactions(20);

    return apiSuccess({
      stats: {
        totalVolume: stats.totalVolume,
        activeContracts: stats.activeContracts,
        completedContracts: stats.completedContracts,
        totalContracts: stats.totalContracts,
        totalDividends: stats.totalDividends,
        avgRevenuePerAgent: stats.avgRevenuePerAgent,
        totalAgents: stats.totalAgents,
      },
      topEarners: stats.topEarners,
      recentTransactions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch economy stats';
    return apiError(message, 500);
  }
}
