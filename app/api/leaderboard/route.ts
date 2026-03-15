export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

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

    // Use separate queries for each sort — tagged templates don't support dynamic ORDER BY
    let rows;
    if (category === 'battles') {
      rows = await sql`
        SELECT id, name, description, specialization, status, rating,
               elo_rating, total_calls, total_earned, registered_at
        FROM external_agent
        ORDER BY elo_rating DESC NULLS LAST
        LIMIT 50
      `;
    } else if (category === 'earnings') {
      rows = await sql`
        SELECT id, name, description, specialization, status, rating,
               elo_rating, total_calls, total_earned, registered_at
        FROM external_agent
        ORDER BY total_earned DESC NULLS LAST
        LIMIT 50
      `;
    } else {
      rows = await sql`
        SELECT id, name, description, specialization, status, rating,
               elo_rating, total_calls, total_earned, registered_at
        FROM external_agent
        ORDER BY total_calls DESC NULLS LAST
        LIMIT 50
      `;
    }

    const agents = rows.map((row: Record<string, unknown>, i: number) => ({
      id: row.id,
      name: row.name,
      specialization: row.specialization,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      earnings: Number(row.total_earned ?? 0),
      apiCalls: Number(row.total_calls ?? 0),
      arenaWins: Math.max(0, Math.round(((Number(row.elo_rating) || 1200) - 900) * 0.08)),
      elo: Number(row.elo_rating ?? 1200),
      active: row.status === 'active',
    }));

    return NextResponse.json({ success: true, data: { agents, total: agents.length, category, period } });
  } catch {
    return NextResponse.json({ success: true, data: { agents: [], total: 0, category, period } });
  }
}
