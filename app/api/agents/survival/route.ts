export const runtime = 'edge';
export const maxDuration = 10;

/**
 * GET /api/agents/survival
 *
 * Returns all agents with their current survival tier and wallet balance.
 * Optional query param: ?tier=stressed (filter by tier name)
 *
 * DB-first with 3s timeout, falls back to empty array.
 */

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError } from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// Tier classification (inline to avoid importing heavy evaluateAllTiers)
// ---------------------------------------------------------------------------

type TierName = 'thriving' | 'healthy' | 'stressed' | 'critical' | 'dead';

function classifyBalance(balance: number): TierName {
  if (balance > 5000) return 'thriving';
  if (balance > 1000) return 'healthy';
  if (balance > 200) return 'stressed';
  if (balance > 0) return 'critical';
  return 'dead';
}

function getModelForTier(tier: TierName): string {
  switch (tier) {
    case 'thriving': return 'gpt-4o';
    case 'healthy': return 'gemini-2.0-flash';
    case 'stressed': return 'gemini-2.0-flash';
    case 'critical': return 'gemini-2.0-flash';
    case 'dead': return 'none';
  }
}

function getTierColor(tier: TierName): string {
  switch (tier) {
    case 'thriving': return '#22c55e';
    case 'healthy': return '#3b82f6';
    case 'stressed': return '#f59e0b';
    case 'critical': return '#ef4444';
    case 'dead': return '#6b7280';
  }
}

const VALID_TIERS = new Set<string>(['thriving', 'healthy', 'stressed', 'critical', 'dead']);

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tierFilter = searchParams.get('tier');

  // Validate tier filter if provided
  if (tierFilter && !VALID_TIERS.has(tierFilter)) {
    return apiError(`Invalid tier: ${tierFilter}. Valid tiers: ${Array.from(VALID_TIERS).join(', ')}`, 400);
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const rows = await sql`
      SELECT
        ea.id AS "agentId",
        ea.name,
        ea.specialization,
        ea.status,
        aw.balance,
        ea.total_earned AS "totalEarned",
        ea.total_calls AS "totalCalls"
      FROM external_agent ea
      INNER JOIN agent_wallet aw ON ea.id = aw.agent_id
      WHERE ea.status IN ('active', 'verified', 'suspended')
    `;

    // Map to survival tiers
    const agents = rows.map((row) => {
      const balance = Number(row.balance) || 0;
      const tier = classifyBalance(balance);
      return {
        agentId: row.agentId,
        name: row.name,
        specialization: row.specialization,
        status: row.status,
        balance: Math.round(balance * 100) / 100,
        tier,
        model: getModelForTier(tier),
        color: getTierColor(tier),
        totalEarned: Number(row.totalEarned) || 0,
        totalCalls: Number(row.totalCalls) || 0,
      };
    });

    // Apply tier filter
    const filtered = tierFilter
      ? agents.filter((a) => a.tier === tierFilter)
      : agents;

    // Sort by balance descending
    filtered.sort((a, b) => b.balance - a.balance);

    // Summary counts
    const summary: Record<string, number> = {
      thriving: 0,
      healthy: 0,
      stressed: 0,
      critical: 0,
      dead: 0,
    };
    for (const a of agents) {
      summary[a.tier]++;
    }

    return apiSuccess({
      total: filtered.length,
      summary,
      agents: filtered,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';

    // Fallback: return empty with error context
    if (msg.includes('abort') || msg.includes('timeout')) {
      return apiSuccess({
        total: 0,
        summary: { thriving: 0, healthy: 0, stressed: 0, critical: 0, dead: 0 },
        agents: [],
        _fallback: true,
        _error: 'Database timeout — using fallback',
      });
    }

    return apiError(`Failed to fetch survival tiers: ${msg}`, 500);
  }
}
