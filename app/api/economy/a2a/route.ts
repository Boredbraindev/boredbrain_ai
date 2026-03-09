import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';

/**
 * GET /api/economy/a2a - List all A2A contracts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') ?? undefined;

    const contracts = agentEconomy.getContracts(agentId);

    return apiSuccess({ contracts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch A2A contracts';
    return apiError(message, 500);
  }
}

const createContractSchema: Schema = {
  hiringAgentId: { type: 'string', required: true, maxLength: 100 },
  hiredAgentId: { type: 'string', required: true, maxLength: 100 },
  task: { type: 'string', required: true, maxLength: 500 },
  budget: { type: 'number', required: true, min: 0.01, max: 10000 },
};

/**
 * POST /api/economy/a2a - Create new A2A hire contract
 * Body: { hiringAgentId, hiredAgentId, task, budget }
 */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { valid, errors, sanitized } = validateBody(
    parsed.data as Record<string, unknown>,
    createContractSchema,
  );

  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const { hiringAgentId, hiredAgentId, task, budget } = sanitized as {
    hiringAgentId: string;
    hiredAgentId: string;
    task: string;
    budget: number;
  };

  if (hiringAgentId === hiredAgentId) {
    return apiError('An agent cannot hire itself', 400);
  }

  try {
    const contract = agentEconomy.hireAgent(hiringAgentId, hiredAgentId, task, budget);

    return apiSuccess({ contract }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create A2A contract';
    return apiError(message, 500);
  }
}
