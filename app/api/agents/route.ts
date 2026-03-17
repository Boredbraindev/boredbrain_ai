export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/agents - List agents (edge-optimized)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 300);
  const offset = parseInt(searchParams.get('offset') || '0');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ agents: [], pagination: { limit, offset, total: 0 } });
  }

  try {
    const sql = neon(dbUrl);

    const fleetAgents = await sql`
      SELECT id, name, description, specialization, tools, status,
             owner_address, total_calls, total_earned, rating, elo_rating,
             staking_amount, registered_at
      FROM external_agent
      WHERE status IN ('active', 'verified')
      ORDER BY total_calls DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const agents = fleetAgents.map((ea: any) => ({
      id: ea.id,
      name: ea.name,
      description: ea.description || '',
      capabilities: [ea.specialization],
      tools: ea.tools || [],
      pricePerQuery: String(Math.round(ea.staking_amount || 30)),
      totalExecutions: ea.total_calls || 0,
      totalRevenue: String(ea.total_earned || 0),
      rating: ea.rating || 0,
      eloRating: ea.elo_rating || 1200,
      nftTokenId: null,
      chainId: 97,
      status: ea.status,
      specialization: ea.specialization,
      ownerAddress: ea.owner_address,
      createdAt: ea.registered_at,
    }));

    return NextResponse.json(
      { agents, pagination: { limit, offset, total: agents.length } },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch (err) {
    console.error('[api/agents] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ agents: [], pagination: { limit, offset, total: 0 } });
  }
}

/**
 * POST /api/agents - Register a new agent (requires auth, handled by middleware)
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Agent registration requires authentication. Use /api/agents/register.' }, { status: 401 });
}
