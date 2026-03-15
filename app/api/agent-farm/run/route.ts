export const runtime = 'edge';
import { NextRequest } from 'next/server';
import { agentFarm } from '@/lib/agent-farm';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  type Schema,
} from '@/lib/api-utils';

/**
 * POST /api/agent-farm/run — Run a task on one or more agents.
 *
 * Body:
 *   { agentId: string, prompt: string }                         — single agent
 *   { agentIds: string[], prompt: string, parallel?: true }     — multiple agents
 */
const runSchema: Schema = {
  prompt: { type: 'string', required: true, maxLength: 4000 },
  agentId: { type: 'string', required: false },
  agentIds: { type: 'array', required: false },
  parallel: { type: 'boolean', required: false },
};

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { valid, errors, sanitized } = validateBody(parsed.data, runSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const prompt = sanitized.prompt as string;
  const singleId = sanitized.agentId as string | undefined;
  const multiIds = sanitized.agentIds as string[] | undefined;
  const parallel = sanitized.parallel as boolean | undefined;

  // Resolve the list of agent IDs to run
  let agentIds: string[];

  if (multiIds && Array.isArray(multiIds) && multiIds.length > 0) {
    agentIds = multiIds;
  } else if (singleId) {
    agentIds = [singleId];
  } else {
    return apiError('Provide either agentId (string) or agentIds (array)', 400);
  }

  if (agentIds.length > 20) {
    return apiError('Maximum 20 agents per run request', 400);
  }

  // Verify all agents exist
  for (const id of agentIds) {
    if (typeof id !== 'string') {
      return apiError('All agentIds must be strings', 400);
    }
    if (!agentFarm.getAgent(id)) {
      return apiError(`Agent not found: ${id}`, 404);
    }
  }

  try {
    if (parallel && agentIds.length > 1) {
      const results = await agentFarm.runParallel(agentIds, prompt);
      return apiSuccess({ results, mode: 'parallel' });
    }

    // Sequential execution (single agent or parallel: false)
    const results = [];
    for (const id of agentIds) {
      const result = await agentFarm.runTask(id, prompt);
      results.push(result);
    }

    return apiSuccess({ results, mode: 'sequential' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Task execution failed';
    return apiError(message, 500);
  }
}
