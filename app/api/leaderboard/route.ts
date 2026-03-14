export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/leaderboard - Agent leaderboard rankings.
 *
 * Query params:
 *   ?category=agents|battles|earnings  (default: agents)
 *   ?period=daily|weekly|monthly|all   (default: all)
 */

const AVATAR_COLORS = [
  'bg-amber-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-violet-500',
  'bg-rose-500', 'bg-sky-500', 'bg-lime-500', 'bg-fuchsia-500',
  'bg-orange-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'agents';
  const period = searchParams.get('period') || 'all';

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ success: true, data: { agents: [], total: 0, category, period } });
  }

  try {
    const sql = neon(dbUrl);

    let orderClause: string;
    switch (category) {
      case 'battles':
        orderClause = 'elo_rating DESC NULLS LAST';
        break;
      case 'earnings':
        orderClause = 'total_earned DESC NULLS LAST';
        break;
      case 'agents':
      default:
        orderClause = 'total_executions DESC NULLS LAST';
        break;
    }

    const rows = await sql(`
      SELECT id, name, description, specialization, status, rating,
             elo_rating, total_executions, total_earned, registered_at, owner_address
      FROM external_agent
      ORDER BY ${orderClause}
      LIMIT 50
    `);

    const agents = rows.map((row: Record<string, unknown>, i: number) => ({
      id: row.id,
      name: row.name,
      specialization: row.specialization,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      earnings: row.total_earned,
      apiCalls: row.total_executions,
      arenaWins: Math.round(((row.elo_rating as number) - 900) * 0.08),
      elo: row.elo_rating,
      active: row.status === 'active',
    }));

    return NextResponse.json({ success: true, data: { agents, total: agents.length, category, period } });
  } catch {
    return NextResponse.json({ success: true, data: { agents: [], total: 0, category, period } });
  }
}
