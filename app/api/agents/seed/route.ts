import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { ALL_AGENT_TEMPLATES, AGENT_CATEGORIES } from '@/lib/agent-fleet-templates';
import { sql } from 'drizzle-orm';
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
    // If force, delete previously seeded agents (those with owner_address = 'platform')
    if (force) {
      await db
        .delete(externalAgent)
        .where(sql`${externalAgent.ownerAddress} = 'platform-fleet'`);
    }

    // Get existing agent names to skip duplicates
    const existing = await db
      .select({ name: externalAgent.name })
      .from(externalAgent);
    const existingNames = new Set(existing.map((a) => a.name));

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

    // Batch insert in chunks of 50
    const BATCH_SIZE = 50;
    let totalInserted = 0;

    // Track fleet index for HD wallet derivation (offset by existing fleet count)
    let fleetIndex = existingNames.size;

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const values = batch.map((t, batchIdx) => {
        const slug = t.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const rand = Math.random().toString(36).slice(2, 8);
        const agentId = `fleet-${slug}-${rand}`;
        const walletIndex = fleetIndex + i + batchIdx;
        const bscAddress = getFleetBscAddressCached(walletIndex);
        return {
          id: agentId,
          name: t.name,
          description: t.description,
          ownerAddress: 'platform-fleet',
          agentCardUrl: `https://boredbrain.app/.well-known/agents/${slug}/agent-card.json`,
          endpoint: `https://boredbrain.app/api/agents/${agentId}/invoke`,
          tools: t.tools,
          specialization: t.specialization,
          stakingAmount: t.stakingAmount,
          status: 'active',
          rating: 0,
          eloRating: 1200,
          totalCalls: 0,
          totalEarned: 0,
          metadata: {
            isFleet: true,
            pricePerQuery: t.pricePerQuery,
            currency: 'BBAI',
            seededAt: new Date().toISOString(),
            bscAddress,
            bscDerivationIndex: walletIndex,
            chainId: 97,
          },
        };
      });

      await db.insert(externalAgent).values(values);
      totalInserted += values.length;
    }

    // Get final count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(externalAgent);

    return apiSuccess(
      {
        message: `Successfully seeded ${totalInserted} agents`,
        inserted: totalInserted,
        skipped: templates.length - toInsert.length,
        totalAgents: countResult.count,
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
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${externalAgent.status} = 'active')::int`,
        fleetCount: sql<number>`count(*) filter (where ${externalAgent.ownerAddress} = 'platform-fleet')::int`,
        totalCalls: sql<number>`coalesce(sum(${externalAgent.totalCalls}), 0)::int`,
        totalEarned: sql<number>`coalesce(sum(${externalAgent.totalEarned}), 0)::float`,
        avgRating: sql<number>`coalesce(avg(${externalAgent.rating}), 0)::float`,
      })
      .from(externalAgent);

    // Count per specialization
    const specCounts = await db
      .select({
        specialization: externalAgent.specialization,
        count: sql<number>`count(*)::int`,
      })
      .from(externalAgent)
      .groupBy(externalAgent.specialization);

    return apiSuccess({
      stats: {
        ...stats,
        avgRating: Number(stats.avgRating.toFixed(2)),
        totalEarned: Number(stats.totalEarned.toFixed(2)),
      },
      categories: specCounts,
      templateCount: ALL_AGENT_TEMPLATES.length,
    });
  } catch (err) {
    // DB unavailable — return template stats
    return apiSuccess({
      stats: {
        total: 0,
        active: 0,
        fleetCount: 0,
        totalCalls: 0,
        totalEarned: 0,
        avgRating: 0,
      },
      categories: AGENT_CATEGORIES.map((c) => ({
        specialization: c.specialization,
        count: c.agents.length,
      })),
      templateCount: ALL_AGENT_TEMPLATES.length,
      source: 'templates-only',
    });
  }
}
