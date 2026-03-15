export const runtime = 'edge';
import { NextRequest } from 'next/server';
import { agentFarm, LLM_PROVIDERS } from '@/lib/agent-farm';
import { apiError, apiSuccess } from '@/lib/api-utils';

/**
 * GET /api/agent-farm/[agentId] — Get single agent details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const agent = agentFarm.getAgent(agentId);
  if (!agent) {
    return apiError('Agent not found', 404);
  }

  const provider = LLM_PROVIDERS.find((p) => p.id === agent.provider);

  return apiSuccess({
    agent,
    provider: provider ?? null,
  });
}

/**
 * DELETE /api/agent-farm/[agentId] — Remove agent from the farm.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const agent = agentFarm.getAgent(agentId);
  if (!agent) {
    return apiError('Agent not found', 404);
  }

  agentFarm.removeAgent(agentId);

  return apiSuccess({
    removed: agentId,
    message: `Agent "${agent.name}" has been removed from the farm`,
  });
}
