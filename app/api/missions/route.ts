export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import {
  MISSIONS,
  MISSION_TYPE_TO_REASONS,
  getMissionById,
  getMissionCategory,
  type Mission,
} from '@/lib/missions';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getEdgeUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

interface MissionProgress {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  type: string;
  icon?: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  category: 'daily' | 'weekly' | 'achievements';
}

// ── GET /api/missions ────────────────────────────────────────────────────────
// Returns all missions with the user's current progress.

export async function GET() {
  try {
    const user = await getEdgeUser();

    if (!user) {
      // Return missions with zero progress for unauthenticated users
      const allMissions: MissionProgress[] = [
        ...MISSIONS.daily.map((m) => ({ ...m, progress: 0, completed: false, claimed: false, category: 'daily' as const })),
        ...MISSIONS.weekly.map((m) => ({ ...m, progress: 0, completed: false, claimed: false, category: 'weekly' as const })),
        ...MISSIONS.achievements.map((m) => ({ ...m, progress: 0, completed: false, claimed: false, category: 'achievements' as const })),
      ];
      return apiSuccess({ missions: allMissions, authenticated: false });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const walletAddress = (user as Record<string, unknown>).walletAddress as string | undefined;

    if (!walletAddress) {
      return apiError('Wallet not linked', 400);
    }

    // Get claimed missions from user_reward.missions JSONB
    let claimedMissions: Record<string, { progress: number; completed: boolean }> = {};
    try {
      const rewardRows = await sql`
        SELECT missions FROM user_reward WHERE user_id = ${user.id} LIMIT 1
      `;
      if (rewardRows.length > 0 && rewardRows[0].missions) {
        claimedMissions = rewardRows[0].missions as Record<string, { progress: number; completed: boolean }>;
      }
    } catch {
      // user_reward table might not exist — continue with empty
    }

    // ── Query activity counts from point_transaction ────────────────────

    // Daily counts (today only)
    const dailyCounts = await sql`
      SELECT reason, COUNT(*)::int as count
      FROM point_transaction
      WHERE wallet_address = ${walletAddress}
        AND created_at >= CURRENT_DATE
      GROUP BY reason
    `;

    // Weekly counts
    const weeklyCounts = await sql`
      SELECT reason, COUNT(*)::int as count
      FROM point_transaction
      WHERE wallet_address = ${walletAddress}
        AND created_at >= date_trunc('week', CURRENT_DATE)
      GROUP BY reason
    `;

    // All-time counts
    const allTimeCounts = await sql`
      SELECT reason, COUNT(*)::int as count
      FROM point_transaction
      WHERE wallet_address = ${walletAddress}
      GROUP BY reason
    `;

    // Total BP
    const bpRows = await sql`
      SELECT total_bp FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
    `;
    const totalBp = bpRows.length > 0 ? (bpRows[0].total_bp as number) : 0;

    // Streak days
    const streakRows = await sql`
      SELECT streak_days FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
    `;
    const streakDays = streakRows.length > 0 ? (streakRows[0].streak_days as number) : 0;

    // Unique agent count (weekly — for agent_invoke_unique)
    const uniqueWeeklyAgents = await sql`
      SELECT COUNT(DISTINCT reference_id)::int as count
      FROM point_transaction
      WHERE wallet_address = ${walletAddress}
        AND reason IN ('agent_invoke', 'agent_invoke_premium', 'invoke_unique_agent')
        AND created_at >= date_trunc('week', CURRENT_DATE)
        AND reference_id IS NOT NULL
    `;

    // Active days (distinct dates with activity)
    const activeDaysRows = await sql`
      SELECT COUNT(DISTINCT created_at::date)::int as count
      FROM point_transaction
      WHERE wallet_address = ${walletAddress}
    `;
    const activeDays = activeDaysRows.length > 0 ? (activeDaysRows[0].count as number) : 0;

    // Total staked amount
    const stakedRows = await sql`
      SELECT COALESCE(SUM(ABS(amount)), 0)::int as total
      FROM point_transaction
      WHERE wallet_address = ${walletAddress}
        AND reason = 'debate_stake'
    `;
    const totalStaked = stakedRows.length > 0 ? (stakedRows[0].total as number) : 0;

    // Build lookup maps
    const dailyMap = new Map<string, number>();
    for (const row of dailyCounts) {
      dailyMap.set(row.reason as string, row.count as number);
    }
    const weeklyMap = new Map<string, number>();
    for (const row of weeklyCounts) {
      weeklyMap.set(row.reason as string, row.count as number);
    }
    const allTimeMap = new Map<string, number>();
    for (const row of allTimeCounts) {
      allTimeMap.set(row.reason as string, row.count as number);
    }

    // ── Calculate progress for each mission ─────────────────────────────

    function getProgress(mission: Mission, category: 'daily' | 'weekly' | 'achievements'): number {
      const reasons = MISSION_TYPE_TO_REASONS[mission.type] ?? [];

      // Special types
      if (mission.type === 'total_bp') return totalBp;
      if (mission.type === 'login_streak') return category === 'weekly' ? streakDays : streakDays;
      if (mission.type === 'active_days') return activeDays;
      if (mission.type === 'total_staked') return totalStaked;
      if (mission.type === 'agent_invoke_unique') {
        return uniqueWeeklyAgents.length > 0 ? (uniqueWeeklyAgents[0].count as number) : 0;
      }

      // Sum matching reasons from the appropriate time window
      const map = category === 'daily' ? dailyMap : category === 'weekly' ? weeklyMap : allTimeMap;
      let total = 0;
      for (const reason of reasons) {
        total += map.get(reason) ?? 0;
      }
      return total;
    }

    function buildMissionProgress(mission: Mission, category: 'daily' | 'weekly' | 'achievements'): MissionProgress {
      const progress = getProgress(mission, category);
      const completed = progress >= mission.target;
      const claimed = claimedMissions[mission.id]?.completed ?? false;

      return {
        ...mission,
        progress: Math.min(progress, mission.target),
        completed,
        claimed,
        category,
      };
    }

    const allMissions: MissionProgress[] = [
      ...MISSIONS.daily.map((m) => buildMissionProgress(m, 'daily')),
      ...MISSIONS.weekly.map((m) => buildMissionProgress(m, 'weekly')),
      ...MISSIONS.achievements.map((m) => buildMissionProgress(m, 'achievements')),
    ];

    return apiSuccess({
      missions: allMissions,
      authenticated: true,
      summary: {
        totalBp,
        streakDays,
        activeDays,
        dailyCompleted: allMissions.filter((m) => m.category === 'daily' && m.completed).length,
        dailyTotal: MISSIONS.daily.length,
        weeklyCompleted: allMissions.filter((m) => m.category === 'weekly' && m.completed).length,
        weeklyTotal: MISSIONS.weekly.length,
        achievementsCompleted: allMissions.filter((m) => m.category === 'achievements' && m.completed).length,
        achievementsTotal: MISSIONS.achievements.length,
      },
    });
  } catch (err) {
    console.error('[missions] GET error:', err);
    return apiError('Failed to load missions', 500);
  }
}

// ── POST /api/missions ───────────────────────────────────────────────────────
// Claim a completed mission reward.
// Body: { action: 'claim', missionId: string }

export async function POST(request: NextRequest) {
  try {
    const user = await getEdgeUser();
    if (!user) {
      return apiError('Authentication required', 401);
    }

    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { action, missionId } = parsed.data as { action?: string; missionId?: string };

    if (action !== 'claim') {
      return apiError('Invalid action. Supported: claim', 400);
    }

    if (!missionId || typeof missionId !== 'string') {
      return apiError('missionId is required', 400);
    }

    const mission = getMissionById(missionId);
    if (!mission) {
      return apiError('Unknown mission', 404);
    }

    const category = getMissionCategory(missionId);
    if (!category) {
      return apiError('Unknown mission category', 404);
    }

    const sql = neon(process.env.DATABASE_URL!);
    const walletAddress = (user as Record<string, unknown>).walletAddress as string | undefined;

    if (!walletAddress) {
      return apiError('Wallet not linked', 400);
    }

    // ── Check if already claimed ────────────────────────────────────────

    const rewardRows = await sql`
      SELECT missions FROM user_reward WHERE user_id = ${user.id} LIMIT 1
    `;

    let currentMissions: Record<string, { progress: number; completed: boolean }> = {};
    if (rewardRows.length > 0 && rewardRows[0].missions) {
      currentMissions = rewardRows[0].missions as Record<string, { progress: number; completed: boolean }>;
    }

    // For daily/weekly, use a time-scoped key to allow re-claiming each period
    const claimKey =
      category === 'daily'
        ? `${missionId}_${new Date().toISOString().split('T')[0]}`
        : category === 'weekly'
          ? `${missionId}_w${getISOWeek()}`
          : missionId;

    if (currentMissions[claimKey]?.completed) {
      return apiError('Mission reward already claimed', 400);
    }

    // ── Verify completion ───────────────────────────────────────────────
    // Re-check progress to prevent fraudulent claims

    const reasons = MISSION_TYPE_TO_REASONS[mission.type] ?? [];
    let progress = 0;

    if (mission.type === 'total_bp') {
      const bpRows = await sql`
        SELECT total_bp FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
      `;
      progress = bpRows.length > 0 ? (bpRows[0].total_bp as number) : 0;
    } else if (mission.type === 'login_streak') {
      const streakRows = await sql`
        SELECT streak_days FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
      `;
      progress = streakRows.length > 0 ? (streakRows[0].streak_days as number) : 0;
    } else if (mission.type === 'active_days') {
      const rows = await sql`
        SELECT COUNT(DISTINCT created_at::date)::int as count
        FROM point_transaction
        WHERE wallet_address = ${walletAddress}
      `;
      progress = rows.length > 0 ? (rows[0].count as number) : 0;
    } else if (mission.type === 'total_staked') {
      const rows = await sql`
        SELECT COALESCE(SUM(ABS(amount)), 0)::int as total
        FROM point_transaction
        WHERE wallet_address = ${walletAddress}
          AND reason = 'debate_stake'
      `;
      progress = rows.length > 0 ? (rows[0].total as number) : 0;
    } else if (mission.type === 'agent_invoke_unique') {
      const dateFilter =
        category === 'daily'
          ? `AND created_at >= CURRENT_DATE`
          : category === 'weekly'
            ? `AND created_at >= date_trunc('week', CURRENT_DATE)`
            : '';
      const rows = await sql(`
        SELECT COUNT(DISTINCT reference_id)::int as count
        FROM point_transaction
        WHERE wallet_address = '${walletAddress}'
          AND reason IN ('agent_invoke', 'agent_invoke_premium', 'invoke_unique_agent')
          ${dateFilter}
          AND reference_id IS NOT NULL
      `);
      progress = rows.length > 0 ? (rows[0].count as number) : 0;
    } else if (reasons.length > 0) {
      // Standard reason-count based missions
      const dateFilter =
        category === 'daily'
          ? `AND created_at >= CURRENT_DATE`
          : category === 'weekly'
            ? `AND created_at >= date_trunc('week', CURRENT_DATE)`
            : '';

      const reasonList = reasons.map((r) => `'${r}'`).join(', ');
      const rows = await sql(`
        SELECT COUNT(*)::int as count
        FROM point_transaction
        WHERE wallet_address = '${walletAddress}'
          AND reason IN (${reasonList})
          ${dateFilter}
      `);
      progress = rows.length > 0 ? (rows[0].count as number) : 0;
    }

    if (progress < mission.target) {
      return apiError(`Mission not complete yet (${progress}/${mission.target})`, 400);
    }

    // ── Award BP ────────────────────────────────────────────────────────

    // Insert point_transaction for the reward
    await sql`
      INSERT INTO point_transaction (wallet_address, amount, reason, reference_id, created_at)
      VALUES (${walletAddress}, ${mission.reward}, 'mission_reward', ${missionId}, NOW())
    `;

    // Update user_points total
    await sql`
      UPDATE user_points
      SET total_bp = total_bp + ${mission.reward}
      WHERE wallet_address = ${walletAddress}
    `;

    // Mark mission as claimed in user_reward.missions JSONB
    currentMissions[claimKey] = { progress, completed: true };

    if (rewardRows.length === 0) {
      await sql`
        INSERT INTO user_reward (user_id, balance, current_day, streak, last_claim_date, weekly_streaks_completed, claimed_days, missions, history, created_at, updated_at)
        VALUES (${user.id}, 0, 1, 0, NULL, 0, '[]'::jsonb, ${JSON.stringify(currentMissions)}::jsonb, '[]'::jsonb, NOW(), NOW())
      `;
    } else {
      await sql`
        UPDATE user_reward
        SET missions = ${JSON.stringify(currentMissions)}::jsonb,
            updated_at = NOW()
        WHERE user_id = ${user.id}
      `;
    }

    return apiSuccess({
      claimed: true,
      missionId,
      reward: mission.reward,
      message: `Claimed ${mission.reward} BP for "${mission.title}"`,
    });
  } catch (err) {
    console.error('[missions] POST error:', err);
    return apiError('Failed to claim mission reward', 500);
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

function getISOWeek(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-${week}`;
}
