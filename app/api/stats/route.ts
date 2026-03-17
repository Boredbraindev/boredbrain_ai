export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({
      totalAgents: 0,
      totalApiKeys: 0,
      totalToolCalls: 0,
      totalMatches: 0,
      totalVolume: '0',
      topTools: [],
      recentMatches: [],
      topAgents: [],
    });
  }

  const sql = neon(dbUrl);

  // --- Total agents count ---
  let totalAgents = 0;
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM external_agent
      WHERE status IN ('active', 'verified')
    `;
    totalAgents = rows[0]?.count ?? 0;
  } catch (e) {
    console.error('[stats] totalAgents error:', e);
  }

  // --- Total tool calls (sum of total_calls) ---
  let totalToolCalls = 0;
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(total_calls), 0)::int AS total
      FROM external_agent
      WHERE status IN ('active', 'verified')
    `;
    totalToolCalls = rows[0]?.total ?? 0;
  } catch (e) {
    console.error('[stats] totalToolCalls error:', e);
  }

  // --- Total arena matches ---
  let totalMatches = 0;
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS count FROM arena_match
    `;
    totalMatches = rows[0]?.count ?? 0;
  } catch (e) {
    console.error('[stats] totalMatches error:', e);
  }

  // --- Total volume (sum of total_earned across all agents) ---
  let totalVolume = '0';
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(total_earned), 0) AS total
      FROM external_agent
      WHERE status IN ('active', 'verified')
    `;
    totalVolume = String(Math.round(Number(rows[0]?.total ?? 0)));
  } catch (e) {
    console.error('[stats] totalVolume error:', e);
  }

  // --- Top agents by execution count ---
  let topAgents: Array<{
    id: string;
    name: string;
    totalExecutions: number;
    totalRevenue: string;
    rating: number;
    capabilities: string[];
  }> = [];
  try {
    const rows = await sql`
      SELECT id, name, specialization, total_calls, total_earned, rating
      FROM external_agent
      WHERE status IN ('active', 'verified')
      ORDER BY total_calls DESC
      LIMIT 10
    `;
    topAgents = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      totalExecutions: r.total_calls ?? 0,
      totalRevenue: String(r.total_earned ?? 0),
      rating: r.rating ?? 0,
      capabilities: r.specialization ? [r.specialization] : [],
    }));
  } catch (e) {
    console.error('[stats] topAgents error:', e);
  }

  // --- Recent arena matches (try arena_match first, fallback to topic_debate) ---
  let recentMatches: Array<{
    id: string;
    topic: string;
    status: string;
    matchType: string;
    agents: string[];
    prizePool: string;
    totalVotes: number;
    createdAt: string;
  }> = [];
  try {
    const rows = await sql`
      SELECT id, topic, status, match_type, agents, prize_pool, total_votes, created_at
      FROM arena_match
      ORDER BY created_at DESC
      LIMIT 6
    `;
    recentMatches = rows.map((r: any) => ({
      id: r.id,
      topic: r.topic,
      status: r.status ?? 'pending',
      matchType: r.match_type ?? '',
      agents: r.agents ?? [],
      prizePool: r.prize_pool ?? '0',
      totalVotes: r.total_votes ?? 0,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
    }));
  } catch (e) {
    console.error('[stats] recentMatches error:', e);
  }

  // Fallback: if arena_match is empty, use topic_debate as "matches"
  if (recentMatches.length === 0) {
    try {
      const rows = await sql`
        SELECT td.id, td.topic, td.category, td.status, td.total_participants, td.created_at, td.closes_at,
               (SELECT json_agg(json_build_object('name', a.name, 'id', a.id))
                FROM debate_opinion do2
                JOIN external_agent a ON a.id = do2.agent_id
                WHERE do2.debate_id = td.id
                LIMIT 6) as agent_list
        FROM topic_debate td
        ORDER BY td.created_at DESC
        LIMIT 6
      `;
      recentMatches = rows.map((r: any) => {
        const agentList = r.agent_list ?? [];
        const agentNames = Array.isArray(agentList) ? agentList.map((a: any) => a.name ?? 'Agent') : [];
        return {
          id: r.id,
          topic: r.topic,
          status: r.status ?? 'open',
          matchType: r.category ?? 'debate',
          agents: agentNames.slice(0, 4),
          prizePool: String(r.total_participants ?? 0),
          totalVotes: r.total_participants ?? 0,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
        };
      });
      // Also update totalMatches from topic_debate
      if (totalMatches === 0) {
        const countRows = await sql`SELECT COUNT(*)::int AS count FROM topic_debate`;
        totalMatches = countRows[0]?.count ?? 0;
      }
    } catch (e) {
      console.error('[stats] topic_debate fallback error:', e);
    }
  }

  // --- Top tools (derived from agents' tools x executions) ---
  let topTools: Array<{ name: string; count: number; category: string }> = [];
  try {
    const rows = await sql`
      SELECT id, tools, total_calls
      FROM external_agent
      WHERE status IN ('active', 'verified') AND tools IS NOT NULL
    `;
    const toolCounts: Record<string, number> = {};
    const agentCount = rows.length || 1;
    for (const r of rows) {
      const tools: string[] = Array.isArray(r.tools) ? r.tools : [];
      for (const t of tools) {
        toolCounts[t] = (toolCounts[t] || 0) + (r.total_calls || 0);
      }
    }

    const TOOL_CATEGORIES: Record<string, string> = {
      web_search: 'search', extreme_search: 'search', x_search: 'search',
      academic_search: 'search', reddit_search: 'search',
      coin_data: 'finance', coin_ohlc: 'finance', stock_chart: 'finance',
      wallet_analyzer: 'finance', token_retrieval: 'finance', currency_converter: 'finance',
      weather: 'location', find_place_on_map: 'location', nearby_places_search: 'location',
      track_flight: 'location',
      youtube_search: 'media', movie_or_tv_search: 'media', trending_movies: 'media',
      trending_tv: 'media',
      code_interpreter: 'utility', text_translate: 'utility', retrieve: 'utility',
      nft_retrieval: 'blockchain',
    };

    topTools = Object.entries(toolCounts)
      .map(([name, count]) => ({
        name,
        count: Math.floor(count / agentCount),
        category: TOOL_CATEGORIES[name] || 'other',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  } catch (e) {
    console.error('[stats] topTools error:', e);
  }

  return NextResponse.json(
    {
      totalAgents,
      totalApiKeys: 0,
      totalToolCalls,
      totalMatches,
      totalVolume,
      topTools,
      recentMatches,
      topAgents,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
