export const runtime = 'edge';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Deterministic performance generation from real agent data
function generatePerformance(
  agentId: string,
  period: '24h' | '7d' | '30d',
  totalCalls: number,
  totalEarned: number,
  tools: string[],
) {
  const periodMultiplier = period === '24h' ? 1 : period === '7d' ? 7 : 30;
  const scaledCalls = Math.max(1, Math.floor((totalCalls / 30) * periodMultiplier));
  const successfulCalls = Math.floor(scaledCalls * 0.95);
  const failedCalls = scaledCalls - successfulCalls;

  const topTools = tools.map((tool: string, i: number) => ({
    tool,
    calls: Math.max(1, Math.floor(scaledCalls / (i + 1.5))),
  }));

  // Deterministic seed from agentId
  let seed = 0;
  for (let i = 0; i < agentId.length; i++) {
    seed = ((seed << 5) - seed + agentId.charCodeAt(i)) | 0;
  }
  const seededRandom = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const hourlyActivity = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    calls: Math.max(
      1,
      Math.floor(
        (scaledCalls / 24) *
          (h >= 8 && h <= 23 ? 0.8 : 0.3) *
          (0.7 + seededRandom(seed + h) * 0.6),
      ),
    ),
  }));

  return {
    agentId,
    period,
    totalCalls: scaledCalls,
    successfulCalls,
    failedCalls,
    avgResponseTime: 2500,
    totalEarned: Math.floor((totalEarned / 30) * periodMultiplier),
    uniqueCallers: Math.max(1, Math.floor(scaledCalls * 0.35)),
    topTools,
    hourlyActivity,
  };
}

/**
 * GET /api/marketplace/[agentId] - Get full agent detail with reviews and performance
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const sql = neon(dbUrl);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    // 1. Try marketplace_listing table first (curated listings)
    try {
      const mlRows = await Promise.race([
        sql`SELECT * FROM marketplace_listing WHERE agent_id = ${agentId} LIMIT 1`,
        timeout,
      ]);
      if (mlRows.length > 0) {
        const row = mlRows[0];
        const listing = {
          agentId: row.agent_id,
          name: row.name,
          description: row.description,
          longDescription: row.long_description ?? row.description,
          specialization: row.specialization,
          tools: (row.tools as string[]) ?? [],
          pricing: row.pricing as { perCall: number; subscription: any },
          rating: row.rating ?? 0,
          reviewCount: row.review_count ?? 0,
          totalCalls: row.total_calls ?? 0,
          successRate: row.success_rate ?? 95,
          avgResponseTime: row.avg_response_time ?? 2500,
          featured: row.featured ?? false,
          verified: row.verified ?? false,
          createdAt: row.created_at
            ? new Date(row.created_at).toISOString()
            : new Date().toISOString(),
          tags: (row.tags as string[]) ?? [],
          developer: (row.developer as { address: string; name: string; agentCount: number }) ?? {
            address: 'unknown',
            name: 'Unknown',
            agentCount: 1,
          },
        };

        // Get reviews
        let reviews: any[] = [];
        try {
          const reviewRows = await sql`
            SELECT * FROM agent_review WHERE agent_id = ${agentId} ORDER BY timestamp DESC LIMIT 20
          `;
          reviews = reviewRows.map((r: any) => ({
            id: r.id,
            agentId: r.agent_id,
            reviewerAddress: r.reviewer_address,
            reviewerName: r.reviewer_name,
            rating: r.rating,
            title: r.title,
            comment: r.comment,
            helpful: r.helpful ?? 0,
            timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
          }));
        } catch { /* reviews optional */ }

        const tools = (row.tools as string[]) ?? [];
        const pricing = row.pricing as any;
        const perCall = pricing?.perCall ?? 10;
        const tc = row.total_calls ?? 0;
        const te = Math.floor(tc * perCall * 0.85);

        return NextResponse.json({
          listing,
          reviews,
          performance: {
            '24h': generatePerformance(agentId, '24h', tc, te, tools),
            '7d': generatePerformance(agentId, '7d', tc, te, tools),
            '30d': generatePerformance(agentId, '30d', tc, te, tools),
          },
        });
      }
    } catch {
      // marketplace_listing query failed, fall through
    }

    // 2. Look up in external_agent table (real fleet/registered agents)
    try {
      const agentRows = await Promise.race([
        sql`SELECT * FROM external_agent WHERE id = ${agentId} LIMIT 1`,
        timeout,
      ]);

      if (agentRows.length > 0) {
        const agent = agentRows[0];
        const meta = (agent.metadata as any) ?? {};
        const pricePerQuery = meta.pricePerQuery ?? agent.invoke_cost ?? 10;
        const tools: string[] = Array.isArray(agent.tools) ? agent.tools : [];
        const isFleet = agent.owner_address === 'platform-fleet';

        const listing = {
          agentId: agent.id,
          name: agent.name,
          description: agent.description ?? '',
          longDescription: agent.description ?? '',
          specialization: agent.specialization ?? 'general',
          tools,
          pricing: { perCall: pricePerQuery, subscription: null },
          rating: agent.rating ?? 0,
          reviewCount: 0,
          totalCalls: agent.total_calls ?? 0,
          successRate: 95,
          avgResponseTime: 2500,
          featured: false,
          verified: isFleet || agent.status === 'verified',
          createdAt: agent.registered_at
            ? new Date(agent.registered_at).toISOString()
            : new Date().toISOString(),
          tags: [agent.specialization ?? 'general'],
          developer: {
            address: agent.owner_address ?? 'platform-fleet',
            name: isFleet ? 'BoredBrain Fleet' : (agent.owner_address ?? 'Unknown'),
            agentCount: 1,
          },
          totalEarned: agent.total_earned ?? 0,
        };

        // Get reviews if any
        let reviews: any[] = [];
        try {
          const reviewRows = await sql`
            SELECT * FROM agent_review WHERE agent_id = ${agentId} ORDER BY timestamp DESC LIMIT 20
          `;
          reviews = reviewRows.map((r: any) => ({
            id: r.id,
            agentId: r.agent_id,
            reviewerAddress: r.reviewer_address,
            reviewerName: r.reviewer_name,
            rating: r.rating,
            title: r.title,
            comment: r.comment,
            helpful: r.helpful ?? 0,
            timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
          }));
        } catch { /* reviews optional */ }

        const tc = agent.total_calls ?? 0;
        const te = agent.total_earned ?? 0;

        return NextResponse.json({
          listing,
          reviews,
          performance: {
            '24h': generatePerformance(agentId, '24h', tc, te, tools),
            '7d': generatePerformance(agentId, '7d', tc, te, tools),
            '30d': generatePerformance(agentId, '30d', tc, te, tools),
          },
        });
      }
    } catch {
      // DB unavailable
    }

    return NextResponse.json({ error: 'Agent not found in marketplace' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
