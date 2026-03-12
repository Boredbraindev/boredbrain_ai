/**
 * GET  /api/topics — list active/recent topic debates + trending topics
 * POST /api/topics — create a new topic debate
 *
 * Query params for GET:
 *   ?type=debates     — only topic debates
 *   ?type=trending    — only Polymarket trending topics (legacy)
 *   ?status=open      — filter debates by status
 *   ?category=crypto  — filter by category
 *   ?limit=20         — number of results (default 20, max 50)
 *   ?hot=5            — shortcut for top N trending
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { serverEnv } from '@/env/server';
import {
  fetchTrendingTopics,
  fetchTopicsByCategory,
  getHotTopics,
} from '@/lib/polymarket-feed';
import {
  createTopicDebate,
  listTopicDebates,
} from '@/lib/topic-debate';

function verifyCronOrAdmin(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  // Fail-closed: if no secret configured, reject (except dev mode check below)
  if (!secret) {
    return process.env.NODE_ENV === 'development';
  }
  // Vercel cron header
  if (request.headers.get('x-vercel-cron') === '1') return true;
  // Bearer token auth
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// GET /api/topics
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'debates' | 'trending'
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const hot = searchParams.get('hot');

    const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 50);

    // Hot topics shortcut (legacy)
    if (hot) {
      const count = Math.min(Math.max(parseInt(hot, 10) || 5, 1), 20);
      const topics = await getHotTopics(count);
      return apiSuccess({ topics, count: topics.length, source: 'trending' });
    }

    // Topic debates only
    if (type === 'debates') {
      const debates = await listTopicDebates({
        status: status ?? undefined,
        category: category ?? undefined,
        limit,
      });
      return apiSuccess({ debates, count: debates.length, type: 'topic_debates' });
    }

    // Trending only (legacy)
    if (type === 'trending') {
      if (category) {
        const topics = await fetchTopicsByCategory(category, limit);
        return apiSuccess({ topics, count: topics.length, category, source: 'trending' });
      }
      const topics = await fetchTrendingTopics(limit);
      return apiSuccess({ topics, count: topics.length, source: 'trending' });
    }

    // Default: return both topic debates and trending topics
    const [debates, trending] = await Promise.all([
      listTopicDebates({ status: status ?? undefined, category: category ?? undefined, limit: 10 }),
      fetchTrendingTopics(10).catch(() => []),
    ]);

    return apiSuccess({
      debates,
      debateCount: debates.length,
      trending,
      trendingCount: trending.length,
    });
  } catch (err) {
    console.error('[api/topics] Error:', err);
    return apiError('Failed to fetch topics', 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/topics — create a new topic debate
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!verifyCronOrAdmin(request)) {
    return apiError('Unauthorized — debate creation requires authentication', 401);
  }

  try {
    const parsed = await parseJsonBody<{
      topic?: string;
      category?: string;
    }>(request);
    if ('error' in parsed) return parsed.error;

    const { topic, category } = parsed.data;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 5) {
      return apiError('topic is required (min 5 characters)');
    }

    const trimmedTopic = topic.trim().slice(0, 500);
    const validCategory = category?.trim() || 'general';

    const debate = await createTopicDebate(trimmedTopic, validCategory);

    return apiSuccess({
      debate,
      message: 'Topic debate created. Agents will auto-participate during heartbeat cycles.',
    }, 201);
  } catch (err) {
    console.error('[api/topics] POST error:', err);
    return apiError('Failed to create topic debate', 500);
  }
}
