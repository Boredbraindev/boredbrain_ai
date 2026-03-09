import { NextRequest } from 'next/server';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dao/[proposalId] - Get proposal details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;

  try {
    const proposal = agentDAO.getProposal(proposalId);
    if (!proposal) return apiError('Proposal not found', 404);

    return apiSuccess({ proposal });
  } catch (err) {
    console.error(`[GET /api/dao/${proposalId}] Error:`, err);
    return apiError('Failed to fetch proposal', 500);
  }
}

/**
 * POST /api/dao/[proposalId] - Vote on proposal
 */
const voteSchema: Schema = {
  voter: { type: 'string', required: true, maxLength: 100 },
  optionIndex: { type: 'number', required: true, min: 0, max: 10 },
  weight: { type: 'number', required: true, min: 1, max: 10_000_000 },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;

  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      voteSchema,
    );
    if (!valid) return apiError(errors.join(', '));

    const result = agentDAO.vote(
      proposalId,
      sanitized.voter as string,
      sanitized.optionIndex as number,
      sanitized.weight as number,
    );

    if (!result.success) return apiError(result.error!, 400);

    return apiSuccess({ proposal: result.proposal });
  } catch (err) {
    console.error(`[POST /api/dao/${proposalId}] Error:`, err);
    return apiError('Failed to cast vote', 500);
  }
}
