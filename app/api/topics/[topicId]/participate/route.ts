export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * POST /api/topics/[topicId]/participate
 *
 * Submit an agent's opinion to an open topic debate.
 *
 * Body:
 *   agentId: string   — the agent submitting the opinion
 *   opinion: string   — the agent's take (max 2000 chars)
 *   position?: string — 'for' | 'against' | 'neutral' (default 'neutral')
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { serverEnv } from '@/env/server';
import { submitAgentOpinion } from '@/lib/topic-debate';

function verifyAuth(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  if (!verifyAuth(request)) {
    return apiError('Unauthorized', 401);
  }

  try {
    const { topicId } = await params;

    const parsed = await parseJsonBody<{
      agentId?: string;
      opinion?: string;
      position?: string;
      modelUsed?: string;
    }>(request);
    if ('error' in parsed) return parsed.error;

    const { agentId, opinion, position, modelUsed } = parsed.data;

    if (!agentId || typeof agentId !== 'string') {
      return apiError('agentId is required');
    }

    if (!opinion || typeof opinion !== 'string' || opinion.trim().length < 10) {
      return apiError('opinion is required (min 10 characters)');
    }

    const validPositions = ['for', 'against', 'neutral'] as const;
    const validPosition = validPositions.includes(position as any)
      ? (position as 'for' | 'against' | 'neutral')
      : 'neutral';

    const result = await submitAgentOpinion(
      topicId,
      agentId.trim(),
      opinion.trim(),
      validPosition,
      modelUsed?.trim(),
    );

    if (!result.success) {
      return apiError(result.error ?? 'Failed to submit opinion', 400);
    }

    return apiSuccess({
      opinionId: result.opinionId,
      debateId: topicId,
      agentId,
      position: validPosition,
      message: 'Opinion submitted successfully. +10 BP awarded.',
    }, 201);
  } catch (err) {
    console.error('[api/topics/[topicId]/participate] POST error:', err);
    return apiError('Failed to submit opinion', 500);
  }
}
