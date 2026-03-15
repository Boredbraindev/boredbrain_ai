export const runtime = 'edge';
import { NextRequest } from 'next/server';
import { agentFarm, LLM_PROVIDERS } from '@/lib/agent-farm';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  type Schema,
} from '@/lib/api-utils';

/**
 * GET /api/agent-farm — List all agents + available providers.
 */
export async function GET() {
  const agents = agentFarm.getAgents();

  return apiSuccess({
    agents,
    providers: LLM_PROVIDERS,
    count: agents.length,
  });
}

/**
 * POST /api/agent-farm — Spawn a new agent.
 *
 * Body: { provider: string, name: string, systemPrompt?: string }
 */
const spawnSchema: Schema = {
  provider: {
    type: 'string',
    required: true,
    enum: LLM_PROVIDERS.map((p) => p.id),
  },
  name: { type: 'string', required: true, maxLength: 100 },
  systemPrompt: { type: 'string', required: false, maxLength: 2000 },
};

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { valid, errors, sanitized } = validateBody(parsed.data, spawnSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const provider = sanitized.provider as string;
  const name = sanitized.name as string;
  const systemPrompt = sanitized.systemPrompt as string | undefined;

  try {
    const agent = agentFarm.spawnAgent(provider, name, systemPrompt);
    return apiSuccess({ agent }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to spawn agent';
    return apiError(message, 400);
  }
}
