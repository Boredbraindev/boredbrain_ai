import { db } from '@/lib/db';
import { userPoints, pointTransaction } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

// ── Point values for each action ─────────────────────────────────────────────

export const POINT_VALUES: Record<string, number> = {
  // Core actions
  forecast_entry: 10,
  arena_watch: 5,
  arena_stake_win: 50,
  agent_invoke: 20,
  agent_register: 100,
  daily_login: 10,
  streak_3: 30,
  streak_7: 100,
  streak_14: 200,
  streak_30: 500,
  streak_60: 1500,
  provider_called: 15,
  owner_bonus: 5,
  // Campaign: Invoke
  invoke_unique_agent: 5,
  invoke_loyalty_5x: 15,
  first_invocation: 50,
  // Campaign: Maker
  maker_quality_bonus: 25,
  // Campaign: Uptime
  uptime_reward: 0, // dynamic amount
  // Campaign: Loser
  loser_points: 5,
  loser_comeback: 50,
  // Campaign: Debate
  debate_vote: 10,
  first_blood: 25,
  contrarian_win: 30, // 3x base debate_vote
  proximity_bonus: 0, // dynamic
  // Campaign: Special
  resurrection: 75,
  season_loyalty: 500,
  loyalty_bonus: 15,
  // Agent registration staking (negative amount passed dynamically)
  agent_stake: 0,
  // Paid top-up (dynamic amount from purchase)
  bp_topup: 0,
  // Pro subscription daily drip
  pro_daily_drip: 10,
  // Economy spending actions (dynamic amounts)
  debate_stake: 0,          // Stake BP on debate winner
  agent_invoke_premium: 0,  // Premium agent invocation cost
  agent_boost: 0,           // Boost agent visibility in marketplace
};

// ── Level thresholds ─────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1, minBp: 0, title: 'Newbie' },
  { level: 5, minBp: 500, title: 'Trader' },
  { level: 10, minBp: 2000, title: 'Analyst' },
  { level: 20, minBp: 10000, title: 'Strategist' },
  { level: 30, minBp: 50000, title: 'Whale' },
  { level: 50, minBp: 200000, title: 'OG' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getLevelInfo(bp: number): {
  level: number;
  title: string;
  nextLevel: number;
  nextLevelBp: number;
  progress: number;
} {
  let current = LEVELS[0];
  let next = LEVELS[1] ?? LEVELS[0];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (bp >= LEVELS[i].minBp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? LEVELS[i];
      break;
    }
  }

  const progressRange = next.minBp - current.minBp;
  const progress =
    progressRange > 0
      ? Math.min(100, Math.floor(((bp - current.minBp) / progressRange) * 100))
      : 100;

  return {
    level: current.level,
    title: current.title,
    nextLevel: next.level,
    nextLevelBp: next.minBp,
    progress,
  };
}

// ── Core functions ───────────────────────────────────────────────────────────

export async function awardPoints(
  walletAddress: string,
  reason: string,
  referenceId?: string,
  customAmount?: number,
): Promise<{ bp: number; newTotal: number; levelUp: boolean }> {
  try {
    const bp = customAmount ?? POINT_VALUES[reason] ?? 0;
    if (bp === 0) return { bp: 0, newTotal: 0, levelUp: false };

    // Insert transaction
    await db.insert(pointTransaction).values({
      walletAddress,
      amount: bp,
      reason,
      referenceId: referenceId ?? null,
    });

    // Upsert user points
    const existing = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.walletAddress, walletAddress))
      .limit(1);

    let newTotal: number;
    let oldLevel: number;

    if (existing.length === 0) {
      newTotal = bp;
      oldLevel = 1;
      const levelInfo = getLevelInfo(newTotal);
      await db.insert(userPoints).values({
        walletAddress,
        totalBp: newTotal,
        level: levelInfo.level,
      });
    } else {
      oldLevel = existing[0].level;
      newTotal = existing[0].totalBp + bp;
      const levelInfo = getLevelInfo(newTotal);
      await db
        .update(userPoints)
        .set({
          totalBp: newTotal,
          level: levelInfo.level,
        })
        .where(eq(userPoints.walletAddress, walletAddress));
    }

    const newLevel = getLevelInfo(newTotal).level;
    return { bp, newTotal, levelUp: newLevel > oldLevel };
  } catch (err) {
    console.error('[points] awardPoints error:', err);
    return { bp: 0, newTotal: 0, levelUp: false };
  }
}

export async function checkDailyLogin(
  walletAddress: string,
): Promise<{ awarded: boolean; streakDays: number; bonusBp: number }> {
  try {
    const today = getToday();

    const existing = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.walletAddress, walletAddress))
      .limit(1);

    let streakDays = 0;
    let bonusBp = 0;

    if (existing.length === 0) {
      // New user — create row, award daily login
      streakDays = 1;
      await awardPoints(walletAddress, 'daily_login');
      await db.insert(userPoints).values({
        walletAddress,
        totalBp: POINT_VALUES.daily_login,
        level: 1,
        streakDays: 1,
        lastLoginDate: today,
      }).onConflictDoUpdate({
        target: userPoints.walletAddress,
        set: {
          streakDays: 1,
          lastLoginDate: today,
        },
      });
      return { awarded: true, streakDays: 1, bonusBp: 0 };
    }

    const row = existing[0];

    // Already logged in today
    if (row.lastLoginDate === today) {
      return { awarded: false, streakDays: row.streakDays, bonusBp: 0 };
    }

    // Check if yesterday (continue streak) or gap (reset)
    const lastDate = row.lastLoginDate ? new Date(row.lastLoginDate) : null;
    const todayDate = new Date(today);

    if (lastDate) {
      const diffMs = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      streakDays = diffDays === 1 ? row.streakDays + 1 : 1;
    } else {
      streakDays = 1;
    }

    // Award daily login
    await awardPoints(walletAddress, 'daily_login');

    // Check streak bonuses
    if (streakDays === 3) {
      bonusBp = POINT_VALUES.streak_3;
      await awardPoints(walletAddress, 'streak_3', undefined, bonusBp);
    } else if (streakDays === 7) {
      bonusBp = POINT_VALUES.streak_7;
      await awardPoints(walletAddress, 'streak_7', undefined, bonusBp);
    } else if (streakDays === 30) {
      bonusBp = POINT_VALUES.streak_30;
      await awardPoints(walletAddress, 'streak_30', undefined, bonusBp);
    }

    // Update streak and lastLoginDate
    await db
      .update(userPoints)
      .set({
        streakDays,
        lastLoginDate: today,
      })
      .where(eq(userPoints.walletAddress, walletAddress));

    return { awarded: true, streakDays, bonusBp };
  } catch (err) {
    console.error('[points] checkDailyLogin error:', err);
    return { awarded: false, streakDays: 0, bonusBp: 0 };
  }
}

export async function getLeaderboard(
  limit: number = 50,
  season: number = 1,
): Promise<Array<{ walletAddress: string; totalBp: number; level: number }>> {
  try {
    const rows = await db
      .select({
        walletAddress: userPoints.walletAddress,
        totalBp: userPoints.totalBp,
        level: userPoints.level,
      })
      .from(userPoints)
      .where(eq(userPoints.season, season))
      .orderBy(desc(userPoints.totalBp))
      .limit(limit);

    return rows;
  } catch (err) {
    console.error('[points] getLeaderboard error:', err);
    return [];
  }
}

export async function getUserPoints(
  walletAddress: string,
): Promise<{
  totalBp: number;
  level: number;
  title: string;
  streakDays: number;
  rank: number;
}> {
  try {
    const existing = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.walletAddress, walletAddress))
      .limit(1);

    if (existing.length === 0) {
      return { totalBp: 0, level: 1, title: 'Newbie', streakDays: 0, rank: 0 };
    }

    const row = existing[0];
    const levelInfo = getLevelInfo(row.totalBp);

    // Calculate rank
    const rankResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userPoints)
      .where(sql`${userPoints.totalBp} > ${row.totalBp}`);

    const rank = (rankResult[0]?.count ?? 0) + 1;

    return {
      totalBp: row.totalBp,
      level: levelInfo.level,
      title: levelInfo.title,
      streakDays: row.streakDays,
      rank,
    };
  } catch (err) {
    console.error('[points] getUserPoints error:', err);
    return { totalBp: 0, level: 1, title: 'Newbie', streakDays: 0, rank: 0 };
  }
}

export async function getPointHistory(
  walletAddress: string,
  limit: number = 50,
): Promise<Array<{ amount: number; reason: string; createdAt: Date | null }>> {
  try {
    const rows = await db
      .select({
        amount: pointTransaction.amount,
        reason: pointTransaction.reason,
        createdAt: pointTransaction.createdAt,
      })
      .from(pointTransaction)
      .where(eq(pointTransaction.walletAddress, walletAddress))
      .orderBy(desc(pointTransaction.createdAt))
      .limit(limit);

    return rows;
  } catch (err) {
    console.error('[points] getPointHistory error:', err);
    return [];
  }
}
