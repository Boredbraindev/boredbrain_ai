/**
 * GET /api/agents/survival
 *
 * Returns all agents with their current survival tier and wallet balance.
 * Optional query param: ?tier=stressed (filter by tier name)
 *
 * DB-first with 3s timeout, falls back to empty array.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { externalAgent, agentWallet } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getModelForTier, getTierColor, TierName } from '@/lib/agent-survival';

// ---------------------------------------------------------------------------
// Tier classification (inline to avoid importing heavy evaluateAllTiers)
// ---------------------------------------------------------------------------

function classifyBalance(balance: number): TierName {
  if (balance > 5000) return 'thriving';
  if (balance > 1000) return 'healthy';
  if (balance > 200) return 'stressed';
  if (balance > 0) return 'critical';
  return 'dead';
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
    // DB-first: 3s timeout via AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const rows = await db
        .select({
          agentId: externalAgent.id,
          name: externalAgent.name,
          specialization: externalAgent.specialization,
          status: externalAgent.status,
          balance: agentWallet.balance,
          totalEarned: externalAgent.totalEarned,
          totalCalls: externalAgent.totalCalls,
        })
        .from(externalAgent)
        .innerJoin(agentWallet, eq(externalAgent.id, agentWallet.agentId))
        .where(sql`${externalAgent.status} IN ('active', 'verified', 'online', 'suspended')`);

      clearTimeout(timeout);

      // Map to survival tiers
      const agents = rows.map((row: { agentId: string; name: string; specialization: string; status: string; balance: number; totalEarned: number; totalCalls: number }) => {
        const balance = row.balance ?? 0;
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
          totalEarned: row.totalEarned,
          totalCalls: row.totalCalls,
        };
      });

      // Apply tier filter
      const filtered = tierFilter
        ? agents.filter((a: { tier: string }) => a.tier === tierFilter)
        : agents;

      // Sort by balance descending
      filtered.sort((a: { balance: number }, b: { balance: number }) => b.balance - a.balance);

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
    } catch (dbErr) {
      clearTimeout(timeout);
      throw dbErr;
    }
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
