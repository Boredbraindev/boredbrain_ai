export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// ── Constants (mirror the client-side config) ──────────────────────────────

const DAILY_REWARDS = [
  { day: 1, amount: 50 },
  { day: 2, amount: 100 },
  { day: 3, amount: 150 },
  { day: 4, amount: 200 },
  { day: 5, amount: 300 },
  { day: 6, amount: 400 },
  { day: 7, amount: 500 },
];

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultRewardState() {
  return {
    balance: 0,
    streak: 0,
    currentDay: 1,
    lastClaimDate: null as string | null,
    weeklyStreaksCompleted: 0,
    claimedDays: [] as number[],
    missions: {} as Record<string, { progress: number; completed: boolean }>,
    history: [] as Array<{ id: string; date: string; amount: number; type: string }>,
  };
}

// Helper to get current user in Edge
async function getEdgeUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

// ── GET /api/rewards ───────────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await getEdgeUser();

    if (!user) {
      return apiError('Authentication required. Please sign in to access rewards.', 401);
    }

    const sql = neon(process.env.DATABASE_URL!);

    const existing = await sql`
      SELECT * FROM user_reward WHERE user_id = ${user.id} LIMIT 1
    `;

    if (existing.length === 0) {
      return apiSuccess({ reward: getDefaultRewardState(), source: 'default' });
    }

    const row = existing[0];

    // Check if streak is broken (missed a day)
    let state = {
      balance: row.balance,
      streak: row.streak,
      currentDay: row.current_day,
      lastClaimDate: row.last_claim_date,
      weeklyStreaksCompleted: row.weekly_streaks_completed,
      claimedDays: (row.claimed_days ?? []) as number[],
      missions: (row.missions ?? {}) as Record<string, { progress: number; completed: boolean }>,
      history: (row.history ?? []) as Array<{ id: string; date: string; amount: number; type: string }>,
    };

    if (state.lastClaimDate) {
      const lastClaim = new Date(state.lastClaimDate);
      const now = new Date(getToday());
      const diffDays = Math.floor(
        (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 1) {
        // Streak broken — reset day cycle but keep balance and history
        state = { ...state, currentDay: 1, streak: 0, claimedDays: [] };
        // Persist the streak reset
        await sql`
          UPDATE user_reward SET current_day = 1, streak = 0, claimed_days = '[]'::jsonb, updated_at = NOW()
          WHERE user_id = ${user.id}
        `;
      }
    }

    return apiSuccess({ reward: state, source: 'db' });
  } catch (err) {
    console.error('[rewards] GET error:', err);
    return apiError('Failed to load rewards', 500);
  }
}

// ── POST /api/rewards ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getEdgeUser();
    if (!user) {
      return apiError('Authentication required', 401);
    }

    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { action } = parsed.data as { action?: string };

    if (action !== 'claim') {
      return apiError('Invalid action. Supported: claim', 400);
    }

    // ── Claim daily reward ─────────────────────────────────────────────

    const today = getToday();
    const sql = neon(process.env.DATABASE_URL!);

    // Get or create reward row
    const existing = await sql`
      SELECT * FROM user_reward WHERE user_id = ${user.id} LIMIT 1
    `;

    let state = getDefaultRewardState();

    if (existing.length > 0) {
      const row = existing[0];
      state = {
        balance: row.balance,
        streak: row.streak,
        currentDay: row.current_day,
        lastClaimDate: row.last_claim_date,
        weeklyStreaksCompleted: row.weekly_streaks_completed,
        claimedDays: (row.claimed_days ?? []) as number[],
        missions: (row.missions ?? {}) as Record<string, { progress: number; completed: boolean }>,
        history: (row.history ?? []) as Array<{ id: string; date: string; amount: number; type: string }>,
      };

      // Check if streak is broken
      if (state.lastClaimDate) {
        const lastClaim = new Date(state.lastClaimDate);
        const now = new Date(today);
        const diffDays = Math.floor(
          (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays > 1) {
          state = { ...state, currentDay: 1, streak: 0, claimedDays: [] };
        }
      }
    }

    // Already claimed today?
    if (state.lastClaimDate === today) {
      return apiError('Already claimed today', 400);
    }

    // Calculate reward
    const todayReward = DAILY_REWARDS[state.currentDay - 1];
    if (!todayReward) {
      return apiError('Invalid reward day', 500);
    }

    const newClaimedDays = [...state.claimedDays, state.currentDay];
    const newStreak = state.streak + 1;
    const isWeekComplete = state.currentDay === 7;
    const newWeeklyStreaks = isWeekComplete
      ? state.weeklyStreaksCompleted + 1
      : state.weeklyStreaksCompleted;

    // Monthly bonus: 4 weekly streaks = 5000 BBAI
    const monthlyBonus =
      newWeeklyStreaks > 0 && newWeeklyStreaks % 4 === 0 && isWeekComplete ? 5000 : 0;
    const totalReward = todayReward.amount + monthlyBonus;

    const newHistory = [
      {
        id: `claim-${Date.now()}`,
        date: today,
        amount: todayReward.amount,
        type: `Day ${state.currentDay} Reward`,
      },
      ...(monthlyBonus > 0
        ? [
            {
              id: `monthly-${Date.now()}`,
              date: today,
              amount: monthlyBonus,
              type: 'Monthly Streak Bonus',
            },
          ]
        : []),
      ...state.history,
    ].slice(0, 50);

    const updatedState = {
      balance: state.balance + totalReward,
      currentDay: isWeekComplete ? 1 : state.currentDay + 1,
      streak: newStreak,
      lastClaimDate: today,
      weeklyStreaksCompleted: newWeeklyStreaks,
      claimedDays: isWeekComplete ? [] : newClaimedDays,
      missions: state.missions,
      history: newHistory,
    };

    // Upsert into DB
    if (existing.length === 0) {
      await sql`
        INSERT INTO user_reward (user_id, balance, current_day, streak, last_claim_date, weekly_streaks_completed, claimed_days, missions, history, created_at, updated_at)
        VALUES (${user.id}, ${updatedState.balance}, ${updatedState.currentDay}, ${updatedState.streak}, ${updatedState.lastClaimDate}, ${updatedState.weeklyStreaksCompleted}, ${JSON.stringify(updatedState.claimedDays)}::jsonb, ${JSON.stringify(updatedState.missions)}::jsonb, ${JSON.stringify(updatedState.history)}::jsonb, NOW(), NOW())
      `;
    } else {
      await sql`
        UPDATE user_reward SET
          balance = ${updatedState.balance},
          current_day = ${updatedState.currentDay},
          streak = ${updatedState.streak},
          last_claim_date = ${updatedState.lastClaimDate},
          weekly_streaks_completed = ${updatedState.weeklyStreaksCompleted},
          claimed_days = ${JSON.stringify(updatedState.claimedDays)}::jsonb,
          missions = ${JSON.stringify(updatedState.missions)}::jsonb,
          history = ${JSON.stringify(updatedState.history)}::jsonb,
          updated_at = NOW()
        WHERE user_id = ${user.id}
      `;
    }

    return apiSuccess({
      reward: updatedState,
      claimed: totalReward,
      day: state.currentDay,
    });
  } catch (err) {
    console.error('[rewards] POST error:', err);
    return apiError('Failed to claim reward', 500);
  }
}
