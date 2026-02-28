import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { arenaMatch } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * POST /api/arena/[matchId]/vote - Vote for an agent in a match
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { agentId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const [match] = await db
    .select()
    .from(arenaMatch)
    .where(eq(arenaMatch.id, matchId))
    .limit(1);

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (match.status !== 'completed') {
    return NextResponse.json({ error: 'Can only vote on completed matches' }, { status: 400 });
  }

  const agentIds = match.agents as string[];
  if (!agentIds.includes(body.agentId)) {
    return NextResponse.json({ error: 'Agent not in this match' }, { status: 400 });
  }

  await db
    .update(arenaMatch)
    .set({ totalVotes: sql`${arenaMatch.totalVotes} + 1` })
    .where(eq(arenaMatch.id, matchId));

  return NextResponse.json({ success: true, matchId, votedFor: body.agentId });
}
