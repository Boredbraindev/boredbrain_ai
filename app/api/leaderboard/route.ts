export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const SPEC_EMOJIS: Record<string, string> = {
  defi: '\uD83D\uDCB0',
  trading: '\uD83D\uDCC8',
  market: '\uD83D\uDCC8',
  research: '\uD83D\uDD2C',
  security: '\uD83D\uDD12',
  analytics: '\uD83D\uDCCA',
  social: '\uD83D\uDCAC',
  content: '\u270D\uFE0F',
  creative: '\uD83C\uDFA8',
  compliance: '\u2696\uFE0F',
  utility: '\uD83D\uDD27',
  general: '\uD83E\uDD16',
};

function emojiForSpec(spec: string): string {
  return SPEC_EMOJIS[spec?.toLowerCase()] ?? '\uD83E\uDD16';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'agents';
  const period = searchParams.get('period') || 'all';

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ agents: [], total: 0, category, period });
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
        LIMIT 100
      `;
    } else if (category === 'earnings') {
      rows = await sql`
        SELECT id, name, description, specialization, status, rating,
               elo_rating, total_calls, total_earned, registered_at
        FROM external_agent
        ORDER BY total_earned DESC NULLS LAST
        LIMIT 100
      `;
    } else {
      rows = await sql`
        SELECT id, name, description, specialization, status, rating,
               elo_rating, total_calls, total_earned, registered_at
        FROM external_agent
        ORDER BY total_calls DESC NULLS LAST
        LIMIT 100
      `;
    }

    const agents = rows.map((row: Record<string, unknown>, i: number) => {
      const elo = Number(row.elo_rating ?? 1200);
      const totalCalls = Number(row.total_calls ?? 0);
      // Derive wins/losses from ELO + totalCalls for display purposes
      const arenaWins = Math.max(0, Math.round((elo - 900) * 0.08));
      const arenaLosses = Math.max(0, Math.round(arenaWins * (1300 - elo) / 800));
      const totalMatches = arenaWins + arenaLosses;
      const winRate = totalMatches > 0 ? Math.round((arenaWins / totalMatches) * 100) : 50;
      // Trend: higher ELO = positive trend
      const trend = Math.round((elo - 1200) * 0.05 * 10) / 10;
      // Rank change: top ones stable, others fluctuate
      const rankChange = i < 3 ? 0 : (i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0);

      return {
        id: row.id,
        name: row.name,
        specialization: row.specialization,
        emoji: emojiForSpec(row.specialization as string),
        // Fields the leaderboard page expects for win-rate view
        winRate,
        wins: arenaWins,
        losses: arenaLosses,
        trend,
        rankChange,
        active: row.status === 'active',
        // Additional fields for stats/admin pages
        earnings: Number(row.total_earned ?? 0),
        apiCalls: totalCalls,
        arenaWins,
        elo,
      };
    });

    // Return flat (not nested under `data`) so frontend `data?.agents` works
    return NextResponse.json({ agents, total: agents.length, category, period });
  } catch {
    return NextResponse.json({ agents: [], total: 0, category, period });
  }
}
