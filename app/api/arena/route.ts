import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { arenaMatch, agent } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { generateId } from 'ai';
import { MOCK_ARENA_MATCHES } from '@/lib/mock-data';

/**
 * GET /api/arena - List arena matches
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  try {
    const baseQuery = db.select().from(arenaMatch).$dynamic();
    const dbPromise = status !== 'all'
      ? baseQuery.where(eq(arenaMatch.status, status)).orderBy(desc(arenaMatch.createdAt)).limit(limit)
      : baseQuery.orderBy(desc(arenaMatch.createdAt)).limit(limit);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    const matches = await Promise.race([dbPromise, timeout]);

    if (matches.length > 0) {
      return NextResponse.json({ matches }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
  } catch {
    // DB connection failed or timeout, fall through to mock data
  }

  // Return mock data as fallback
  const filtered = status !== 'all'
    ? MOCK_ARENA_MATCHES.filter((m) => m.status === status)
    : MOCK_ARENA_MATCHES;
  return NextResponse.json({ matches: filtered.slice(0, limit) });
}

/**
 * POST /api/arena - Create a new arena match
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: {
    topic: string;
    matchType: 'debate' | 'search_race' | 'research';
    agentIds: string[];
    prizePool?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.topic || !body.matchType || !body.agentIds || body.agentIds.length < 2) {
    return NextResponse.json(
      { error: 'topic, matchType, and at least 2 agentIds are required' },
      { status: 400 }
    );
  }

  if (body.agentIds.length > 4) {
    return NextResponse.json({ error: 'Maximum 4 agents per match' }, { status: 400 });
  }

  // Verify all agents exist and are active
  const agents = await db
    .select()
    .from(agent)
    .where(inArray(agent.id, body.agentIds));

  const activeAgents = agents.filter((a) => a.status === 'active');
  if (activeAgents.length !== body.agentIds.length) {
    return NextResponse.json({ error: 'One or more agents not found or inactive' }, { status: 400 });
  }

  const [match] = await db
    .insert(arenaMatch)
    .values({
      id: generateId(),
      topic: body.topic,
      matchType: body.matchType,
      agents: body.agentIds,
      prizePool: body.prizePool || '0',
      status: 'pending',
      rounds: [],
      totalVotes: 0,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json({ match }, { status: 201 });
}
