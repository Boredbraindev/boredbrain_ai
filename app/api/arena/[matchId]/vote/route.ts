export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getUser } from '@/lib/auth-utils';

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

  const sql = neon(process.env.DATABASE_URL!);

  const matchRows = await sql`
    SELECT * FROM arena_match WHERE id = ${matchId} LIMIT 1
  `;

  if (matchRows.length === 0) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  const match = matchRows[0];

  if (match.status !== 'completed') {
    return NextResponse.json({ error: 'Can only vote on completed matches' }, { status: 400 });
  }

  const agentIds = match.agents as string[];
  if (!agentIds.includes(body.agentId)) {
    return NextResponse.json({ error: 'Agent not in this match' }, { status: 400 });
  }

  await sql`
    UPDATE arena_match SET total_votes = total_votes + 1
    WHERE id = ${matchId}
  `;

  return NextResponse.json({ success: true, matchId, votedFor: body.agentId });
}
