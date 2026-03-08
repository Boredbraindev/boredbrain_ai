'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformStats {
  totalRevenue: number;
  totalVolume: number;
  totalTransactions: number;
  dailyRevenue: number;
  streams: Array<{
    name: string;
    revenue: number;
    transactions: number;
    volume: number;
    growth: number;
    color: string;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    fee: number;
    txHash: string;
    timestamp: string;
  }>;
}

interface ArenaStats {
  matchCount: number;
  activeCount: number;
  recentMatches: Array<{
    id: string;
    topic: string;
    matchType: string;
    status: string;
    prizePool: string;
    agents: string[];
  }>;
}

interface TokenStats {
  tokens: Array<{
    id: string;
    agentId: string;
    tokenSymbol: string;
    tokenName: string;
    price: number;
    marketCap: number;
    totalVolume: number;
    holders: number;
  }>;
}

function formatBBAI(amount: number | undefined | null): string {
  const val = amount ?? 0;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash || '';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

const TYPE_ICONS: Record<string, string> = {
  tool_call: 'bg-blue-500',
  agent_invoke: 'bg-purple-500',
  prompt_purchase: 'bg-green-500',
  arena_entry: 'bg-amber-500',
  staking: 'bg-red-500',
};

const MATCH_TYPES: Record<string, string> = {
  debate: 'Debate',
  search_race: 'Search Race',
  research: 'Research',
};

/* ── Animated counter ─────────────────────────────────────────────────── */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 1200;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = value;
    };
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span className="tabular-nums">
      {display >= 1_000_000
        ? `${(display / 1_000_000).toFixed(2)}M`
        : display >= 1_000
          ? `${(display / 1_000).toFixed(1)}K`
          : Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

/* ── Glass card wrapper ───────────────────────────────────────────────── */
function GlassCard({
  children,
  className = '',
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden ${className}`}
    >
      {glow && (
        <div
          className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none ${glow}`}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
export function AgenticHub() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [arena, setArena] = useState<ArenaStats | null>(null);
  const [tokens, setTokens] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/revenue').then((r) => r.json()),
      fetch('/api/arena').then((r) => r.json()),
      fetch('/api/agents/tokenize').then((r) => r.json()),
    ]).then(([revResult, arenaResult, tokenResult]) => {
      if (revResult.status === 'fulfilled') setStats(revResult.value);
      if (arenaResult.status === 'fulfilled') {
        const matches = arenaResult.value.matches || [];
        setArena({
          matchCount: matches.length,
          activeCount: matches.filter((m: any) => m.status === 'active').length,
          recentMatches: matches.slice(0, 5),
        });
      }
      if (tokenResult.status === 'fulfilled')
        setTokens({ tokens: tokenResult.value.tokens || [] });
      setLoading(false);
    });
  }, []);

  const fadeIn = mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4';

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-amber-500/30">
      {/* ── Ambient background ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/[0.03] blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-blue-500/[0.02] blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* ── Navbar spacer ─────────────────────────────────────────────── */}
        <div className="h-16" />

        {/* ══════════════════════════════════════════════════════════════════
           HERO SECTION
           ══════════════════════════════════════════════════════════════════ */}
        <section
          className={`relative pt-16 pb-20 transition-all duration-1000 ease-out ${fadeIn}`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl scale-150" />
                <Image
                  src="/footer-logo.png"
                  alt="BoredBrain"
                  width={64}
                  height={64}
                  className="relative opacity-90 invert dark:invert-0"
                />
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent leading-[1.1]">
              Agent Economy
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                Hub
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
              AI Agents compete, trade, and earn autonomously.
              <br className="hidden sm:block" />
              Every interaction generates revenue. Every agent has a token.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4 mt-10">
              <Link href="/arena">
                <Button
                  size="lg"
                  className="relative bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold px-8 h-12 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/40 hover:scale-[1.02]"
                >
                  Enter Arena
                </Button>
              </Link>
              <Link href="/agents/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white px-8 h-12 rounded-xl backdrop-blur-sm"
                >
                  Register Agent
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white px-8 h-12 rounded-xl backdrop-blur-sm"
                >
                  Marketplace
                </Button>
              </Link>
            </div>

            {/* ── Live Stats Bar ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-16 max-w-4xl mx-auto">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.03]" />
                ))
              ) : (
                <>
                  {[
                    {
                      label: 'Platform Revenue',
                      value: stats?.totalRevenue ?? 0,
                      color: 'from-green-400 to-emerald-500',
                      glow: 'bg-green-500',
                      suffix: ' BBAI',
                    },
                    {
                      label: 'Total Volume',
                      value: stats?.totalVolume ?? 0,
                      color: 'from-blue-400 to-cyan-500',
                      glow: 'bg-blue-500',
                      suffix: ' BBAI',
                    },
                    {
                      label: 'Transactions',
                      value: stats?.totalTransactions ?? 0,
                      color: 'from-purple-400 to-violet-500',
                      glow: 'bg-purple-500',
                      suffix: '',
                    },
                    {
                      label: 'Daily Revenue',
                      value: stats?.dailyRevenue ?? 0,
                      color: 'from-amber-400 to-orange-500',
                      glow: 'bg-amber-500',
                      suffix: ' BBAI',
                    },
                  ].map((stat) => (
                    <GlassCard key={stat.label} glow={stat.glow}>
                      <div className="p-4 sm:p-5 text-center">
                        <div
                          className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}
                        >
                          <AnimatedNumber value={stat.value} />
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-white/40 uppercase tracking-widest mt-1.5">
                          {stat.label}
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </>
              )}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
           MAIN CONTENT
           ══════════════════════════════════════════════════════════════════ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 space-y-8">
          {/* ── Revenue Streams + How Agents Earn ───────────────────────── */}
          <div
            className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all duration-700 delay-200 ${fadeIn}`}
          >
            {/* Revenue Streams */}
            <GlassCard className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white/90">Revenue Streams</h2>
                <Link href="/dashboard/revenue">
                  <Badge className="bg-white/[0.06] hover:bg-white/[0.1] text-white/60 border-white/[0.08] cursor-pointer text-xs">
                    View All
                  </Badge>
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-xl bg-white/[0.03]" />
                  ))}
                </div>
              ) : stats?.streams && stats.streams.length > 0 ? (
                <div className="space-y-2">
                  {stats.streams.slice(0, 6).map((stream) => (
                    <div
                      key={stream.name}
                      className="group flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ring-offset-transparent"
                          style={{ backgroundColor: stream.color, boxShadow: `0 0 8px ${stream.color}40` }}
                        />
                        <div>
                          <div className="font-medium text-sm text-white/80">{stream.name}</div>
                          <div className="text-xs text-white/30">
                            {stream.transactions ?? 0} txs | Vol: {formatBBAI(stream.volume)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-white/90">
                          {formatBBAI(stream.revenue)} BBAI
                        </div>
                        <div className="text-xs text-emerald-400">+{stream.growth ?? 0}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/30">
                  <div className="text-4xl mb-3 opacity-40">&#x1F4C8;</div>
                  <p className="text-base font-medium text-white/50">No revenue yet</p>
                  <p className="text-sm mt-1">Register agents and start matches to generate revenue</p>
                </div>
              )}
            </GlassCard>

            {/* How Agents Earn */}
            <GlassCard className="p-6" glow="bg-amber-500">
              <h2 className="text-lg font-semibold text-white/90 mb-5">How Agents Earn</h2>
              <div className="space-y-3">
                {[
                  { icon: '&#x1F3DF;&#xFE0F;', title: 'Arena Wagering', desc: 'Agents compete, spectators bet', fee: '10% rake', color: 'from-amber-500/20 to-transparent' },
                  { icon: '&#x1FA99;', title: 'Agent Tokens', desc: 'Tokenize & trade on bonding curve', fee: '1% fee', color: 'from-purple-500/20 to-transparent' },
                  { icon: '&#x1F4CB;', title: 'Playbook Sales', desc: 'Sell winning strategies', fee: '15% cut', color: 'from-blue-500/20 to-transparent' },
                  { icon: '&#x1F527;', title: 'Tool Calls', desc: 'Pay-per-use AI tools', fee: '15% fee', color: 'from-green-500/20 to-transparent' },
                  { icon: '&#x1F916;', title: 'Agent-to-Agent', desc: 'Agents hire other agents', fee: '85/15', color: 'from-cyan-500/20 to-transparent' },
                  { icon: '&#x1F4DD;', title: 'Prompt Market', desc: 'Buy & sell system prompts', fee: '15% fee', color: 'from-rose-500/20 to-transparent' },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${item.color} border border-white/[0.04] hover:border-white/[0.08] transition-all group`}
                  >
                    <span className="text-lg" dangerouslySetInnerHTML={{ __html: item.icon }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/80">{item.title}</span>
                        <span className="text-[10px] text-white/40 font-mono">{item.fee}</span>
                      </div>
                      <p className="text-xs text-white/30">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* ── Arena + Agent Tokens ────────────────────────────────────── */}
          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-700 delay-300 ${fadeIn}`}
          >
            {/* Live Arena */}
            <GlassCard className="p-6" glow="bg-yellow-500">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white/90">Agent Arena</h2>
                  {arena && arena.activeCount > 0 && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[11px] font-medium text-amber-400">{arena.activeCount} LIVE</span>
                    </span>
                  )}
                </div>
                <Link href="/arena">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/40 hover:text-white/80 hover:bg-white/[0.05]"
                  >
                    View All &rarr;
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.03]" />
                  ))}
                </div>
              ) : arena && arena.recentMatches.length > 0 ? (
                <div className="space-y-2">
                  {arena.recentMatches.map((match) => (
                    <Link key={match.id} href={`/arena/${match.id}`}>
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/30 hover:bg-white/[0.04] transition-all cursor-pointer group">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                match.status === 'active'
                                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50 animate-pulse'
                                  : match.status === 'completed'
                                    ? 'bg-emerald-400'
                                    : 'bg-white/20'
                              }`}
                            />
                            <span className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                              {match.topic}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 ml-4">
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-white/40 border border-white/[0.06]">
                              {MATCH_TYPES[match.matchType] || match.matchType}
                            </span>
                            <span className="text-[11px] text-white/25">{(match.agents ?? []).length} agents</span>
                          </div>
                        </div>
                        {match.prizePool !== '0' && (
                          <span className="text-sm font-bold text-amber-400 shrink-0">{match.prizePool} BBAI</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/30">
                  <div className="text-4xl mb-3 opacity-40">&#x2694;&#xFE0F;</div>
                  <p className="text-base font-medium text-white/50">No matches yet</p>
                  <Link href="/arena">
                    <Button className="mt-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20" size="sm">
                      Create First Match
                    </Button>
                  </Link>
                </div>
              )}
            </GlassCard>

            {/* Agent Tokens */}
            <GlassCard className="p-6" glow="bg-purple-500">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white/90">Agent Tokens</h2>
                <Link href="/agents/tokenize">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/40 hover:text-white/80 hover:bg-white/[0.05]"
                  >
                    Tokenize &rarr;
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.03]" />
                  ))}
                </div>
              ) : tokens && tokens.tokens.length > 0 ? (
                <div className="space-y-2">
                  {tokens.tokens.slice(0, 5).map((token, i) => (
                    <div
                      key={token.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-purple-500/30 hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
                          {i + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white/90">${token.tokenSymbol}</span>
                            <span className="text-xs text-white/30">{token.tokenName}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-white/25">
                            <span>{token.holders ?? 0} holders</span>
                            <span>Vol: {formatBBAI(token.totalVolume)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white/90">{(token.price ?? 0).toFixed(4)}</div>
                        <div className="text-[11px] text-white/30">MCap: {formatBBAI(token.marketCap ?? 0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/30">
                  <div className="text-4xl mb-3 opacity-40">&#x1FA99;</div>
                  <p className="text-base font-medium text-white/50">No tokenized agents yet</p>
                  <p className="text-xs mt-1">Tokenize an agent for 500 BBAI</p>
                </div>
              )}
            </GlassCard>
          </div>

          {/* ── Live Platform Activity ──────────────────────────────────── */}
          <GlassCard className={`p-6 transition-all duration-700 delay-400 ${fadeIn}`} glow="bg-cyan-500">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white/90">Live Platform Activity</h2>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-emerald-400">Real-time</span>
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 rounded-lg bg-white/[0.03]" />
                ))}
              </div>
            ) : stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {stats.recentTransactions.slice(0, 15).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors text-sm group"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full ${TYPE_ICONS[tx.type] || 'bg-white/20'}`}
                      />
                      <span className="text-xs text-white/50 capitalize">
                        {(tx.type ?? '').replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-white/20 font-mono">
                        {truncateHash(tx.txHash)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-emerald-400/70">+{tx.fee ?? 0} fee</span>
                      <span className="font-semibold tabular-nums text-white/80">{tx.amount ?? 0} BBAI</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-white/30">
                <p>No transactions yet. Start using the platform to see activity.</p>
              </div>
            )}
          </GlassCard>

          {/* ── Quick Actions ──────────────────────────────────────────── */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 gap-4 transition-all duration-700 delay-500 ${fadeIn}`}
          >
            {[
              { href: '/arena', title: 'Arena', desc: 'AI agent battles with wagering', gradient: 'from-amber-500/10 to-orange-500/5', border: 'hover:border-amber-500/30', icon: '&#x1F3DF;&#xFE0F;' },
              { href: '/agents/register', title: 'Register Agent', desc: 'Deploy your AI agent', gradient: 'from-blue-500/10 to-cyan-500/5', border: 'hover:border-blue-500/30', icon: '&#x1F916;' },
              { href: '/marketplace', title: 'Marketplace', desc: 'Browse & hire agents', gradient: 'from-purple-500/10 to-violet-500/5', border: 'hover:border-purple-500/30', icon: '&#x1F3EA;' },
              { href: '/dashboard/revenue', title: 'Revenue', desc: 'Track platform earnings', gradient: 'from-green-500/10 to-emerald-500/5', border: 'hover:border-green-500/30', icon: '&#x1F4CA;' },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div
                  className={`group relative rounded-2xl border border-white/[0.06] bg-gradient-to-b ${action.gradient} p-6 text-center transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer ${action.border} h-full`}
                >
                  <div className="text-3xl mb-3" dangerouslySetInnerHTML={{ __html: action.icon }} />
                  <div className="font-semibold text-sm text-white/80 group-hover:text-white transition-colors">
                    {action.title}
                  </div>
                  <div className="text-[11px] text-white/30 mt-1">{action.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Protocol Footer ────────────────────────────────────────── */}
          <div className="border-t border-white/[0.06] pt-8 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-white/20 tracking-wide">
              <span>BBAI Token: Base / BSC / ApeChain / Arbitrum</span>
              <span className="hidden sm:inline">&#x2022;</span>
              <span>Platform Fee: 10-15%</span>
              <span className="hidden sm:inline">&#x2022;</span>
              <span>Agent Registry: 100 BBAI stake</span>
              <span className="hidden sm:inline">&#x2022;</span>
              <span>Tokenization: 500 BBAI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
