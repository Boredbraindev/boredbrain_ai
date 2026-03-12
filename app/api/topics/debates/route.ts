/**
 * /api/topics/debates
 *
 * GET  — list active and recent debates
 * POST — create a new debate from a topic
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { serverEnv } from '@/env/server';
import {
  getAllDebates,
  createDebateFromTopic,
  hasActiveDebate,
} from '@/lib/debate-engine';
import { fetchTrendingTopics } from '@/lib/polymarket-feed';

// ---------------------------------------------------------------------------
// GET /api/topics/debates
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'live', 'completed', 'scheduled'
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 50);

    let debates = getAllDebates();

    if (status) {
      debates = debates.filter((d) => d.status === status);
    }

    debates = debates.slice(0, limit);

    // Return summary without full message history for list view
    const summary = debates.map((d) => ({
      id: d.id,
      topicTitle: d.topic.title,
      topicCategory: d.topic.category,
      outcomes: d.topic.outcomes,
      percentages: d.topic.percentages,
      volume: d.topic.volume,
      agentCount: d.agents.length,
      agents: d.agents.map((a) => ({ name: a.name, position: a.position, avatar: a.avatar })),
      status: d.status,
      round: d.round,
      maxRounds: d.maxRounds,
      messageCount: d.messages.length,
      startedAt: d.startedAt,
      completedAt: d.completedAt,
      verdict: d.verdict,
    }));

    return apiSuccess({ debates: summary, count: summary.length });
  } catch (err) {
    console.error('[api/topics/debates] GET error:', err);
    return apiError('Failed to list debates', 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/topics/debates
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
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

    const parsed = await parseJsonBody<{ topicId?: string }>(request);
    if ('error' in parsed) return parsed.error;

    const { topicId } = parsed.data;

    if (!topicId) {
      return apiError('topicId is required');
    }

    // Check if this topic already has an active debate
    if (hasActiveDebate(topicId)) {
      return apiError('This topic already has an active debate');
    }

    // Find the topic from trending
    const topics = await fetchTrendingTopics(50);
    const topic = topics.find((t) => t.id === topicId);

    if (!topic) {
      return apiError('Topic not found in current trending topics');
    }

    const debate = await createDebateFromTopic(topic);

    return apiSuccess({
      debate: {
        id: debate.id,
        topicTitle: debate.topic.title,
        agents: debate.agents.map((a) => ({ name: a.name, position: a.position })),
        status: debate.status,
        round: debate.round,
      },
      message: 'Debate created. Use POST /api/topics/debates/{debateId} to run rounds.',
    });
  } catch (err) {
    console.error('[api/topics/debates] POST error:', err);
    return apiError('Failed to create debate', 500);
  }
}
