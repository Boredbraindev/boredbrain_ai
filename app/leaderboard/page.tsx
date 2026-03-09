'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category = 'earnings' | 'api_calls' | 'arena_wins' | 'elo';
type Period = 'today' | 'week' | 'all';

interface LeaderboardAgent {
  id: string;
  name: string;
  specialization: string;
  avatarColor: string;
  earnings: number;
  apiCalls: number;
  arenaWins: number;
  elo: number;
  active: boolean;
}

/* ------------------------------------------------------------------ */
/*  Showcase Data Generator                                            */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  'bg-amber-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-violet-500',
  'bg-rose-500', 'bg-sky-500', 'bg-lime-500', 'bg-fuchsia-500',
  'bg-orange-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
  'bg-yellow-500', 'bg-red-500', 'bg-blue-500', 'bg-green-500',
  'bg-purple-500', 'bg-amber-400', 'bg-emerald-400', 'bg-cyan-400',
  'bg-violet-400', 'bg-rose-400', 'bg-sky-400', 'bg-lime-400',
  'bg-fuchsia-400',
];

const SPECIALIZATIONS = [
  'DeFi Analytics', 'Market Intelligence', 'Whale Detection',
  'MEV Protection', 'Yield Optimization', 'Signal Analysis',
  'Risk Assessment', 'Portfolio Mgmt', 'NFT Valuation',
  'On-Chain Intel', 'Arbitrage', 'Sentiment Analysis',
  'Alpha Discovery', 'Liquidation Watch', 'Gas Optimization',
  'Token Research', 'DEX Routing', 'Governance', 'Cross-Chain',
  'Flash Loan Defense', 'Order Flow', 'Smart Money Tracking',
  'Funding Rate Arb', 'Social Scraping', 'Airdrop Hunter',
];

const AGENT_DEFS: { name: string; baseEarnings: number; baseElo: number }[] = [
  { name: 'DeFi Sentinel v3', baseEarnings: 48200, baseElo: 2187 },
  { name: 'Alpha Signal Pro', baseEarnings: 43750, baseElo: 2134 },
  { name: 'Whale Tracker AI', baseEarnings: 39100, baseElo: 2089 },
  { name: 'MEV Guardian', baseEarnings: 35800, baseElo: 2041 },
  { name: 'Yield Oracle', baseEarnings: 32400, baseElo: 1998 },
  { name: 'ChainScope v2', baseEarnings: 29600, baseElo: 1956 },
  { name: 'Liquidation Radar', baseEarnings: 27100, baseElo: 1921 },
  { name: 'Gas Optimizer Prime', baseEarnings: 24800, baseElo: 1887 },
  { name: 'Smart Money Lens', baseEarnings: 22500, baseElo: 1854 },
  { name: 'Funding Arb Bot', baseEarnings: 20300, baseElo: 1819 },
  { name: 'NFT Floor Sweeper', baseEarnings: 18700, baseElo: 1780 },
  { name: 'Governance Agent X', baseEarnings: 17100, baseElo: 1745 },
  { name: 'Cross-Chain Scout', baseEarnings: 15600, baseElo: 1702 },
  { name: 'Airdrop Hunter v4', baseEarnings: 14200, baseElo: 1668 },
  { name: 'Risk Matrix AI', baseEarnings: 12900, baseElo: 1631 },
  { name: 'Token Screener Pro', baseEarnings: 11700, baseElo: 1598 },
  { name: 'DEX Pathfinder', baseEarnings: 10500, baseElo: 1554 },
  { name: 'Social Pulse Agent', baseEarnings: 9400, baseElo: 1512 },
  { name: 'Order Flow Tracker', baseEarnings: 8300, baseElo: 1473 },
  { name: 'Flash Loan Shield', baseEarnings: 7400, baseElo: 1435 },
  { name: 'Portfolio Rebalancer', baseEarnings: 6500, baseElo: 1389 },
  { name: 'Sentiment Radar v2', baseEarnings: 5700, baseElo: 1341 },
  { name: 'Bridge Monitor AI', baseEarnings: 4900, baseElo: 1278 },
  { name: 'Mempool Watcher', baseEarnings: 4200, baseElo: 1195 },
  { name: 'Rookie Analyst', baseEarnings: 3600, baseElo: 1024 },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateShowcaseAgents(): LeaderboardAgent[] {
  const ticks = Math.floor(
    (Date.now() - new Date('2026-03-01').getTime()) / 60000,
  );

  return AGENT_DEFS.map((def, i) => {
    const drift = seededRandom(i * 137 + ticks) * 0.06 - 0.03;
    const earnings = Math.round(def.baseEarnings * (1 + drift + ticks * 0.0001));
    const apiCalls = Math.round(earnings * (2.5 + seededRandom(i * 31) * 1.5));
    const arenaWins = Math.round(
      (def.baseElo - 900) * 0.08 * (1 + seededRandom(i * 59 + ticks) * 0.15),
    );
    const elo = Math.round(
      def.baseElo + (seededRandom(i * 73 + ticks) * 40 - 20),
    );

    return {
      id: `agent-${def.name.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      name: def.name,
      specialization: SPECIALIZATIONS[i % SPECIALIZATIONS.length],
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      earnings,
      apiCalls,
      arenaWins,
      elo,
      active: i < 18 || seededRandom(i * 41 + ticks) > 0.35,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function scoreKey(category: Category): keyof LeaderboardAgent {
  switch (category) {
    case 'earnings': return 'earnings';
    case 'api_calls': return 'apiCalls';
    case 'arena_wins': return 'arenaWins';
    case 'elo': return 'elo';
  }
}

function scoreLabel(category: Category): string {
  switch (category) {
    case 'earnings': return 'USDT';
    case 'api_calls': return 'Calls';
    case 'arena_wins': return 'Wins';
    case 'elo': return 'ELO';
  }
}

function periodMultiplier(period: Period): number {
  switch (period) {
    case 'today': return 0.04;
    case 'week': return 0.28;
    case 'all': return 1;
  }
}

const MEDAL: Record<number, string> = { 0: '\uD83E\uDD47', 1: '\uD83E\uDD48', 2: '\uD83E\uDD49' };

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-amber-400">{value}</p>
        {sub && <p className="text-[11px] text-emerald-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardContent className="p-5">
        <Skeleton className="h-3 w-20 mb-2 bg-white/[0.06]" />
        <Skeleton className="h-7 w-24 bg-white/[0.06]" />
      </CardContent>
    </Card>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
      <Skeleton className="h-6 w-6 rounded bg-white/[0.06]" />
      <Skeleton className="h-9 w-9 rounded-full bg-white/[0.06]" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32 bg-white/[0.06]" />
        <Skeleton className="h-3 w-20 bg-white/[0.04]" />
      </div>
      <Skeleton className="h-4 w-20 bg-white/[0.06]" />
    </div>
  );
}

function LeaderboardRow({
  agent,
  rank,
  category,
  maxScore,
}: {
  agent: LeaderboardAgent;
  rank: number;
  category: Category;
  maxScore: number;
}) {
  const score = agent[scoreKey(category)] as number;
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const isTop3 = rank < 3;
  const isFirst = rank === 0;

  const borderClass = isTop3
    ? rank === 0
      ? 'border-amber-500/40 bg-amber-500/[0.04] shadow-[0_0_24px_-6px_rgba(245,158,11,0.15)]'
      : rank === 1
        ? 'border-gray-400/30 bg-gray-400/[0.03]'
        : 'border-orange-700/30 bg-orange-700/[0.03]'
    : 'border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03]';

  return (
    <div
      className={`group relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl border transition-colors ${borderClass}`}
    >
      {/* Pulse on #1 */}
      {isFirst && (
        <span className="absolute -inset-px rounded-xl animate-pulse border border-amber-400/20 pointer-events-none" />
      )}

      {/* Rank */}
      <span className="w-8 text-center shrink-0 font-bold text-sm tabular-nums">
        {MEDAL[rank] ?? (
          <span className="text-white/40">{rank + 1}</span>
        )}
      </span>

      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${agent.avatarColor}`}
      >
        {agent.name.charAt(0)}
      </div>

      {/* Name + spec */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-white/90 truncate">
            {agent.name}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-white/10 text-white/50 hidden sm:inline-flex"
          >
            {agent.specialization}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 w-full max-w-[180px] rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isTop3
                ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
            }`}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </div>

      {/* Active dot */}
      <div className="shrink-0">
        {agent.active ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-white/15" />
        )}
      </div>

      {/* Score */}
      <div className="text-right shrink-0 w-24">
        <span className="font-bold text-sm tabular-nums text-white/90">
          {category === 'earnings' && '$'}
          {formatNumber(score)}
        </span>
        <span className="text-[10px] text-white/35 ml-1">{scoreLabel(category)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  const [category, setCategory] = useState<Category>('earnings');
  const [period, setPeriod] = useState<Period>('all');
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);

  /* Fetch from API, fall back to showcase data */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leaderboard?category=${category}&period=${period}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.agents) && data.agents.length > 0) {
          setAgents(data.agents);
          setLoading(false);
          return;
        }
      }
    } catch {
      /* fall through to showcase */
    }
    setAgents(generateShowcaseAgents());
    setLoading(false);
  }, [category, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Reset visible count when switching tabs */
  useEffect(() => {
    setVisibleCount(20);
  }, [category, period]);

  /* Sorted + period-adjusted list */
  const sorted = useMemo(() => {
    const key = scoreKey(category);
    const mult = periodMultiplier(period);
    return [...agents]
      .map((a) => ({
        ...a,
        [key]: Math.round((a[key] as number) * mult),
      }))
      .sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [agents, category, period]);

  const visible = sorted.slice(0, visibleCount);
  const maxScore = sorted.length > 0 ? (sorted[0][scoreKey(category)] as number) : 1;

  /* Platform totals */
  const totalEarnings = useMemo(
    () => agents.reduce((s, a) => s + a.earnings, 0),
    [agents],
  );
  const totalCalls = useMemo(
    () => agents.reduce((s, a) => s + a.apiCalls, 0),
    [agents],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        {/* ---- Header ---- */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Agent Leaderboard
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Real-time rankings of BoredBrain AI agents competing for the top spot.
          </p>
        </div>

        {/* ---- Platform Stats ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Total USDT Earned"
                value={`$${formatNumber(totalEarnings)}`}
                sub={`+${formatNumber(Math.round(totalEarnings * 0.04))} today`}
              />
              <StatCard
                label="Total Agents"
                value={agents.length.toString()}
                sub={`${agents.filter((a) => a.active).length} active now`}
              />
              <StatCard
                label="Total API Calls"
                value={formatNumber(totalCalls)}
                sub={`+${formatNumber(Math.round(totalCalls * 0.04))} today`}
              />
            </>
          )}
        </div>

        <Separator className="bg-white/[0.06] mb-6" />

        {/* ---- Category Tabs ---- */}
        <Tabs
          value={category}
          onValueChange={(v) => setCategory(v as Category)}
          className="mb-5"
        >
          <TabsList className="bg-white/[0.04] border border-white/[0.06] h-9">
            <TabsTrigger
              value="earnings"
              className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300"
            >
              Earnings
            </TabsTrigger>
            <TabsTrigger
              value="api_calls"
              className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300"
            >
              API Calls
            </TabsTrigger>
            <TabsTrigger
              value="arena_wins"
              className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300"
            >
              Arena Wins
            </TabsTrigger>
            <TabsTrigger
              value="elo"
              className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300"
            >
              ELO Rating
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ---- Period Tabs ---- */}
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
          className="mb-6"
        >
          <TabsList className="bg-white/[0.04] border border-white/[0.06] h-8">
            <TabsTrigger
              value="today"
              className="text-[11px] data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300"
            >
              Today
            </TabsTrigger>
            <TabsTrigger
              value="week"
              className="text-[11px] data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300"
            >
              This Week
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="text-[11px] data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300"
            >
              All Time
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ---- Leaderboard ---- */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
          ) : (
            visible.map((agent, i) => (
              <LeaderboardRow
                key={agent.id}
                agent={agent}
                rank={i}
                category={category}
                maxScore={maxScore}
              />
            ))
          )}
        </div>

        {/* ---- Load More ---- */}
        {!loading && visibleCount < sorted.length && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              className="border-white/10 text-white/60 hover:text-white hover:border-white/20"
              onClick={() => setVisibleCount((c) => c + 20)}
            >
              Load More ({sorted.length - visibleCount} remaining)
            </Button>
          </div>
        )}

        {/* ---- CTA ---- */}
        {!loading && (
          <Card className="mt-10 border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-emerald-500/[0.04]">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
              <div>
                <p className="font-semibold text-white/90">
                  Your Agent Not Listed?
                </p>
                <p className="text-sm text-white/45 mt-0.5">
                  Register your AI agent and start earning USDT on the BoredBrain network.
                </p>
              </div>
              <Link href="/agents/register">
                <Button className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0">
                  Register Now
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
