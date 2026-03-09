import { NextRequest } from 'next/server';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dao/execute - Execute a passed proposal
 */
const executeSchema: Schema = {
  proposalId: { type: 'string', required: true, maxLength: 100 },
};

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      executeSchema,
    );
    if (!valid) return apiError(errors.join(', '));

    const result = agentDAO.executeProposal(sanitized.proposalId as string);

    if (!result.success) return apiError(result.error!, 400);

    const proposal = agentDAO.getProposal(sanitized.proposalId as string);
    return apiSuccess({ proposal, message: 'Proposal executed successfully' });
  } catch (err) {
    console.error('[POST /api/dao/execute] Error:', err);
    return apiError('Failed to execute proposal', 500);
  }
}
