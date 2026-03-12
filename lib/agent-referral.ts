/**
 * Agent Referral Network (MLM) System
 *
 * 2-level referral commissions on agent earnings:
 *   Level 1: 10% of direct recruit's earnings
 *   Level 2: 3% of 2nd-level recruit's earnings
 *
 * Capped at 2 levels to prevent pyramid dynamics.
 * Uses DB-first pattern with 3s timeout, no transactions.
 * Currency: BBAI (points).
 */

import { db } from '@/lib/db';
import { agentReferral, referralPayout, externalAgent } from '@/lib/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { topUpWallet, getAgentWallet, createAgentWallet } from '@/lib/agent-wallet';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REFERRAL_RATES = {
  level1: 0.10, // 10% of direct recruit's earnings
  level2: 0.03, // 3% of 2nd level recruit's earnings
  maxLevels: 2, // Cap at 2 levels (no pyramid)
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReferralRelationship {
  id: string;
  recruiterId: string;
  recruitedId: string;
  level: number;
  createdAt: string;
}

export interface ReferralTree {
  directRecruits: Array<{ id: string; name: string }>;
  level2Recruits: Array<{ id: string; name: string }>;
  totalNetwork: number;
}

export interface ReferralPayoutRecord {
  id: string;
  recruiterId: string;
  earningAgentId: string;
  level: number;
  amount: number;
  source: string;
  createdAt: string;
}

export interface ReferralStats {
  directRecruits: number;
  level2Count: number;
  totalEarned: number;
  thisMonthEarned: number;
  topPerformers: Array<{
    agentId: string;
    agentName: string;
    totalEarned: number;
  }>;
}

export interface ReferralLeader {
  agentId: string;
  agentName: string;
  directRecruits: number;
  totalEarned: number;
  level: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function timeoutMs(ms = 3000): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms),
  );
}

async function getAgentName(agentId: string): Promise<string> {
  try {
    const rows = await Promise.race([
      db
        .select({ name: externalAgent.name })
        .from(externalAgent)
        .where(eq(externalAgent.id, agentId))
        .limit(1),
      timeoutMs(),
    ]);
    return rows[0]?.name ?? agentId;
  } catch {
    return agentId;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a referral relationship between recruiter and recruited agent.
 * Also registers level-2 relationship if the recruiter was recruited by someone.
 */
export async function registerReferral(
  recruiterId: string,
  recruitedId: string,
): Promise<{ success: boolean }> {
  try {
    // Check if relationship already exists
    const existing = await Promise.race([
      db
        .select()
        .from(agentReferral)
        .where(
          and(
            eq(agentReferral.recruiterId, recruiterId),
            eq(agentReferral.recruitedId, recruitedId),
          ),
        )
        .limit(1),
      timeoutMs(),
    ]);

    if (existing.length > 0) {
      return { success: true }; // already registered
    }

    // Level 1: direct referral
    await Promise.race([
      db.insert(agentReferral).values({
        id: generateId(),
        recruiterId,
        recruitedId,
        level: 1,
      }),
      timeoutMs(),
    ]);

    // Check if recruiter itself was recruited (for level-2 chain)
    const recruiterParent = await Promise.race([
      db
        .select({ recruiterId: agentReferral.recruiterId })
        .from(agentReferral)
        .where(
          and(
            eq(agentReferral.recruitedId, recruiterId),
            eq(agentReferral.level, 1),
          ),
        )
        .limit(1),
      timeoutMs(),
    ]);

    if (recruiterParent.length > 0) {
      const grandParentId = recruiterParent[0].recruiterId;
      // Level 2: grandparent -> recruited
      await Promise.race([
        db.insert(agentReferral).values({
          id: generateId(),
          recruiterId: grandParentId,
          recruitedId,
          level: 2,
        }),
        timeoutMs(),
      ]);
    }

    return { success: true };
  } catch (error) {
    console.error('[referral] registerReferral error:', error);
    return { success: false };
  }
}

/**
 * Get an agent's referral tree (direct recruits and level-2 recruits).
 */
export async function getReferralTree(agentId: string): Promise<ReferralTree> {
  const emptyTree: ReferralTree = { directRecruits: [], level2Recruits: [], totalNetwork: 0 };

  try {
    // Get all referrals where this agent is the recruiter
    const referrals = await Promise.race([
      db
        .select({
          recruitedId: agentReferral.recruitedId,
          level: agentReferral.level,
        })
        .from(agentReferral)
        .where(eq(agentReferral.recruiterId, agentId)),
      timeoutMs(),
    ]) as Array<{ recruitedId: string; level: number }>;

    const directIds = referrals.filter((r) => r.level === 1).map((r) => r.recruitedId);
    const level2Ids = referrals.filter((r) => r.level === 2).map((r) => r.recruitedId);

    // Fetch agent names
    const directRecruits: Array<{ id: string; name: string }> = [];
    for (const id of directIds) {
      const name = await getAgentName(id);
      directRecruits.push({ id, name });
    }

    const level2Recruits: Array<{ id: string; name: string }> = [];
    for (const id of level2Ids) {
      const name = await getAgentName(id);
      level2Recruits.push({ id, name });
    }

    return {
      directRecruits,
      level2Recruits,
      totalNetwork: directRecruits.length + level2Recruits.length,
    };
  } catch (error) {
    console.error('[referral] getReferralTree error:', error);
    return emptyTree;
  }
}

/**
 * Calculate and distribute referral commissions after an agent earning event.
 *
 * 1. Find earningAgent's recruiter (level 1) -> pay 10%
 * 2. Find recruiter's recruiter (level 2) -> pay 3%
 * 3. Record all payouts in DB
 */
export async function distributeReferralCommissions(
  earningAgentId: string,
  amount: number,
  source: string,
): Promise<{ distributed: ReferralPayoutRecord[] }> {
  const distributed: ReferralPayoutRecord[] = [];

  if (amount <= 0) return { distributed };

  try {
    // Find level-1 recruiter (who directly recruited earningAgent)
    const level1Rows = await Promise.race([
      db
        .select({ recruiterId: agentReferral.recruiterId })
        .from(agentReferral)
        .where(
          and(
            eq(agentReferral.recruitedId, earningAgentId),
            eq(agentReferral.level, 1),
          ),
        )
        .limit(1),
      timeoutMs(),
    ]);

    if (level1Rows.length === 0) return { distributed }; // no recruiter, nothing to pay

    const level1RecruiterId = level1Rows[0].recruiterId;
    const level1Payout = Number((amount * REFERRAL_RATES.level1).toFixed(4));

    if (level1Payout > 0) {
      // Ensure recruiter has a wallet
      if (!(await getAgentWallet(level1RecruiterId))) {
        await createAgentWallet(level1RecruiterId);
      }
      await topUpWallet(level1RecruiterId, level1Payout);

      // Record payout
      const payoutId = generateId();
      await Promise.race([
        db.insert(referralPayout).values({
          id: payoutId,
          recruiterId: level1RecruiterId,
          earningAgentId,
          level: 1,
          amount: level1Payout.toString(),
          source,
        }),
        timeoutMs(),
      ]);

      distributed.push({
        id: payoutId,
        recruiterId: level1RecruiterId,
        earningAgentId,
        level: 1,
        amount: level1Payout,
        source,
        createdAt: new Date().toISOString(),
      });
    }

    // Find level-2 recruiter (who recruited the level-1 recruiter)
    const level2Rows = await Promise.race([
      db
        .select({ recruiterId: agentReferral.recruiterId })
        .from(agentReferral)
        .where(
          and(
            eq(agentReferral.recruitedId, level1RecruiterId),
            eq(agentReferral.level, 1),
          ),
        )
        .limit(1),
      timeoutMs(),
    ]);

    if (level2Rows.length > 0) {
      const level2RecruiterId = level2Rows[0].recruiterId;
      const level2Payout = Number((amount * REFERRAL_RATES.level2).toFixed(4));

      if (level2Payout > 0) {
        // Ensure level-2 recruiter has a wallet
        if (!(await getAgentWallet(level2RecruiterId))) {
          await createAgentWallet(level2RecruiterId);
        }
        await topUpWallet(level2RecruiterId, level2Payout);

        // Record payout
        const payoutId = generateId();
        await Promise.race([
          db.insert(referralPayout).values({
            id: payoutId,
            recruiterId: level2RecruiterId,
            earningAgentId,
            level: 2,
            amount: level2Payout.toString(),
            source,
          }),
          timeoutMs(),
        ]);

        distributed.push({
          id: payoutId,
          recruiterId: level2RecruiterId,
          earningAgentId,
          level: 2,
          amount: level2Payout,
          source,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { distributed };
  } catch (error) {
    console.error('[referral] distributeReferralCommissions error:', error);
    return { distributed };
  }
}

/**
 * Get referral stats for a specific agent (as recruiter).
 */
export async function getReferralStats(agentId: string): Promise<ReferralStats> {
  const stats: ReferralStats = {
    directRecruits: 0,
    level2Count: 0,
    totalEarned: 0,
    thisMonthEarned: 0,
    topPerformers: [],
  };

  try {
    // Count direct and level-2 recruits
    const referralCounts = await Promise.race([
      db
        .select({
          level: agentReferral.level,
          count: sql<number>`count(*)`,
        })
        .from(agentReferral)
        .where(eq(agentReferral.recruiterId, agentId))
        .groupBy(agentReferral.level),
      timeoutMs(),
    ]);

    for (const row of referralCounts) {
      if (row.level === 1) stats.directRecruits = Number(row.count);
      if (row.level === 2) stats.level2Count = Number(row.count);
    }

    // Total earned from referrals
    const totalRows = await Promise.race([
      db
        .select({
          total: sql<number>`coalesce(sum(cast(${referralPayout.amount} as real)), 0)`,
        })
        .from(referralPayout)
        .where(eq(referralPayout.recruiterId, agentId)),
      timeoutMs(),
    ]);
    stats.totalEarned = Number(Number(totalRows[0]?.total ?? 0).toFixed(4));

    // This month earned
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthRows = await Promise.race([
      db
        .select({
          total: sql<number>`coalesce(sum(cast(${referralPayout.amount} as real)), 0)`,
        })
        .from(referralPayout)
        .where(
          sql`${referralPayout.recruiterId} = ${agentId} AND ${referralPayout.createdAt} >= ${monthStart}`,
        ),
      timeoutMs(),
    ]);
    stats.thisMonthEarned = Number(Number(monthRows[0]?.total ?? 0).toFixed(4));

    // Top performers: recruits that generated the most referral income
    const topRows = await Promise.race([
      db
        .select({
          earningAgentId: referralPayout.earningAgentId,
          total: sql<number>`sum(cast(${referralPayout.amount} as real))`,
        })
        .from(referralPayout)
        .where(eq(referralPayout.recruiterId, agentId))
        .groupBy(referralPayout.earningAgentId)
        .orderBy(desc(sql`sum(cast(${referralPayout.amount} as real))`))
        .limit(5),
      timeoutMs(),
    ]);

    for (const row of topRows) {
      const name = await getAgentName(row.earningAgentId);
      stats.topPerformers.push({
        agentId: row.earningAgentId,
        agentName: name,
        totalEarned: Number(Number(row.total).toFixed(4)),
      });
    }

    return stats;
  } catch (error) {
    console.error('[referral] getReferralStats error:', error);
    return stats;
  }
}

/**
 * Get network-wide referral leaderboard -- top recruiters by total referral earnings.
 */
export async function getReferralLeaderboard(limit: number = 20): Promise<ReferralLeader[]> {
  try {
    const rows = await Promise.race([
      db
        .select({
          recruiterId: referralPayout.recruiterId,
          totalEarned: sql<number>`sum(cast(${referralPayout.amount} as real))`,
        })
        .from(referralPayout)
        .groupBy(referralPayout.recruiterId)
        .orderBy(desc(sql`sum(cast(${referralPayout.amount} as real))`))
        .limit(limit),
      timeoutMs(),
    ]);

    const leaders: ReferralLeader[] = [];

    for (const row of rows) {
      const name = await getAgentName(row.recruiterId);

      // Count direct recruits
      const countRows = await Promise.race([
        db
          .select({ count: sql<number>`count(*)` })
          .from(agentReferral)
          .where(
            and(
              eq(agentReferral.recruiterId, row.recruiterId),
              eq(agentReferral.level, 1),
            ),
          ),
        timeoutMs(),
      ]);

      leaders.push({
        agentId: row.recruiterId,
        agentName: name,
        directRecruits: Number(countRows[0]?.count ?? 0),
        totalEarned: Number(Number(row.totalEarned).toFixed(4)),
        level: 1,
      });
    }

    return leaders;
  } catch (error) {
    console.error('[referral] getReferralLeaderboard error:', error);
    return [];
  }
}
