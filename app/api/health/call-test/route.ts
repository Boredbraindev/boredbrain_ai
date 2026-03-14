export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { serverEnv } from '@/env/server';
import { listTopicDebates } from '@/lib/topic-debate';
import { fetchTrendingTopics } from '@/lib/polymarket-feed';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const test = searchParams.get('test') || 'debates';
  const start = Date.now();

  try {
    if (test === 'debates') {
      const debates = await listTopicDebates({ limit: 3 });
      return apiSuccess({ count: debates.length, ms: Date.now() - start });
    }
    if (test === 'trending') {
      const topics = await fetchTrendingTopics(3);
      return apiSuccess({ count: topics.length, ms: Date.now() - start });
    }
    return apiSuccess({ test: 'unknown', ms: Date.now() - start });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, ms: Date.now() - start }, { status: 500 });
  }
}
