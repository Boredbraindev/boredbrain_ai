/**
 * /api/topics/debates/[debateId]
 *
 * GET  — get debate with all messages
 * POST — run the next debate round (triggered by cron or manually)
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { serverEnv } from '@/env/server';
import { getDebate, runDebateRound } from '@/lib/debate-engine';

// ---------------------------------------------------------------------------
// GET /api/topics/debates/[debateId]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  try {
    const { debateId } = await params;
    const debate = getDebate(debateId);

    if (!debate) {
      return apiError('Debate not found', 404);
    }

    return apiSuccess({
      debate: {
        id: debate.id,
        topic: debate.topic,
        agents: debate.agents,
        status: debate.status,
        round: debate.round,
        maxRounds: debate.maxRounds,
        messages: debate.messages,
        startedAt: debate.startedAt,
        completedAt: debate.completedAt,
        verdict: debate.verdict,
      },
    });
  } catch (err) {
    console.error('[api/topics/debates/[id]] GET error:', err);
    return apiError('Failed to fetch debate', 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/topics/debates/[debateId] — run next round
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  try {
    // Auth: require cron secret or bearer token
    const authHeader = request.headers.get('authorization');
    const secret = serverEnv.CRON_SECRET;
    if (secret) {
      const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
      if (token !== secret && request.headers.get('x-vercel-cron') !== '1') {
        return apiError('Unauthorized', 401);
      }
    }

    const { debateId } = await params;
    const debate = getDebate(debateId);

    if (!debate) {
      return apiError('Debate not found', 404);
    }

    if (debate.status === 'completed') {
      return apiSuccess({
        debateId: debate.id,
        status: 'completed',
        message: 'Debate already completed',
        verdict: debate.verdict,
      });
    }

    const newMessages = await runDebateRound(debate);

    return apiSuccess({
      debateId: debate.id,
      round: debate.round,
      maxRounds: debate.maxRounds,
      status: debate.status,
      newMessages,
      verdict: debate.verdict ?? undefined,
      totalMessages: debate.messages.length,
    });
  } catch (err) {
    console.error('[api/topics/debates/[id]] POST error:', err);
    return apiError('Failed to run debate round', 500);
  }
}
