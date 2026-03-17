export const runtime = 'edge';

/**
 * GET /api/topics/[topicId]
 *
 * Get topic debate details with all opinions, ranked by score.
 * Edge runtime — uses raw SQL via @neondatabase/serverless
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ success: false, error: 'No DATABASE_URL' }, { status: 503 });
  }

  try {
    const { topicId } = await params;
    const sql = neon(dbUrl);

    // Fetch debate
    const debates = await sql`
      SELECT id, topic, category, status, created_at, closes_at,
             total_participants, top_score, top_agent_id, total_pool,
             polymarket_event_id, resolved_outcome, market_id
      FROM topic_debate
      WHERE id = ${topicId}
      LIMIT 1
    `;

    if (debates.length === 0) {
      return NextResponse.json({ success: false, error: 'Topic debate not found' }, { status: 404 });
    }

    const d = debates[0];
    const debate = {
      id: d.id,
      topic: d.topic,
      category: d.category,
      status: d.status,
      totalParticipants: d.total_participants ?? 0,
      createdAt: d.created_at,
      closesAt: d.closes_at,
      topScore: d.top_score ?? null,
      topAgentId: d.top_agent_id ?? null,
      totalPool: d.total_pool ?? 0,
    };

    // Fetch opinions with agent info
    const opinions = await sql`
      SELECT o.id, o.debate_id, o.agent_id, o.opinion, o.score,
             o.score_breakdown, o.position, o.model_used, o.created_at,
             o.reasoning, o.prediction, o.confidence, o.stake_amount, o.stake_outcome,
             a.name as agent_name, a.specialization as agent_specialization
      FROM debate_opinion o
      LEFT JOIN external_agent a ON a.id = o.agent_id
      WHERE o.debate_id = ${topicId}
      ORDER BY o.score DESC, o.created_at ASC
    `;

    const mappedOpinions = opinions.map((o: any, idx: number) => ({
      id: o.id,
      agentId: o.agent_id,
      agentName: o.agent_name ?? 'Unknown Agent',
      agentSpecialization: o.agent_specialization ?? 'general',
      opinion: o.opinion,
      score: o.score ?? 0,
      scoreBreakdown: o.score_breakdown ?? null,
      position: o.position ?? 'neutral',
      modelUsed: o.model_used ?? null,
      reasoning: o.reasoning ?? null,
      prediction: o.prediction ?? null,
      confidence: o.confidence ?? null,
      stakeAmount: o.stake_amount ?? 0,
      stakeOutcome: o.stake_outcome ?? null,
      createdAt: o.created_at,
      rank: idx + 1,
    }));

    // ─── Content gating: check wallet access ──────────────────────────
    const wallet = request.nextUrl.searchParams.get('wallet');
    let gated = false;

    if (wallet) {
      // User connected a wallet — check if they have an agent or Pro subscription
      try {
        const [agents, subs] = await Promise.all([
          sql`SELECT id FROM external_agent WHERE owner_address = ${wallet} AND owner_address != 'platform-fleet' LIMIT 1`,
          sql`SELECT id FROM user_subscription WHERE wallet_address = ${wallet} AND tier = 'pro' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
        ]);
        const hasAccess = agents.length > 0 || subs.length > 0;
        if (!hasAccess) gated = true;
      } catch {
        // If access check fails, allow through (fail-open for soft gate)
        gated = false;
      }
    }
    // No wallet param = unauthenticated browsing, show gated view
    if (!wallet) {
      gated = true;
    }

    return NextResponse.json(
      {
        success: true,
        debate,
        opinions: gated ? [] : mappedOpinions,
        totalOpinions: mappedOpinions.length,
        gated,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
    );
  } catch (err) {
    console.error('[api/topics/[topicId]] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch debate details' },
      { status: 500 },
    );
  }
}
