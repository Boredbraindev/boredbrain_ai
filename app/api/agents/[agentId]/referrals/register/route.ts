export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { registerReferral } from '@/lib/agent-referral';

/**
 * POST /api/agents/[agentId]/referrals/register
 *
 * Register a referral relationship where agentId is the recruiter.
 *
 * Body: { recruitedId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    const parsed = await parseJsonBody<{ recruitedId: string }>(request);
    if ('error' in parsed) return parsed.error;

    const { recruitedId } = parsed.data;

    if (!recruitedId || typeof recruitedId !== 'string') {
      return apiError('recruitedId is required', 400);
    }

    if (recruitedId.trim().length === 0) {
      return apiError('recruitedId cannot be empty', 400);
    }

    if (recruitedId === agentId) {
      return apiError('An agent cannot recruit itself', 400);
    }

    const result = await registerReferral(agentId, recruitedId);

    if (!result.success) {
      return apiError('Failed to register referral', 500);
    }

    return apiSuccess({ registered: true, recruiterId: agentId, recruitedId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    console.error('[referrals/register] POST error:', msg);
    return apiError('Failed to register referral', 500);
  }
}
