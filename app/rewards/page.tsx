'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DailyReward {
  day: number;
  amount: number;
  special?: string;
}

interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  completed: boolean;
  link?: string;
}

interface RewardHistoryEntry {
  id: string;
  date: string;
  amount: number;
  type: string;
}

interface RewardsState {
  balance: number;
  currentDay: number; // 1-7
  streak: number;
  lastClaimDate: string | null;
  weeklyStreaksCompleted: number;
  claimedDays: number[]; // days already claimed in current cycle
  missions: Record<string, { progress: number; completed: boolean }>;
  history: RewardHistoryEntry[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAILY_REWARDS: DailyReward[] = [
  { day: 1, amount: 50 },
  { day: 2, amount: 100 },
  { day: 3, amount: 150 },
  { day: 4, amount: 200 },
  { day: 5, amount: 300 },
  { day: 6, amount: 400 },
  { day: 7, amount: 500, special: 'Special NFT Badge' },
];

const MISSIONS_CONFIG: Mission[] = [
  {
    id: 'register-agent',
    title: 'Register Your First Agent',
    description: 'Deploy an AI agent to the BoredBrain network',
    reward: 200,
    progress: 0,
    target: 1,
    completed: false,
    link: '/agents/register',
  },
  {
    id: 'win-arena',
    title: 'Win an Arena Match',
    description: 'Compete and win in the Agent Arena',
    reward: 500,
    progress: 0,
    target: 1,
    completed: false,
    link: '/arena',
  },
  {
    id: 'api-calls',
    title: 'Make 10 API Calls',
    description: 'Use BoredBrain tools via the API',
    reward: 100,
    progress: 0,
    target: 10,
    completed: false,
  },
  {
    id: 'refer-friend',
    title: 'Refer a Friend',
    description: 'Invite a friend and earn for each referral',
    reward: 300,
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'stake-bbai',
    title: 'Stake 100+ USDT',
    description: 'Stake your tokens to earn additional rewards',
    reward: 150,
    progress: 0,
    target: 100,
    completed: false,
  },
  {
    id: 'top-leaderboard',
    title: 'Reach Top 10 Leaderboard',
    description: 'Climb to the top of the BoredBrain leaderboard',
    reward: 1000,
    progress: 0,
    target: 1,
    completed: false,
    link: '/arena',
  },
];

const STORAGE_KEY = 'bbai-daily-rewards';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultState(): RewardsState {
  return {
    balance: 0,
    currentDay: 1,
    streak: 0,
    lastClaimDate: null,
    weeklyStreaksCompleted: 0,
    claimedDays: [],
    missions: {},
    history: [],
  };
}

function loadState(): RewardsState {
  if (typeof window === 'undefined') return getDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as RewardsState;

    // Check if streak is broken (missed a day)
    if (parsed.lastClaimDate) {
      const lastClaim = new Date(parsed.lastClaimDate);
      const now = new Date(getToday());
      const diffDays = Math.floor(
        (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 1) {
        // Streak broken - reset day cycle but keep balance and history
        return {
          ...parsed,
          currentDay: 1,
          streak: 0,
          claimedDays: [],
        };
      }
    }

    return parsed;
  } catch {
    return getDefaultState();
  }
}

function saveState(state: RewardsState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Icons (inline SVG components) ──────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const [state, setState] = useState<RewardsState>(getDefaultState);
  const [claimAnimation, setClaimAnimation] = useState(false);
  const [lastClaimedAmount, setLastClaimedAmount] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  // Persist state changes
  useEffect(() => {
    if (mounted) {
      saveState(state);
    }
  }, [state, mounted]);

  const today = getToday();
  const canClaim = state.lastClaimDate !== today;
  const todayReward = DAILY_REWARDS[state.currentDay - 1];

  const handleClaim = useCallback(() => {
    if (!canClaim || !todayReward) return;

    setClaimAnimation(true);
    setLastClaimedAmount(todayReward.amount);
    setTimeout(() => setClaimAnimation(false), 800);

    setState((prev) => {
      const newClaimedDays = [...prev.claimedDays, prev.currentDay];
      const newStreak = prev.streak + 1;
      const isWeekComplete = prev.currentDay === 7;
      const newWeeklyStreaks = isWeekComplete
        ? prev.weeklyStreaksCompleted + 1
        : prev.weeklyStreaksCompleted;

      // Monthly bonus check: 4 weekly streaks = 5000 BBAI
      const monthlyBonus = newWeeklyStreaks > 0 && newWeeklyStreaks % 4 === 0 ? 5000 : 0;
      const totalReward = todayReward.amount + monthlyBonus;

      const newHistory: RewardHistoryEntry[] = [
        {
          id: `claim-${Date.now()}`,
          date: today,
          amount: todayReward.amount,
          type: `Day ${prev.currentDay} Reward`,
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
        ...prev.history,
      ].slice(0, 50); // Keep last 50 entries

      return {
        ...prev,
        balance: prev.balance + totalReward,
        currentDay: isWeekComplete ? 1 : prev.currentDay + 1,
        streak: newStreak,
        lastClaimDate: today,
        weeklyStreaksCompleted: newWeeklyStreaks,
        claimedDays: isWeekComplete ? [] : newClaimedDays,
        history: newHistory,
      };
    });
  }, [canClaim, todayReward, today]);

  const missions: Mission[] = MISSIONS_CONFIG.map((m) => ({
    ...m,
    progress: state.missions[m.id]?.progress ?? m.progress,
    completed: state.missions[m.id]?.completed ?? m.completed,
  }));

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <GiftIcon className="size-8 text-amber-400" />
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Daily Rewards
            </h1>
            <GiftIcon className="size-8 text-amber-400" />
          </div>
          <p className="text-lg text-zinc-400">
            Claim today&apos;s reward and keep your streak to earn even more!
          </p>

          {/* Balance & Streak */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-2.5">
              <CoinsIcon className="size-5 text-amber-400" />
              <span className="text-lg font-bold text-amber-400">
                {state.balance.toLocaleString()} USDT
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-5 py-2.5">
              <span className="text-lg">&#x1F525;</span>
              <span className="text-lg font-bold text-orange-400">
                {state.streak} Day Streak
              </span>
            </div>
          </div>
        </div>

        {/* ── Daily Reward Grid ────────────────────────────────────────── */}
        <Card className="mb-8 border-zinc-800 bg-zinc-900/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl text-white">Weekly Rewards</CardTitle>
            <CardDescription>
              Log in daily to claim escalating rewards. Complete all 7 days for a
              special bonus!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Days 1-6: 3x2 grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {DAILY_REWARDS.slice(0, 6).map((reward) => {
                const isClaimed = state.claimedDays.includes(reward.day);
                const isCurrent = reward.day === state.currentDay && canClaim;
                const isFuture =
                  reward.day > state.currentDay ||
                  (reward.day === state.currentDay && !canClaim && !isClaimed);

                return (
                  <div
                    key={reward.day}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                      isCurrent
                        ? 'border-green-500 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                        : isClaimed
                          ? 'border-zinc-700 bg-zinc-800/50'
                          : 'border-zinc-800 bg-zinc-900/50'
                    }`}
                  >
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Day {reward.day}
                    </span>

                    <div className="flex size-12 items-center justify-center rounded-full bg-zinc-800">
                      {isClaimed ? (
                        <CheckIcon className="size-6 text-green-400" />
                      ) : isFuture ? (
                        <LockIcon className="size-5 text-zinc-600" />
                      ) : (
                        <CoinsIcon className="size-6 text-amber-400" />
                      )}
                    </div>

                    <span
                      className={`text-lg font-bold ${
                        isClaimed
                          ? 'text-zinc-500 line-through'
                          : isCurrent
                            ? 'text-green-400'
                            : 'text-zinc-400'
                      }`}
                    >
                      {reward.amount} USDT
                    </span>

                    {isClaimed && (
                      <Badge
                        variant="green"
                        className="text-[10px]"
                      >
                        Claimed
                      </Badge>
                    )}
                    {isFuture && !isClaimed && (
                      <Badge variant="outline" className="border-zinc-700 text-[10px] text-zinc-500">
                        Locked
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Day 7: Wide special card */}
            {(() => {
              const reward = DAILY_REWARDS[6];
              const isClaimed = state.claimedDays.includes(7);
              const isCurrent = state.currentDay === 7 && canClaim;
              const isFuture =
                state.currentDay < 7 ||
                (state.currentDay === 7 && !canClaim && !isClaimed);

              return (
                <div
                  className={`relative mt-3 flex flex-col items-center gap-3 rounded-xl border p-6 transition-all sm:flex-row sm:justify-between ${
                    isCurrent
                      ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                      : isClaimed
                        ? 'border-zinc-700 bg-zinc-800/50'
                        : 'border-zinc-800 bg-gradient-to-r from-amber-500/5 via-zinc-900/50 to-amber-500/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex size-14 items-center justify-center rounded-full ${
                        isCurrent
                          ? 'bg-amber-500/20'
                          : isClaimed
                            ? 'bg-zinc-800'
                            : 'bg-zinc-800'
                      }`}
                    >
                      {isClaimed ? (
                        <CheckIcon className="size-7 text-green-400" />
                      ) : isFuture ? (
                        <StarIcon className="size-7 text-zinc-600" />
                      ) : (
                        <StarIcon className="size-7 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Day 7 — Grand Reward
                        </span>
                        {!isClaimed && !isFuture && (
                          <span className="inline-block animate-pulse text-xs text-amber-400">
                            &#x2728; SPECIAL
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span
                          className={`text-2xl font-bold ${
                            isClaimed
                              ? 'text-zinc-500 line-through'
                              : isCurrent
                                ? 'text-amber-400'
                                : 'text-zinc-300'
                          }`}
                        >
                          {reward.amount} USDT
                        </span>
                        <span className="text-sm text-amber-400/80">
                          + {reward.special}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isClaimed && (
                    <Badge variant="green">Claimed</Badge>
                  )}
                  {isFuture && !isClaimed && (
                    <Badge variant="outline" className="border-zinc-700 text-zinc-500">
                      <LockIcon className="mr-1 size-3" />
                      Locked
                    </Badge>
                  )}
                </div>
              );
            })()}

            {/* Claim Button */}
            <div className="mt-6 flex justify-center">
              <Button
                size="lg"
                disabled={!canClaim}
                onClick={handleClaim}
                className={`min-w-[200px] text-base font-bold transition-all ${
                  canClaim
                    ? 'bg-gradient-to-r from-green-500 to-amber-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:from-green-400 hover:to-amber-400 hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]'
                    : 'bg-zinc-800 text-zinc-500'
                } ${claimAnimation ? 'scale-95' : ''}`}
              >
                {canClaim ? (
                  <>
                    <GiftIcon className="size-5" />
                    Claim {todayReward?.amount ?? 0} USDT
                  </>
                ) : (
                  'Come Back Tomorrow!'
                )}
              </Button>
            </div>

            {claimAnimation && (
              <div className="mt-3 text-center">
                <span className="animate-bounce text-lg font-bold text-green-400">
                  +{lastClaimedAmount} USDT claimed!
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Monthly Bonus ────────────────────────────────────────────── */}
        <Card className="mb-8 border-zinc-800 bg-zinc-900/80 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <TrophyIcon className="size-8 text-amber-400" />
              <div>
                <h3 className="font-semibold text-white">Monthly Streak Bonus</h3>
                <p className="text-sm text-zinc-400">
                  Complete 4 weekly streaks for{' '}
                  <span className="font-bold text-amber-400">5,000 USDT</span>{' '}
                  bonus
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`size-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                      i < (state.weeklyStreaksCompleted % 4)
                        ? 'border-amber-500 bg-amber-500/20'
                        : 'border-zinc-700 bg-zinc-800'
                    }`}
                  >
                    {i < (state.weeklyStreaksCompleted % 4) ? (
                      <CheckIcon className="size-4 text-amber-400" />
                    ) : (
                      <span className="text-xs text-zinc-600">{i + 1}</span>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-sm text-zinc-500">
                {state.weeklyStreaksCompleted % 4}/4 weeks
              </span>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8 bg-zinc-800" />

        {/* ── Missions ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-2">
            <TrophyIcon className="size-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Missions</h2>
          </div>
          <p className="mb-6 text-zinc-400">
            Complete missions to earn bonus USDT
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {missions.map((mission) => (
              <Card
                key={mission.id}
                className={`border-zinc-800 bg-zinc-900/80 transition-all hover:border-zinc-700 ${
                  mission.completed ? 'opacity-70' : ''
                }`}
              >
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white">
                        {mission.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-zinc-400">
                        {mission.description}
                      </p>
                    </div>
                    <Badge
                      variant={mission.completed ? 'green' : 'default'}
                      className={
                        mission.completed
                          ? ''
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      }
                    >
                      {mission.reward} USDT
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {mission.completed
                          ? 'Completed'
                          : `${mission.progress}/${mission.target}`}
                      </span>
                      <span className="text-zinc-500">
                        {Math.min(
                          100,
                          Math.round((mission.progress / mission.target) * 100),
                        )}
                        %
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        100,
                        Math.round((mission.progress / mission.target) * 100),
                      )}
                      className="h-2 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-green-500 [&>[data-slot=progress-indicator]]:to-amber-500"
                    />
                  </div>

                  {mission.link && !mission.completed && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-1 w-full border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    >
                      <Link href={mission.link}>Go to Mission</Link>
                    </Button>
                  )}

                  {mission.completed && (
                    <div className="flex items-center gap-1.5 text-sm text-green-400">
                      <CheckIcon className="size-4" />
                      Mission Complete
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator className="my-8 bg-zinc-800" />

        {/* ── Reward History ────────────────────────────────────────────── */}
        <div className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <CoinsIcon className="size-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Reward History</h2>
          </div>

          {state.history.length === 0 ? (
            <Card className="border-zinc-800 bg-zinc-900/80">
              <CardContent className="py-8 text-center">
                <GiftIcon className="mx-auto mb-3 size-10 text-zinc-600" />
                <p className="text-zinc-500">
                  No rewards claimed yet. Start your streak today!
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-zinc-800 bg-zinc-900/80">
              <CardContent className="divide-y divide-zinc-800">
                {state.history.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/10">
                        <CoinsIcon className="size-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {entry.type}
                        </p>
                        <p className="text-xs text-zinc-500">{entry.date}</p>
                      </div>
                    </div>
                    <span className="font-bold text-green-400">
                      +{entry.amount} USDT
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
