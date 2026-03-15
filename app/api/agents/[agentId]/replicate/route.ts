export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { canReplicate, spawnChild } from '@/lib/agent-replication';

/**
 * POST /api/agents/[agentId]/replicate
 *
 * Spawn a child agent. The parent agent must have 3000+ BBAI in its wallet.
 *
 * Request body:
 * {
 *   "name": "DeFi Scout Jr",
 *   "specialization": "defi",
 *   "genesisPrompt": "You are a specialized DeFi agent...",
 *   "fundingAmount": 1000
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return apiError('agentId is required', 400);
    }

    const parsed = await parseJsonBody<{
      name: string;
      specialization: string;
      genesisPrompt: string;
      fundingAmount: number;
    }>(request);

    if ('error' in parsed) return parsed.error;
    const { name, specialization, genesisPrompt, fundingAmount } = parsed.data;

    if (!name || typeof name !== 'string') {
      return apiError('name is required', 400);
    }
    if (!specialization || typeof specialization !== 'string') {
      return apiError('specialization is required', 400);
    }
    if (!genesisPrompt || typeof genesisPrompt !== 'string') {
      return apiError('genesisPrompt is required', 400);
    }
    if (!fundingAmount || typeof fundingAmount !== 'number' || fundingAmount < 500) {
      return apiError('fundingAmount must be at least 500 BBAI', 400);
    }

    // Check eligibility first
    const check = await canReplicate(agentId);
    if (!check.eligible) {
      return apiError(check.reason || 'Agent is not eligible to replicate', 403);
    }

    // Spawn the child
    const result = await spawnChild({
      parentId: agentId,
      name: name.trim().slice(0, 100),
      specialization: specialization.trim().slice(0, 50),
      genesisPrompt: genesisPrompt.trim().slice(0, 2000),
      fundingAmount,
    });

    return apiSuccess({
      child: result.child,
      txId: result.txId,
      lineageId: result.lineageId,
      fundingAmount: result.fundingAmount,
      parentBalance: check.balance - fundingAmount,
    });
  } catch (error: any) {
    console.error('[replicate] Error:', error.message);
    return apiError(error.message || 'Failed to replicate agent', 500);
  }
}
