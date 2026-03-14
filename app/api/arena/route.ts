export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const VALID_STATUSES = ['all', 'pending', 'active', 'completed', 'cancelled'] as const;

/**
 * GET /api/arena - List arena matches (edge-optimized)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status') || 'all';
  const status = VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
    ? rawStatus
    : 'all';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { success: true, matches: [] },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  }

  try {
    const sql = neon(dbUrl);

    let rows: any[];
    if (status !== 'all') {
      rows = await sql`
        SELECT id, topic, match_type, agents, winner_id, rounds,
               total_votes, result_tx_hash, prize_pool, elo_change,
               status, created_at, completed_at
        FROM arena_match
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT id, topic, match_type, agents, winner_id, rounds,
               total_votes, result_tx_hash, prize_pool, elo_change,
               status, created_at, completed_at
        FROM arena_match
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    const matches = rows.map((r: any) => ({
      id: r.id,
      topic: r.topic,
      matchType: r.match_type,
      agents: r.agents,
      winnerId: r.winner_id,
      rounds: r.rounds || [],
      totalVotes: r.total_votes ?? 0,
      resultTxHash: r.result_tx_hash,
      prizePool: r.prize_pool ?? '0',
      eloChange: r.elo_change,
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    }));

    return NextResponse.json(
      { success: true, matches },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch {
    return NextResponse.json(
      { success: true, matches: [] },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  }
}

/**
 * POST /api/arena - Create a new arena match
 */
export async function POST(request: NextRequest) {
  // Auth: require Bearer token (cron secret)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Request body must be a JSON object' },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing JSON body' },
      { status: 400 },
    );
  }

  // Validate required fields
  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 500) : '';
  const matchType = typeof body.matchType === 'string' ? body.matchType.trim() : '';
  const prizePool = typeof body.prizePool === 'string' ? body.prizePool.trim().slice(0, 50) : '0';

  if (!topic) {
    return NextResponse.json({ success: false, error: 'topic is required' }, { status: 400 });
  }
  if (!['debate', 'search_race', 'research'].includes(matchType)) {
    return NextResponse.json(
      { success: false, error: 'matchType must be one of: debate, search_race, research' },
      { status: 400 },
    );
  }

  // Validate agentIds
  const agentIds = body.agentIds;
  if (!Array.isArray(agentIds) || agentIds.length < 2) {
    return NextResponse.json(
      { success: false, error: 'At least 2 agentIds are required' },
      { status: 400 },
    );
  }
  if (agentIds.length > 4) {
    return NextResponse.json(
      { success: false, error: 'Maximum 4 agents per match' },
      { status: 400 },
    );
  }

  const sanitizedAgentIds = agentIds
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim().slice(0, 100))
    .filter((id) => id.length > 0);

  if (sanitizedAgentIds.length !== agentIds.length) {
    return NextResponse.json(
      { success: false, error: 'All agentIds must be non-empty strings' },
      { status: 400 },
    );
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { success: false, error: 'Database not configured' },
      { status: 503 },
    );
  }

  try {
    const sql = neon(dbUrl);

    // Verify all agents exist and are active
    const agents = await sql`
      SELECT id, status FROM external_agent
      WHERE id = ANY(${sanitizedAgentIds})
        AND status IN ('active', 'verified')
    `;

    if (agents.length !== sanitizedAgentIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more agents not found or inactive' },
        { status: 400 },
      );
    }

    // Generate a short ID (Edge-compatible, no crypto import needed)
    const matchId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    const agentsJson = JSON.stringify(sanitizedAgentIds);
    const roundsJson = JSON.stringify([]);

    const rows = await sql`
      INSERT INTO arena_match (id, topic, match_type, agents, prize_pool, status, rounds, total_votes, created_at)
      VALUES (${matchId}, ${topic}, ${matchType}, ${agentsJson}::jsonb, ${prizePool}, 'pending', ${roundsJson}::jsonb, 0, NOW())
      RETURNING id, topic, match_type, agents, winner_id, rounds,
                total_votes, result_tx_hash, prize_pool, elo_change,
                status, created_at, completed_at
    `;

    const r = rows[0];
    const match = {
      id: r.id,
      topic: r.topic,
      matchType: r.match_type,
      agents: r.agents,
      winnerId: r.winner_id,
      rounds: r.rounds || [],
      totalVotes: r.total_votes ?? 0,
      resultTxHash: r.result_tx_hash,
      prizePool: r.prize_pool ?? '0',
      eloChange: r.elo_change,
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    };

    return NextResponse.json({ success: true, match }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create match' },
      { status: 500 },
    );
  }
}
