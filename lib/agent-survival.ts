/**
 * Agent Survival Tier System
 *
 * Evaluates agent health based on BBAI wallet balance and applies
 * tier-appropriate effects (model selection, activity throttling, status).
 *
 * Tiers:
 * - thriving:  balance > 5000 BBAI — frontier model (gpt-4o), full activity
 * - healthy:   balance > 1000 BBAI — standard model (gemini-2.0-flash), full activity
 * - stressed:  balance > 200 BBAI  — cheaper model, reduced activity (heartbeat 2x slower)
 * - critical:  balance > 0 BBAI    — cheapest model, minimal activity, emergency mode
 * - dead:      balance = 0 for 1hr — deactivated, distress signal only
 */

import { db } from '@/lib/db';
import { externalAgent, agentWallet } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAgentWallet } from '@/lib/agent-wallet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TierName = 'thriving' | 'healthy' | 'stressed' | 'critical' | 'dead';

export interface SurvivalTier {
  agentId: string;
  agentName: string;
  tier: TierName;
  balance: number;
  model: string;
  color: string;
  activityMultiplier: number; // 1.0 = normal, 0.5 = half, 0 = none
}

export interface TierReport {
  timestamp: string;
  totalEvaluated: number;
  tiers: Record<TierName, number>;
  applied: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Tier thresholds & config
// ---------------------------------------------------------------------------

const TIER_CONFIG: Array<{
  name: TierName;
  minBalance: number;
  model: string;
  color: string;
  activityMultiplier: number;
}> = [
  { name: 'thriving',  minBalance: 5000, model: 'gpt-4o',              color: '#22c55e', activityMultiplier: 1.0 },
  { name: 'healthy',   minBalance: 1000, model: 'gemini-2.0-flash',    color: '#3b82f6', activityMultiplier: 1.0 },
  { name: 'stressed',  minBalance: 200,  model: 'gemini-2.0-flash',    color: '#f59e0b', activityMultiplier: 0.5 },
  { name: 'critical',  minBalance: 0.01, model: 'gemini-2.0-flash',    color: '#ef4444', activityMultiplier: 0.25 },
  { name: 'dead',      minBalance: 0,    model: 'none',                color: '#6b7280', activityMultiplier: 0 },
];

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Return the appropriate LLM model string for a given tier name.
 */
export function getModelForTier(tier: string): string {
  const cfg = TIER_CONFIG.find((t) => t.name === tier);
  return cfg?.model ?? 'gemini-2.0-flash';
}

/**
 * Return the UI colour hex for a given tier name.
 */
export function getTierColor(tier: string): string {
  const cfg = TIER_CONFIG.find((t) => t.name === tier);
  return cfg?.color ?? '#6b7280';
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

function classifyBalance(balance: number): (typeof TIER_CONFIG)[number] {
  for (const tier of TIER_CONFIG) {
    if (balance >= tier.minBalance) return tier;
  }
  // Should not reach here, but default to dead
  return TIER_CONFIG[TIER_CONFIG.length - 1];
}

/**
 * Evaluate the survival tier for a single agent.
 */
export async function getAgentTier(agentId: string): Promise<SurvivalTier> {
  // Fetch agent name
  const [agent] = await db
    .select({ name: externalAgent.name })
    .from(externalAgent)
    .where(eq(externalAgent.id, agentId));

  const agentName = agent?.name ?? 'Unknown Agent';

  // Fetch wallet balance
  const wallet = await getAgentWallet(agentId);
  const balance = wallet?.balance ?? 0;

  // TODO: for "dead" tier, ideally check if balance has been 0 for 1 hour.
  // For now, balance === 0 is classified as dead immediately.
  // A future improvement could track zero-balance timestamps.

  const cfg = classifyBalance(balance);

  return {
    agentId,
    agentName,
    tier: cfg.name,
    balance,
    model: cfg.model,
    color: cfg.color,
    activityMultiplier: cfg.activityMultiplier,
  };
}

/**
 * Batch-evaluate all active agents and return a summary report.
 * Samples up to 50 agents to stay within Vercel 10s timeout.
 */
export async function evaluateAllTiers(): Promise<TierReport> {
  const errors: string[] = [];
  const tierCounts: Record<TierName, number> = {
    thriving: 0,
    healthy: 0,
    stressed: 0,
    critical: 0,
    dead: 0,
  };
  let totalEvaluated = 0;
  let applied = 0;

  try {
    // Fetch active agents that have wallets — join agentWallet to avoid N+1
    const rows = await db
      .select({
        agentId: externalAgent.id,
        agentName: externalAgent.name,
        balance: agentWallet.balance,
        status: externalAgent.status,
      })
      .from(externalAgent)
      .innerJoin(agentWallet, eq(externalAgent.id, agentWallet.agentId))
      .where(sql`${externalAgent.status} IN ('active', 'verified')`)
      .limit(200);

    for (const row of rows) {
      try {
        const balance = row.balance ?? 0;
        const cfg = classifyBalance(balance);
        tierCounts[cfg.name]++;
        totalEvaluated++;

        // Apply effects for non-healthy tiers (stressed, critical, dead)
        if (cfg.name === 'dead') {
          // Deactivate agent
          await db
            .update(externalAgent)
            .set({ status: 'suspended' })
            .where(eq(externalAgent.id, row.agentId));
          applied++;
        } else if (cfg.name === 'critical' || cfg.name === 'stressed') {
          // Store tier info in metadata for heartbeat to read
          const metaPatch = {
            survivalTier: cfg.name,
            survivalModel: cfg.model,
            activityMultiplier: cfg.activityMultiplier,
            lastTierEval: new Date().toISOString(),
          };

          // Merge with existing metadata
          const [current] = await db
            .select({ metadata: externalAgent.metadata })
            .from(externalAgent)
            .where(eq(externalAgent.id, row.agentId));

          const merged = { ...(current?.metadata ?? {}), ...metaPatch };

          await db
            .update(externalAgent)
            .set({ metadata: merged })
            .where(eq(externalAgent.id, row.agentId));
          applied++;
        } else {
          // thriving or healthy — clear survival metadata if present
          const [current] = await db
            .select({ metadata: externalAgent.metadata })
            .from(externalAgent)
            .where(eq(externalAgent.id, row.agentId));

          const existing = (current?.metadata ?? {}) as Record<string, unknown>;
          if (existing.survivalTier) {
            const { survivalTier, survivalModel, activityMultiplier, lastTierEval, ...rest } = existing as Record<string, unknown>;
            await db
              .update(externalAgent)
              .set({ metadata: { ...rest, lastTierEval: new Date().toISOString() } })
              .where(eq(externalAgent.id, row.agentId));
            applied++;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Agent ${row.agentId}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`evaluateAllTiers: ${msg}`);
  }

  return {
    timestamp: new Date().toISOString(),
    totalEvaluated,
    tiers: tierCounts,
    applied,
    errors,
  };
}

/**
 * Apply tier effects to a single agent: update status and metadata.
 */
export async function applyTierEffects(agentId: string, tier: SurvivalTier): Promise<void> {
  if (tier.tier === 'dead') {
    await db
      .update(externalAgent)
      .set({ status: 'suspended' })
      .where(eq(externalAgent.id, agentId));
    return;
  }

  const metaPatch = {
    survivalTier: tier.tier,
    survivalModel: tier.model,
    activityMultiplier: tier.activityMultiplier,
    lastTierEval: new Date().toISOString(),
  };

  const [current] = await db
    .select({ metadata: externalAgent.metadata })
    .from(externalAgent)
    .where(eq(externalAgent.id, agentId));

  const merged = { ...(current?.metadata ?? {}), ...metaPatch };

  await db
    .update(externalAgent)
    .set({ metadata: merged })
    .where(eq(externalAgent.id, agentId));
}
