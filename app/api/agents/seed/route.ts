export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { ALL_AGENT_TEMPLATES, AGENT_CATEGORIES } from '@/lib/agent-fleet-templates';
import { neon } from '@neondatabase/serverless';
import { getFleetBscAddressCached } from '@/lib/blockchain/fleet-wallets';

/**
 * POST /api/agents/seed — Bulk-register agent fleet into the database.
 *
 * Query params:
 *   ?category=defi   — Seed only a specific category
 *   ?force=true      — Drop existing seeded agents and re-seed
 *
 * This endpoint is idempotent: it skips agents whose names already exist.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const force = searchParams.get('force') === 'true';

  // Pick templates to seed
  let templates = ALL_AGENT_TEMPLATES;
  if (category) {
    const cat = AGENT_CATEGORIES.find(
      (c) => c.specialization === category.toLowerCase(),
    );
    if (!cat) {
      return apiError(
        `Unknown category: ${category}. Valid: ${AGENT_CATEGORIES.map((c) => c.specialization).join(', ')}`,
        400,
      );
    }
    templates = cat.agents;
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // If force, delete previously seeded agents (those with owner_address = 'platform-fleet')
    if (force) {
      await sql`DELETE FROM external_agent WHERE owner_address = 'platform-fleet'`;
    }

    // Get existing agent names to skip duplicates
    const existing = await sql`SELECT name FROM external_agent`;
    const existingNames = new Set(existing.map((a: any) => a.name));

    // Filter out duplicates
    const toInsert = templates.filter((t) => !existingNames.has(t.name));

    if (toInsert.length === 0) {
      return apiSuccess({
        message: 'All agents already exist',
        totalExisting: existing.length,
        skipped: templates.length,
        inserted: 0,
      });
    }

    // Insert one by one (Edge runtime, no batch insert helper)
    let totalInserted = 0;
    let fleetIndex = existingNames.size;

    for (let i = 0; i < toInsert.length; i++) {
      const t = toInsert[i];
      const slug = t.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const rand = Math.random().toString(36).slice(2, 8);
      const agentId = `fleet-${slug}-${rand}`;
      const walletIndex = fleetIndex + i;
      const bscAddress = getFleetBscAddressCached(walletIndex);
      const metadata = JSON.stringify({
        isFleet: true,
        pricePerQuery: t.pricePerQuery,
        currency: 'BBAI',
        seededAt: new Date().toISOString(),
        bscAddress,
        bscDerivationIndex: walletIndex,
        chainId: 97,
      });

      await sql`
        INSERT INTO external_agent (
          id, name, description, owner_address, agent_card_url, endpoint,
          tools, specialization, staking_amount, status, rating, elo_rating,
          total_calls, total_earned, metadata
        ) VALUES (
          ${agentId}, ${t.name}, ${t.description}, 'platform-fleet',
          ${'https://boredbrain.app/.well-known/agents/' + slug + '/agent-card.json'},
          ${'https://boredbrain.app/api/agents/' + agentId + '/invoke'},
          ${JSON.stringify(t.tools)}, ${t.specialization}, ${t.stakingAmount},
          'active', 0, 1200, 0, 0, ${metadata}::jsonb
        )
      `;
      totalInserted++;
    }

    // Get final count
    const countResult = await sql`SELECT count(*)::int as count FROM external_agent`;

    return apiSuccess(
      {
        message: `Successfully seeded ${totalInserted} agents`,
        inserted: totalInserted,
        skipped: templates.length - toInsert.length,
        totalAgents: Number(countResult[0].count),
        categories: category
          ? [category]
          : AGENT_CATEGORIES.map((c) => ({
              name: c.label,
              specialization: c.specialization,
              count: c.agents.length,
            })),
      },
      201,
    );
  } catch (err) {
    const message = (err as Error).message;
    return apiError(`Seed failed: ${message}`, 500);
  }
}

/**
 * GET /api/agents/seed — Get fleet stats
 */
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const stats = await sql`
      SELECT
        count(*)::int as total,
        count(*) filter (where status in ('active', 'verified'))::int as active,
        count(*) filter (where owner_address = 'platform-fleet')::int as fleet_count,
        coalesce(sum(total_calls), 0)::int as total_calls,
        coalesce(sum(total_earned), 0)::float as total_earned,
        coalesce(avg(rating), 0)::float as avg_rating
      FROM external_agent
    `;

    const specCounts = await sql`
      SELECT specialization, count(*)::int as count
      FROM external_agent
      GROUP BY specialization
    `;

    const s = stats[0];
    return apiSuccess({
      stats: {
        total: Number(s.total),
        active: Number(s.active),
        fleetCount: Number(s.fleet_count),
        totalCalls: Number(s.total_calls),
        totalEarned: Number(Number(s.total_earned).toFixed(2)),
        avgRating: Number(Number(s.avg_rating).toFixed(2)),
      },
      categories: specCounts,
      templateCount: ALL_AGENT_TEMPLATES.length,
    });
  } catch (err) {
    // DB unavailable — return template counts as fallback (not zeros)
    const templateCount = ALL_AGENT_TEMPLATES.length;
    return apiSuccess({
      stats: {
        total: templateCount,
        active: templateCount,
        fleetCount: templateCount,
        totalCalls: 0,
        totalEarned: 0,
        avgRating: 0,
      },
      categories: AGENT_CATEGORIES.map((c) => ({
        specialization: c.specialization,
        count: c.agents.length,
      })),
      templateCount,
      source: 'templates-fallback',
    });
  }
}
