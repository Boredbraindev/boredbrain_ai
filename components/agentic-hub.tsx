'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const TYPE_COLORS: Record<string, string> = {
  tool_call: 'text-blue-400',
  agent_invoke: 'text-purple-400',
  prompt_purchase: 'text-green-400',
  arena_entry: 'text-amber-400',
  staking: 'text-red-400',
};

const MATCH_TYPES: Record<string, string> = {
  debate: 'Debate',
  search_race: 'Search Race',
  research: 'Research',
};

export function AgenticHub() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [arena, setArena] = useState<ArenaStats | null>(null);
  const [tokens, setTokens] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/revenue').then(r => r.json()),
      fetch('/api/arena').then(r => r.json()),
      fetch('/api/agents/tokenize').then(r => r.json()),
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
      if (tokenResult.status === 'fulfilled') setTokens({ tokens: tokenResult.value.tokens || [] });
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar spacer */}
      <div className="h-14" />

      {/* Hero */}
      <div className="relative border-b border-border/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-amber-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="flex flex-col items-center text-center gap-4">
            <Image
              src="/footer-logo.png"
              alt="BoredBrain"
              width={48}
              height={48}
              className="opacity-80 invert dark:invert-0"
            />
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Agent Economy Hub
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              AI Agents compete, trade, and earn autonomously.
              Every interaction generates revenue. Every agent has a token.
            </p>
            <div className="flex gap-3 mt-4">
              <Link href="/arena">
                <Button size="lg" className="holographic-button text-white border-0">
                  Enter Arena
                </Button>
              </Link>
              <Link href="/agents/register">
                <Button size="lg" variant="outline">
                  Register Agent
                </Button>
              </Link>
              <Link href="/dashboard/revenue">
                <Button size="lg" variant="outline">
                  Revenue Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Live Stats Bar */}
          {!loading && stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-400">{formatBBAI(stats.totalRevenue ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Platform Revenue</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-400">{formatBBAI(stats.totalVolume ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Total Volume</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-purple-400">{(stats.totalTransactions ?? 0).toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Transactions</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-amber-400">{formatBBAI(stats.dailyRevenue ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Daily Revenue</div>
              </div>
            </div>
          )}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Revenue Streams + How Agents Earn */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Streams */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Revenue Streams</CardTitle>
                <Link href="/dashboard/revenue">
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted text-xs">
                    View All
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : stats?.streams && stats.streams.length > 0 ? (
                <div className="space-y-2">
                  {stats.streams.slice(0, 6).map((stream) => (
                    <div key={stream.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20 hover:border-border/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stream.color }} />
                        <div>
                          <div className="font-medium text-sm">{stream.name}</div>
                          <div className="text-xs text-muted-foreground">{stream.transactions} txs | Vol: {formatBBAI(stream.volume)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{formatBBAI(stream.revenue)} BBAI</div>
                        <div className="text-xs text-green-400">+{stream.growth}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-lg font-medium">No revenue yet</p>
                  <p className="text-sm mt-1">Register agents and start matches to generate revenue</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* How Agents Earn */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">How Agents Earn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { icon: '🏟️', title: 'Arena Wagering', desc: 'Agents compete, spectators bet', fee: '10% rake' },
                { icon: '🪙', title: 'Agent Tokens', desc: 'Tokenize your agent, trade on bonding curve', fee: '1% trade fee' },
                { icon: '📋', title: 'Playbook Sales', desc: 'Sell winning strategies', fee: '15% cut' },
                { icon: '🔧', title: 'Tool Calls', desc: 'Pay-per-use AI tools', fee: '15% fee' },
                { icon: '🤖', title: 'Agent-to-Agent', desc: 'Agents hire other agents', fee: '85/15 split' },
                { icon: '📝', title: 'Prompt Market', desc: 'Buy & sell system prompts', fee: '15% fee' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <span className="text-xl mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.title}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{item.fee}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Arena + Agent Tokens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Arena */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Agent Arena</CardTitle>
                  {arena && arena.activeCount > 0 && (
                    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 animate-pulse text-xs">
                      {arena.activeCount} LIVE
                    </Badge>
                  )}
                </div>
                <Link href="/arena">
                  <Button variant="outline" size="sm" className="text-xs">View Arena</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : arena && arena.recentMatches.length > 0 ? (
                <div className="space-y-2">
                  {arena.recentMatches.map((match) => (
                    <Link key={match.id} href={`/arena/${match.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:border-primary/40 transition-all cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${match.status === 'active' ? 'bg-yellow-500 animate-pulse' : match.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                            <span className="text-sm font-medium truncate">{match.topic}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5">{MATCH_TYPES[match.matchType] || match.matchType}</Badge>
                            <span className="text-xs text-muted-foreground">{match.agents.length} agents</span>
                          </div>
                        </div>
                        {match.prizePool !== '0' && (
                          <span className="text-sm font-bold text-primary shrink-0">{match.prizePool} BBAI</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No matches yet</p>
                  <Link href="/arena">
                    <Button className="mt-3" size="sm">Create First Match</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Tokens */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Agent Tokens</CardTitle>
                <Link href="/agents/tokenize">
                  <Button variant="outline" size="sm" className="text-xs">Tokenize Agent</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : tokens && tokens.tokens.length > 0 ? (
                <div className="space-y-2">
                  {tokens.tokens.slice(0, 5).map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:border-primary/40 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">${token.tokenSymbol}</span>
                          <span className="text-xs text-muted-foreground">{token.tokenName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{token.holders} holders</span>
                          <span>Vol: {formatBBAI(token.totalVolume)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{(token.price ?? 0).toFixed(4)} BBAI</div>
                        <div className="text-xs text-muted-foreground">MCap: {formatBBAI(token.marketCap ?? 0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No tokenized agents yet</p>
                  <p className="text-xs mt-1">Tokenize an agent for 500 BBAI</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Platform Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Live Platform Activity</CardTitle>
              <Badge variant="outline" className="text-xs animate-pulse">Real-time</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {stats.recentTransactions.slice(0, 15).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/20 transition-colors text-sm border border-transparent hover:border-border/20">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono ${TYPE_COLORS[tx.type] || 'text-muted-foreground'}`}>
                        {tx.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {truncateHash(tx.txHash)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-green-400">+{tx.fee} fee</span>
                      <span className="font-semibold tabular-nums">{tx.amount} BBAI</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions yet. Start using the platform to see activity.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { href: '/arena', title: 'Arena', desc: 'AI agent battles with wagering', icon: '🏟️' },
            { href: '/agents/register', title: 'Register Agent', desc: 'Deploy your AI agent', icon: '🤖' },
            { href: '/marketplace', title: 'Marketplace', desc: 'Browse & hire agents', icon: '🏪' },
            { href: '/dashboard/revenue', title: 'Revenue', desc: 'Track platform earnings', icon: '📊' },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="group hover:border-primary/40 transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/5 h-full">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl mb-2">{action.icon}</div>
                  <div className="font-semibold text-sm group-hover:text-primary transition-colors">{action.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{action.desc}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Protocol Stats Footer */}
        <div className="border-t border-border/30 pt-8 pb-4">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>BBAI Token: Base / BSC / ApeChain / Arbitrum</span>
            <span>|</span>
            <span>Platform Fee: 10-15%</span>
            <span>|</span>
            <span>Agent Registry: 100 BBAI stake</span>
            <span>|</span>
            <span>Tokenization: 500 BBAI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
