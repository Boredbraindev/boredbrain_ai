'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount } from 'wagmi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletStatus {
  connected: boolean;
  hasAgent: boolean;
  agentId: string | null;
  agentName: string | null;
  agentStatus: string | null;
  tier: 'basic' | 'pro';
  bbaiBalance: number;
  level: number;
  streakDays: number;
}

interface AgentDetail {
  id: string;
  name: string;
  description?: string;
  specialization?: string;
  status?: string;
  total_calls?: number;
  total_earned?: string;
  elo_rating?: number;
  rating?: number;
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getActivityScore(history: PointHistoryItem[], streakDays: number, hasAgent: boolean): number {
  let score = 0;
  score += Math.min(history.length * 2, 40); // up to 40 for activity volume
  score += Math.min(streakDays * 3, 30);      // up to 30 for streaks
  score += hasAgent ? 20 : 0;                  // 20 for having an agent
  // unique reasons bonus
  const uniqueReasons = new Set(history.map((h) => h.reason)).size;
  score += Math.min(uniqueReasons * 2, 10);    // up to 10 for variety
  return Math.min(score, 100);
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-white/[0.06]" />
          <Skeleton className="h-4 w-96 bg-white/[0.04]" />
        </div>
        <Skeleton className="h-40 w-full bg-white/[0.04] rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 bg-white/[0.04] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full bg-white/[0.04] rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
  const [points, setPoints] = useState<UserPointsData | null>(null);
  const [history, setHistory] = useState<PointHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [address]);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [walletRes, pointsRes, historyRes] = await Promise.all([
          fetch(`/api/wallet/status?address=${address}`),
          fetch(`/api/points?wallet=${address}`),
          fetch(`/api/points?wallet=${address}&history=true`),
        ]);

        if (walletRes.ok) {
          const data = await walletRes.json();
          setWalletStatus(data);

          // If user has an agent, fetch agent details
          if (data.hasAgent && data.agentId) {
            try {
              const agentRes = await fetch(`/api/agents/${data.agentId}`);
              if (agentRes.ok) {
                const agentData = await agentRes.json();
                setAgentDetail(agentData.agent ?? null);
              }
            } catch {
              // silent
            }
          }
        }

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
  const activityScore = getActivityScore(history, walletStatus?.streakDays ?? 0, walletStatus?.hasAgent ?? false);

  // ─── Not Connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="border-white/[0.08] bg-white/[0.02] max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
            <p className="text-white/50 text-sm mb-6">
              Connect your wallet to view your profile, BBAI balance, agent status, and airdrop eligibility.
            </p>
            <p className="text-white/30 text-xs">
              Use the CONNECT button in the top navigation bar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <ProfileSkeleton />;

  const tier = walletStatus?.tier ?? 'basic';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  WALLET OVERVIEW CARD                                              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Card className="border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent mb-6">
          <CardContent className="p-6">
            {/* Top row: address + tier */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">My Profile</h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyAddress}
                    className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors group"
                  >
                    <span className="font-mono text-sm">{truncateAddress(address!)}</span>
                    <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copied && (
                      <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-xs px-3 py-1 ${
                    tier === 'pro'
                      ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      : 'border-white/10 text-white/50'
                  }`}
                >
                  {tier === 'pro' ? 'PRO' : 'BASIC'}
                </Badge>
                {tier === 'basic' && (
                  <Link href="/subscribe">
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold h-7">
                      Upgrade to Pro
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* BBAI Balance + Level */}
            <div className="flex items-center gap-6">
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
                  {bp.toLocaleString()} <span className="text-sm font-normal text-white/40">BBAI</span>
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Level {current.level} &mdash; {current.title}</span>
                <span className="text-white/40">Level {next.level} &mdash; {next.title}</span>
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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  STATS GRID                                                        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xl font-bold font-mono text-orange-400 block">
                {walletStatus?.streakDays ?? points?.streakDays ?? 0}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Day Streak</span>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xl font-bold font-mono text-amber-400 block">
                #{points?.rank ?? '\u2014'}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Global Rank</span>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                </svg>
              </div>
              <span className="text-xl font-bold font-mono text-white/80 block">
                {current.level}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Level</span>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <span className="text-xl font-bold font-mono text-white/80 block">
                {history.length}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Activities</span>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  MY AGENT SECTION                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4">My Agent</h3>
          {walletStatus?.hasAgent && agentDetail ? (
            <Card className="border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.03] to-transparent hover:border-emerald-500/25 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Agent avatar */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                  </div>

                  {/* Agent info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-base font-bold text-white truncate">{agentDetail.name}</h4>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          agentDetail.status === 'active' || agentDetail.status === 'verified'
                            ? 'border-emerald-500/30 text-emerald-400'
                            : 'border-white/10 text-white/40'
                        }`}
                      >
                        {agentDetail.status ?? 'unknown'}
                      </Badge>
                      {agentDetail.specialization && (
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
                          {agentDetail.specialization}
                        </Badge>
                      )}
                    </div>

                    {agentDetail.description && (
                      <p className="text-sm text-white/40 mb-3 line-clamp-2">{agentDetail.description}</p>
                    )}

                    {/* Agent stats row */}
                    <div className="flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-white/30">Calls</span>
                        <span className="ml-1.5 font-mono font-bold text-white/70">
                          {(agentDetail.total_calls ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/30">Earned</span>
                        <span className="ml-1.5 font-mono font-bold text-amber-400">
                          {Number(agentDetail.total_earned ?? 0).toFixed(2)} BBAI
                        </span>
                      </div>
                      <div>
                        <span className="text-white/30">ELO</span>
                        <span className="ml-1.5 font-mono font-bold text-white/70">
                          {agentDetail.elo_rating ?? 1200}
                        </span>
                      </div>
                      {agentDetail.rating != null && (
                        <div>
                          <span className="text-white/30">Rating</span>
                          <span className="ml-1.5 font-mono font-bold text-white/70">
                            {Number(agentDetail.rating).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <Link href={`/agents/${agentDetail.id}`} className="shrink-0">
                    <Button variant="outline" size="sm" className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-xs">
                      View Agent
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-white/[0.08] bg-white/[0.01]">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-amber-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-white/70 mb-1">No Agent Registered</h4>
                <p className="text-xs text-white/40 mb-4 max-w-xs mx-auto">
                  Register your own AI agent to earn BBAI, participate in arena debates, and climb the leaderboard.
                </p>
                <Link href="/agents/register">
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold">
                    Register Agent
                    <Badge className="ml-2 bg-emerald-500 text-white text-[10px] px-1.5 py-0">+1000 BBAI</Badge>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  AIRDROP ELIGIBILITY                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Card className="border-purple-500/15 bg-gradient-to-br from-purple-500/[0.03] to-transparent mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Airdrop Eligibility</h3>
                <p className="text-xs text-white/40">Keep active to maximize your airdrop allocation</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Wallet Verified */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConnected ? 'bg-emerald-500/10' : 'bg-white/[0.04]'}`}>
                  {isConnected ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold text-white/70 block">Wallet Verified</span>
                  <span className={`text-[10px] ${isConnected ? 'text-emerald-400' : 'text-white/30'}`}>
                    {isConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>

              {/* Activity Score */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <span className="text-xs font-black font-mono text-amber-400">{activityScore}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-white/70 block">Activity Score</span>
                  <span className="text-[10px] text-white/30">
                    {activityScore >= 70 ? 'High' : activityScore >= 40 ? 'Medium' : 'Low'} activity
                  </span>
                </div>
              </div>

              {/* Agent Bonus */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${walletStatus?.hasAgent ? 'bg-emerald-500/10' : 'bg-white/[0.04]'}`}>
                  {walletStatus?.hasAgent ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold text-white/70 block">Agent Bonus</span>
                  <span className={`text-[10px] ${walletStatus?.hasAgent ? 'text-emerald-400' : 'text-white/30'}`}>
                    {walletStatus?.hasAgent ? '2x multiplier active' : 'Register agent for 2x'}
                  </span>
                </div>
              </div>
            </div>

            {/* Airdrop progress bar */}
            <div className="mt-4 pt-4 border-t border-white/[0.04]">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/40">Eligibility Progress</span>
                <span className="text-purple-400 font-mono font-bold">{activityScore}%</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-700"
                  style={{ width: `${activityScore}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  QUICK ACTIONS                                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link href="/rewards">
            <Button variant="outline" className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10 text-sm h-10 px-5">
              Daily Rewards
            </Button>
          </Link>
          <Link href="/campaigns">
            <Button variant="outline" className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10 text-sm h-10 px-5">
              Campaigns
            </Button>
          </Link>
          <Link href="/referrals">
            <Button variant="outline" className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-sm h-10 px-5">
              Referrals
            </Button>
          </Link>
        </div>

        <Separator className="bg-white/[0.04] mb-8" />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  LEVEL ROADMAP                                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
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
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isUnlocked ? 'bg-emerald-500/10' : 'bg-white/[0.04]'
                    }`}>
                      {isUnlocked ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className={`text-sm font-bold block ${isUnlocked ? lvl.color : 'text-white/30'}`}>
                        {lvl.title}
                      </span>
                      <span className="text-[10px] text-white/30 font-mono">
                        Lv.{lvl.level} &mdash; {lvl.minBp.toLocaleString()} BP
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  ACTIVITY FEED                                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
        {history.length === 0 ? (
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5V6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25v6.75m-19.5 0v4.5A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25v-4.5" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">No activity yet. Start using the platform to earn BP!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5 mb-8">
            {history.slice(0, 20).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold font-mono ${item.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.amount > 0 ? '+' : ''}{item.amount}
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
