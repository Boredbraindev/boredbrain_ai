export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step') || '0';
  const start = Date.now();

  try {
    switch (step) {
      case '1': {
        const { apiSuccess } = await import('@/lib/api-utils');
        return NextResponse.json({ ok: true, step: 1, name: 'api-utils', ms: Date.now() - start });
      }
      case '2': {
        const { serverEnv } = await import('@/env/server');
        return NextResponse.json({ ok: true, step: 2, name: 'server-env', ms: Date.now() - start });
      }
      case '3': {
        const { listTopicDebates } = await import('@/lib/topic-debate');
        return NextResponse.json({ ok: true, step: 3, name: 'topic-debate', ms: Date.now() - start });
      }
      case '4': {
        const { fetchTrendingTopics } = await import('@/lib/polymarket-feed');
        return NextResponse.json({ ok: true, step: 4, name: 'polymarket-feed', ms: Date.now() - start });
      }
      case '5': {
        const { getUser } = await import('@/lib/auth-utils');
        return NextResponse.json({ ok: true, step: 5, name: 'auth-utils', ms: Date.now() - start });
      }
      case '6': {
        const { executeAgent } = await import('@/lib/agent-executor');
        return NextResponse.json({ ok: true, step: 6, name: 'agent-executor', ms: Date.now() - start });
      }
      default:
        return NextResponse.json({ ok: true, step: 0, name: 'baseline', ms: Date.now() - start });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, step, error: err.message, ms: Date.now() - start }, { status: 500 });
  }
}
