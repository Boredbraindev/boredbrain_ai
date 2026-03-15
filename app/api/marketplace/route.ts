export const runtime = 'edge';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/marketplace - List marketplace agents from real external_agent data
 *
 * Query params:
 *   ?specialization=defi    - Filter by specialization
 *   ?sort=rating|calls|earned - Sort order
 *   ?featured=true          - Featured/boosted agents only
 *   ?search=query           - Search by name, description, specialization
 *   ?minRating=4            - Minimum rating filter
 *   ?limit=50               - Max results (default 50)
 *   ?offset=0               - Pagination offset
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const specialization = searchParams.get('specialization') ?? undefined;
  const sort = searchParams.get('sort') as 'rating' | 'calls' | 'earned' | undefined;
  const featured = searchParams.get('featured') === 'true' ? true : undefined;
  const search = searchParams.get('search') ?? undefined;
  const minRatingStr = searchParams.get('minRating');
  const minRating = minRatingStr ? parseFloat(minRatingStr) : undefined;
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { listings: [], stats: { totalAgents: 0, totalCalls: 0, totalVolume: 0, avgRating: 0, topSpecializations: [] }, count: 0 },
      { status: 200 },
    );
  }

  try {
    const sql = neon(dbUrl);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    // Build WHERE conditions
    const conditions: string[] = [`status IN ('active', 'verified')`];
    const params: any[] = [];
    let paramIdx = 1;

    if (specialization && specialization !== 'all') {
      conditions.push(`lower(specialization) = lower($${paramIdx})`);
      params.push(specialization);
      paramIdx++;
    }

    if (featured) {
      conditions.push(`boosted_until > NOW()`);
    }

    if (search) {
      conditions.push(
        `(lower(name) LIKE $${paramIdx} OR lower(COALESCE(description, '')) LIKE $${paramIdx} OR lower(specialization) LIKE $${paramIdx})`,
      );
      params.push(`%${search.toLowerCase()}%`);
      paramIdx++;
    }

    if (minRating !== undefined && minRating > 0) {
      conditions.push(`rating >= $${paramIdx}`);
      params.push(minRating);
      paramIdx++;
    }

    // Sort
    let orderBy = 'total_calls DESC, rating DESC';
    if (sort === 'rating') {
      orderBy = 'rating DESC, total_calls DESC';
    } else if (sort === 'calls') {
      orderBy = 'total_calls DESC';
    } else if (sort === 'earned') {
      orderBy = 'total_earned DESC';
    }

    const whereClause = conditions.join(' AND ');

    // Fetch agents
    const query = `
      SELECT
        id, name, description, owner_address, specialization, tools,
        rating, total_calls, total_earned, status, metadata,
        invoke_cost, boosted_until, registered_at, staking_amount
      FROM external_agent
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const agentsPromise = sql(query, params);
    const agents = await Promise.race([agentsPromise, timeout]) as any[];

    // Transform to marketplace listing format
    const listings = agents.map((agent: any) => {
      const meta = agent.metadata ?? {};
      const pricePerQuery = meta.pricePerQuery ?? agent.invoke_cost ?? 10;
      const tools: string[] = Array.isArray(agent.tools) ? agent.tools : [];
      const isBoosted = agent.boosted_until && new Date(agent.boosted_until) > new Date();
      const isFleet = agent.owner_address === 'platform-fleet';

      return {
        agentId: agent.id,
        name: agent.name,
        description: agent.description ?? '',
        longDescription: agent.description ?? '',
        specialization: agent.specialization ?? 'general',
        tools,
        pricing: {
          perCall: pricePerQuery,
          subscription: null,
        },
        rating: agent.rating ?? 0,
        reviewCount: 0,
        totalCalls: agent.total_calls ?? 0,
        successRate: 95,
        avgResponseTime: 2500,
        featured: !!isBoosted,
        verified: isFleet || agent.status === 'verified',
        createdAt: agent.registered_at
          ? new Date(agent.registered_at).toISOString()
          : new Date().toISOString(),
        tags: [agent.specialization ?? 'general'],
        developer: {
          address: agent.owner_address ?? 'unknown',
          name: isFleet ? 'BoredBrain Fleet' : (agent.owner_address ?? 'Unknown'),
          agentCount: 1,
        },
        totalEarned: agent.total_earned ?? 0,
      };
    });

    // Compute stats from the full set (not paginated)
    const statsQuery = `
      SELECT
        COUNT(*)::int AS total_agents,
        COALESCE(SUM(total_calls), 0)::int AS total_calls,
        COALESCE(SUM(total_earned), 0)::float AS total_volume,
        COALESCE(ROUND(AVG(rating)::numeric, 1)::float, 0) AS avg_rating
      FROM external_agent
      WHERE status IN ('active', 'verified')
    `;
    let stats = { totalAgents: listings.length, totalCalls: 0, totalVolume: 0, avgRating: 0, topSpecializations: [] as string[] };
    try {
      const statsRows = await Promise.race([sql(statsQuery), timeout]) as any[];
      if (statsRows.length > 0) {
        const s = statsRows[0];
        stats = {
          totalAgents: s.total_agents ?? listings.length,
          totalCalls: s.total_calls ?? 0,
          totalVolume: Math.round(s.total_volume ?? 0),
          avgRating: s.avg_rating ?? 0,
          topSpecializations: [],
        };
      }
    } catch { /* stats are best-effort */ }

    // Top specializations
    try {
      const specRows = await sql`
        SELECT specialization, COUNT(*)::int AS cnt
        FROM external_agent
        WHERE status IN ('active', 'verified')
        GROUP BY specialization
        ORDER BY cnt DESC
        LIMIT 8
      `;
      stats.topSpecializations = specRows.map((r: any) => r.specialization);
    } catch { /* best-effort */ }

    return NextResponse.json(
      { listings, stats, count: listings.length },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch (err: any) {
    console.error('[marketplace] error:', err);
    return NextResponse.json(
      { listings: [], stats: { totalAgents: 0, totalCalls: 0, totalVolume: 0, avgRating: 0, topSpecializations: [] }, count: 0, error: err.message },
      { status: 200 },
    );
  }
}
