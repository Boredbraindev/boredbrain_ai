export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getEvolutionScore,
  getEvolutionHistory,
  evolveAgent,
} from '@/lib/agent-evolution';

/**
 * GET /api/agents/[agentId]/evolution
 *
 * Get evolution history and performance score for an agent.
 *
 * Query params:
 *   ?history=true  — include full event history (default: false)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return apiError('agentId is required', 400);
    }

    const includeHistory =
      request.nextUrl.searchParams.get('history') === 'true';

    const score = await getEvolutionScore(agentId);

    let history = undefined;
    if (includeHistory) {
      history = await getEvolutionHistory(agentId);
    }

    return apiSuccess({
      score,
      ...(history !== undefined ? { history } : {}),
    });
  } catch (error: any) {
    console.error('[evolution GET] Error:', error.message);
    return apiError('Failed to get evolution data', 500);
  }
}

/**
 * POST /api/agents/[agentId]/evolution
 *
 * Trigger a manual evolution attempt. The agent must have at least 10
 * recorded events (battles, invocations) before it can evolve.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return apiError('agentId is required', 400);
    }

    const result = await evolveAgent(agentId);

    return apiSuccess({
      evolved: result.improved,
      changes: result.changes,
      newScore: result.newScore,
    });
  } catch (error: any) {
    console.error('[evolution POST] Error:', error.message);
    return apiError(error.message || 'Failed to evolve agent', 500);
  }
}
