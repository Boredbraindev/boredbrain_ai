import { NextRequest } from 'next/server';
import { agentDAO, type ProposalStatus, type ProposalType } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dao - List proposals + governance stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ProposalStatus | null;

    const proposals = agentDAO.getProposals(status ?? undefined);
    const stats = agentDAO.getGovernanceStats();

    return apiSuccess({ proposals, stats });
  } catch (err) {
    console.error('[GET /api/dao] Error:', err);
    return apiError('Failed to fetch DAO data', 500);
  }
}

/**
 * POST /api/dao - Create new proposal
 */
const createProposalSchema: Schema = {
  title: { type: 'string', required: true, maxLength: 200 },
  description: { type: 'string', required: true, maxLength: 2000 },
  proposer: { type: 'string', required: true, maxLength: 100 },
  type: {
    type: 'string',
    required: true,
    enum: [
      'parameter_change',
      'treasury_spend',
      'skill_approval',
      'agent_ban',
      'protocol_upgrade',
      'fee_adjustment',
    ] as const,
  },
  options: { type: 'array', required: true },
};

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      createProposalSchema,
    );
    if (!valid) return apiError(errors.join(', '));

    const optionsArr = sanitized.options as string[];
    if (!Array.isArray(optionsArr) || optionsArr.length < 2) {
      return apiError('At least 2 options are required');
    }

    const proposal = agentDAO.createProposal(
      sanitized.title as string,
      sanitized.description as string,
      sanitized.proposer as string,
      sanitized.type as ProposalType,
      optionsArr,
    );

    return apiSuccess({ proposal }, 201);
  } catch (err) {
    console.error('[POST /api/dao] Error:', err);
    return apiError('Failed to create proposal', 500);
  }
}
