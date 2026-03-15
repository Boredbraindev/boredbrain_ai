export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import {
  registerReferral,
  getReferralTree,
  getReferralStats,
} from '@/lib/agent-referral';

/**
 * GET /api/agents/[agentId]/referrals
 *
 * Get referral tree and stats for an agent.
 *
 * Query params:
 *   ?view=tree   — referral tree (direct + level-2 recruits)
 *   ?view=stats  — referral stats (counts, earnings, top performers)
 *   (default)    — returns both tree and stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    const view = request.nextUrl.searchParams.get('view');

    if (view === 'tree') {
      const tree = await getReferralTree(agentId);
      return apiSuccess({ tree });
    }

    if (view === 'stats') {
      const stats = await getReferralStats(agentId);
      return apiSuccess({ stats });
    }

    // Default: return both
    const [tree, stats] = await Promise.all([
      getReferralTree(agentId),
      getReferralStats(agentId),
    ]);

    return apiSuccess({ tree, stats });
  } catch (error: any) {
    console.error('[referrals] GET error:', error.message);
    return apiError('Failed to get referral data', 500);
  }
}

/**
 * POST /api/agents/[agentId]/referrals
 *
 * Register a new referral relationship.
 * The agentId in the URL is the recruiter.
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

    if (recruitedId === agentId) {
      return apiError('An agent cannot recruit itself', 400);
    }

    const result = await registerReferral(agentId, recruitedId);

    if (!result.success) {
      return apiError('Failed to register referral', 500);
    }

    return apiSuccess({ registered: true, recruiterId: agentId, recruitedId });
  } catch (error: any) {
    console.error('[referrals] POST error:', error.message);
    return apiError('Failed to register referral', 500);
  }
}
