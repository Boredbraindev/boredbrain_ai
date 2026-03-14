export const runtime = 'edge';

/**
 * GET  /api/topics — list active/recent topic debates + trending topics
 * POST /api/topics — create a new topic debate
 *
 * Query params for GET:
 *   ?type=debates     — only topic debates
 *   ?type=trending    — only trending topics (returns empty array — polymarket feed is optional)
 *   ?status=open      — filter debates by status
 *   ?category=crypto  — filter by category
 *   ?limit=20         — number of results (default 20, max 50)
 *   ?hot=5            — shortcut for top N trending
 *
 * Edge runtime — uses raw SQL via @neondatabase/serverless
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyCronOrAdmin(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === 'development';
  }
  if (request.headers.get('x-vercel-cron') === '1') return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ---------------------------------------------------------------------------
// GET /api/topics
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const hot = searchParams.get('hot');

    const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 50);

    // Hot topics shortcut — trending is optional, return empty
    if (hot) {
      return NextResponse.json({
        success: true,
        topics: [],
        count: 0,
        source: 'trending',
      });
    }

    // Trending only — return empty (polymarket feed is optional on edge)
    if (type === 'trending') {
      return NextResponse.json({
        success: true,
        topics: [],
        count: 0,
        category: category ?? undefined,
        source: 'trending',
      });
    }

    // Topic debates only
    if (type === 'debates') {
      const debates = await queryDebates(sql, { status, category, limit });
      return NextResponse.json({
        success: true,
        debates,
        count: debates.length,
        type: 'topic_debates',
      });
    }

    // Default: return both debates and empty trending
    const debates = await queryDebates(sql, { status, category, limit: 10 });

    return NextResponse.json({
      success: true,
      debates,
      debateCount: debates.length,
      trending: [],
      trendingCount: 0,
    });
  } catch (err: any) {
    console.error('[api/topics] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch topics', detail: String(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/topics — create a new topic debate
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!verifyCronOrAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — debate creation requires authentication' },
      { status: 401 },
    );
  }

  try {
    let body: { topic?: string; category?: string };
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

    const { topic, category } = body;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'topic is required (min 5 characters)' },
        { status: 400 },
      );
    }

    const trimmedTopic = topic.trim().slice(0, 500);
    const validCategory = category?.trim() || 'general';

    const sql = getSQL();
    const id = generateId();
    const now = new Date();
    const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await sql.query(
      `INSERT INTO topic_debate (id, topic, category, status, created_at, closes_at, total_participants, total_pool)
       VALUES ($1, $2, $3, 'open', $4, $5, 0, 0)`,
      [id, trimmedTopic, validCategory, now.toISOString(), closesAt.toISOString()],
    );

    return NextResponse.json(
      {
        success: true,
        debate: {
          id,
          topic: trimmedTopic,
          category: validCategory,
          closesAt,
        },
        message: 'Topic debate created. Agents will auto-participate shortly.',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/topics] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create topic debate' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Raw SQL query helper
// ---------------------------------------------------------------------------

async function queryDebates(
  sql: ReturnType<typeof neon>,
  options: { status?: string | null; category?: string | null; limit: number },
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (options.status) {
    conditions.push(`d.status = $${paramIdx++}`);
    params.push(options.status);
  }
  if (options.category) {
    conditions.push(`d.category = $${paramIdx++}`);
    params.push(options.category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Query debates (neon v1: use sql.query() for parameterized queries)
  const debateRows = await sql.query(
    `SELECT d.id, d.topic, d.category, d.status, d.created_at, d.closes_at,
            d.total_participants, d.top_score, d.top_agent_id, d.total_pool,
            d.polymarket_event_id, d.resolved_outcome, d.market_id
     FROM topic_debate d
     ${whereClause}
     ORDER BY d.created_at DESC
     LIMIT $${paramIdx}`,
    [...params, options.limit],
  );

  // Map rows to camelCase to match the original response format
  return debateRows.map((row: Record<string, unknown>) => ({
    id: row.id,
    topic: row.topic,
    category: row.category,
    status: row.status,
    totalParticipants: row.total_participants ?? 0,
    createdAt: row.created_at,
    closesAt: row.closes_at,
    topScore: row.top_score ?? null,
    topAgentId: row.top_agent_id ?? null,
    totalPool: row.total_pool ?? 0,
    polymarketEventId: row.polymarket_event_id ?? null,
    resolvedOutcome: row.resolved_outcome ?? null,
    marketId: row.market_id ?? null,
  }));
}
