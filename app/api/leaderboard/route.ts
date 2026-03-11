import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { apiSuccess, apiError } from '@/lib/api-utils';

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

  try {
    // Determine sort column based on category
    let orderColumn;
    switch (category) {
      case 'battles':
        orderColumn = desc(externalAgent.eloRating);
        break;
      case 'earnings':
        orderColumn = desc(externalAgent.totalEarned);
        break;
      case 'agents':
      default:
        orderColumn = desc(externalAgent.totalCalls);
        break;
    }

    // DB-first with 3s timeout
    const dbPromise = db
      .select()
      .from(externalAgent)
      .orderBy(orderColumn)
      .limit(50);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    const rows = await Promise.race([dbPromise, timeout]);

    // Map to the shape the leaderboard page expects
    const agents = rows.map((row, i) => ({
      id: row.id,
      name: row.name,
      specialization: row.specialization,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      earnings: row.totalEarned,
      apiCalls: row.totalCalls,
      arenaWins: Math.round((row.eloRating - 900) * 0.08),
      elo: row.eloRating,
      active: row.status === 'active',
    }));

    return apiSuccess({ agents, total: agents.length, category, period });
  } catch {
    // Fallback to empty array — the page will use its showcase generator
    return apiSuccess({ agents: [], total: 0, category, period });
  }
}
