'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAccount } from 'wagmi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserPointsData {
  totalBp: number;
  level: number;
  title: string;
  streakDays: number;
  rank: number;
}

interface PointHistoryItem {
  amount: number;
  reason: string;
  createdAt: string | null;
}

// ─── Level Info ──────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1, minBp: 0, title: 'Newbie', color: 'text-white/60' },
  { level: 5, minBp: 500, title: 'Trader', color: 'text-blue-400' },
  { level: 10, minBp: 2000, title: 'Analyst', color: 'text-emerald-400' },
  { level: 20, minBp: 10000, title: 'Strategist', color: 'text-purple-400' },
  { level: 30, minBp: 50000, title: 'Whale', color: 'text-amber-400' },
  { level: 50, minBp: 200000, title: 'OG', color: 'text-red-400' },
];

function getLevelProgress(bp: number) {
  let current = LEVELS[0];
  let next = LEVELS[1] ?? LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (bp >= LEVELS[i].minBp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? LEVELS[i];
      break;
    }
  }
  const range = next.minBp - current.minBp;
  const progress = range > 0 ? Math.min(100, Math.floor(((bp - current.minBp) / range) * 100)) : 100;
  return { current, next, progress };
}

const REASON_LABELS: Record<string, string> = {
  forecast_entry: 'Forecast Entry',
  arena_watch: 'Arena Watch',
  arena_stake_win: 'Arena Win',
  agent_invoke: 'Agent Invoke',
  agent_register: 'Agent Register',
  daily_login: 'Daily Login',
  streak_3: '3-Day Streak',
  streak_7: '7-Day Streak',
  streak_14: '14-Day Streak',
  streak_30: '30-Day Streak',
  streak_60: '60-Day Streak',
  provider_called: 'Agent Called',
  owner_bonus: 'Owner Bonus',
  invoke_unique_agent: 'Unique Agent',
  invoke_loyalty_5x: 'Loyalty Bonus',
  first_invocation: 'First Invocation',
  maker_quality_bonus: 'Maker Quality',
  debate_vote: 'Debate Vote',
  first_blood: 'First Blood',
  contrarian_win: 'Contrarian Win',
  resurrection: 'Resurrection',
  season_loyalty: 'Season Loyalty',
  loyalty_bonus: 'Loyalty Bonus',
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [points, setPoints] = useState<UserPointsData | null>(null);
  const [history, setHistory] = useState<PointHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [pointsRes, historyRes] = await Promise.all([
          fetch(`/api/points?wallet=${address}`),
          fetch(`/api/points?wallet=${address}&history=true`),
        ]);

        if (pointsRes.ok) {
          const data = await pointsRes.json();
          setPoints(data);
        }
        if (historyRes.ok) {
          const data = await historyRes.json();
          setHistory(data.history ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [address]);

  const bp = points?.totalBp ?? 0;
  const { current, next, progress } = getLevelProgress(bp);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="border-white/[0.08] bg-white/[0.02] max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <span className="text-5xl block mb-4">🔐</span>
            <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
            <p className="text-white/50 text-sm mb-6">
              Connect your wallet to view your level, BP balance, streaks, and earning history.
            </p>
            <p className="text-white/30 text-xs">
              Use the CONNECT button in the top navigation bar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">My Profile</h1>
          <p className="text-white/50 text-sm font-mono">{address}</p>
        </div>

        {/* ─── Level Card ──────────────────────────────────────────────────── */}
        <Card className="border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-6 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-2xl blur-xl" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-500/30 flex items-center justify-center">
                  <span className="text-3xl font-black font-mono text-amber-400">
                    {current.level}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className={`text-2xl font-bold ${current.color}`}>{current.title}</h2>
                  {points?.rank && points.rank > 0 && (
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">
                      Rank #{points.rank}
                    </Badge>
                  )}
                </div>
                <p className="text-3xl font-black font-mono text-white">
                  {bp.toLocaleString()} <span className="text-sm font-normal text-white/40">BP</span>
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Level {current.level} — {current.title}</span>
                <span className="text-white/40">Level {next.level} — {next.title}</span>
              </div>
              <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/30 font-mono">
                <span>{bp.toLocaleString()} BP</span>
                <span>{progress}%</span>
                <span>{next.minBp.toLocaleString()} BP</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Stats Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <span className="text-2xl block mb-1">🔥</span>
              <span className="text-xl font-bold font-mono text-orange-400 block">
                {points?.streakDays ?? 0}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Day Streak</span>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <span className="text-2xl block mb-1">🏆</span>
              <span className="text-xl font-bold font-mono text-amber-400 block">
                #{points?.rank ?? '—'}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Global Rank</span>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <span className="text-2xl block mb-1">⚡</span>
              <span className="text-xl font-bold font-mono text-white/80 block">
                {current.level}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Level</span>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <span className="text-2xl block mb-1">📊</span>
              <span className="text-xl font-bold font-mono text-white/80 block">
                {history.length}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Activities</span>
            </CardContent>
          </Card>
        </div>

        {/* ─── Quick Actions ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link href="/rewards">
            <Button variant="outline" size="sm" className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10 text-xs">
              🎁 Daily Rewards
            </Button>
          </Link>
          <Link href="/campaigns">
            <Button variant="outline" size="sm" className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10 text-xs">
              🏅 Campaigns
            </Button>
          </Link>
          <Link href="/referrals">
            <Button variant="outline" size="sm" className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-xs">
              🔗 Referrals
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" size="sm" className="border-white/10 text-white/50 hover:bg-white/5 text-xs">
              🏆 Leaderboard
            </Button>
          </Link>
        </div>

        {/* ─── Level Roadmap ───────────────────────────────────────────────── */}
        <h3 className="text-lg font-bold text-white mb-4">Level Roadmap</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {LEVELS.map((lvl) => {
            const isUnlocked = bp >= lvl.minBp;
            const isCurrent = current.level === lvl.level;
            return (
              <Card
                key={lvl.level}
                className={`border transition-all ${
                  isCurrent
                    ? 'border-amber-500/30 bg-amber-500/[0.06] ring-1 ring-amber-500/20'
                    : isUnlocked
                    ? 'border-white/[0.08] bg-white/[0.03]'
                    : 'border-white/[0.04] bg-white/[0.01] opacity-50'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{isUnlocked ? '✅' : '🔒'}</span>
                    <div>
                      <span className={`text-sm font-bold block ${isUnlocked ? lvl.color : 'text-white/30'}`}>
                        {lvl.title}
                      </span>
                      <span className="text-[10px] text-white/30 font-mono">
                        Lv.{lvl.level} — {lvl.minBp.toLocaleString()} BP
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ─── Recent Activity ─────────────────────────────────────────────── */}
        <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
        {loading ? (
          <div className="text-center py-8 text-white/30">Loading...</div>
        ) : history.length === 0 ? (
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-8 text-center">
              <span className="text-3xl block mb-2">📭</span>
              <p className="text-white/40 text-sm">No activity yet. Start using the platform to earn BP!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {history.slice(0, 20).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold font-mono ${item.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    +{item.amount}
                  </span>
                  <span className="text-sm text-white/70">
                    {REASON_LABELS[item.reason] ?? item.reason}
                  </span>
                </div>
                <span className="text-[10px] text-white/30 font-mono">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
