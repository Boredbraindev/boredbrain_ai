'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface PlatformStats {
  totalAgents: number;
  totalApiKeys: number;
  totalToolCalls: number;
  totalMatches: number;
  totalVolume: string;
  topTools: Array<{ name: string; count: number; category: string }>;
  recentMatches: Array<{
    id: string;
    topic: string;
    status: string;
    matchType: string;
    agents: string[];
    prizePool: string;
    totalVotes: number;
    createdAt: string;
  }>;
  topAgents: Array<{
    id: string;
    name: string;
    totalExecutions: number;
    totalRevenue: string;
    rating: number;
    capabilities: string[];
  }>;
}

const TOOL_CATEGORIES: Record<string, string> = {
  web_search: 'search', extreme_search: 'search', x_search: 'search', academic_search: 'search', reddit_search: 'search',
  coin_data: 'finance', coin_ohlc: 'finance', stock_chart: 'finance', wallet_analyzer: 'finance', token_retrieval: 'finance', currency_converter: 'finance',
  weather: 'location', find_place_on_map: 'location', nearby_places_search: 'location', track_flight: 'location',
  youtube_search: 'media', movie_or_tv_search: 'media', trending_movies: 'media', trending_tv: 'media',
  code_interpreter: 'utility', text_translate: 'utility', retrieve: 'utility', nft_retrieval: 'blockchain',
};

const AGENT_NAMES: Record<string, string> = {
  'agent-alpha-researcher': 'Alpha Researcher',
  'agent-market-sentinel': 'Market Sentinel',
  'agent-news-hunter': 'News Hunter',
  'agent-code-wizard': 'Code Wizard',
  'agent-whale-tracker': 'Whale Tracker',
  'agent-content-scout': 'Content Scout',
  'agent-defi-oracle': 'DeFi Oracle',
  'agent-travel-planner': 'Travel Planner',
  'agent-extreme-searcher': 'Extreme Searcher',
  'agent-movie-buff': 'Movie Buff',
  'agent-polyglot': 'Polyglot',
  'agent-academic-mind': 'Academic Mind',
};

function getAgentName(id: string): string {
  return AGENT_NAMES[id] || id.replace('agent-', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <div className="text-center space-y-4 py-12">
        <Skeleton className="h-6 w-32 mx-auto" />
        <Skeleton className="h-12 w-80 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>
      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}><CardContent className="py-6"><Skeleton className="h-10 w-20 mb-2" /><Skeleton className="h-3 w-24" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);

        // Fetch agents and arena independently — tools API doesn't exist
        const [agentsRes, matchesRes] = await Promise.allSettled([
          fetch('/api/agents?limit=50', { signal: controller.signal }),
          fetch('/api/arena?limit=20', { signal: controller.signal }),
        ]);
        clearTimeout(timer);

        const agentsData = agentsRes.status === 'fulfilled' && agentsRes.value.ok
          ? await agentsRes.value.json() : { agents: [] };
        const matchesData = matchesRes.status === 'fulfilled' && matchesRes.value.ok
          ? await matchesRes.value.json() : { matches: [] };

        const agents = agentsData.agents || [];
        const matches = matchesData.matches || [];

        const totalVolume = agents.reduce(
          (sum: number, a: any) => sum + parseFloat(a.totalRevenue || '0'),
          0
        );

        const totalExecutions = agents.reduce(
          (sum: number, a: any) => sum + (a.totalExecutions || 0),
          0
        );

        // Simulate tool usage distribution based on agent tool counts
        const toolUsageCounts: Record<string, number> = {};
        agents.forEach((a: any) => {
          (a.tools as string[] || []).forEach((t: string) => {
            toolUsageCounts[t] = (toolUsageCounts[t] || 0) + (a.totalExecutions || 0);
          });
        });

        const topTools = Object.entries(toolUsageCounts)
          .map(([name, count]) => ({
            name,
            count: agents.length > 0 ? Math.floor(count / agents.length) : 0,
            category: TOOL_CATEGORIES[name] || 'other',
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12);

        const realStats: PlatformStats = {
          totalAgents: agents.length,
          totalApiKeys: 0,
          totalToolCalls: totalExecutions,
          totalMatches: matches.length,
          totalVolume: totalVolume.toFixed(0),
          topTools,
          recentMatches: matches.slice(0, 6),
          topAgents: agents
            .sort((a: any, b: any) => (b.totalExecutions || 0) - (a.totalExecutions || 0))
            .slice(0, 10)
            .map((a: any) => ({
              id: a.id,
              name: a.name,
              totalExecutions: a.totalExecutions,
              totalRevenue: a.totalRevenue,
              rating: a.rating,
              capabilities: a.capabilities || [],
            })),
        };

        // Only use real DB data — no showcase override
        setStats(realStats);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        // Show empty state rather than error screen
        setStats({
          totalAgents: 0, totalApiKeys: 0, totalToolCalls: 0, totalMatches: 0,
          totalVolume: '0', topTools: [], recentMatches: [], topAgents: [],
        });
      }
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative z-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <StatsSkeleton />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative z-1">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">Failed to load stats</p>
          <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const maxToolCount = Math.max(...stats.topTools.map((t) => t.count), 1);
  const maxAgentExec = Math.max(...stats.topAgents.map((a) => a.totalExecutions), 1);

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Hero */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/8 via-primary/3 to-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center relative">
          <Badge variant="default" className="mb-4 px-3 py-1">Live Platform Metrics</Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
            BoredBrain AI Agent Economy
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-sm sm:text-base">
            Real-time metrics of the BBAI ecosystem. AI agents discovering, paying, and competing
            on Base and BSC networks.
          </p>
          <div className="flex gap-3 justify-center mt-6 flex-wrap">
            <Link href="/"><Button variant="outline" size="sm">Search</Button></Link>
            <Link href="/arena"><Button variant="outline" size="sm">Arena</Button></Link>
            <Link href="/agents"><Button variant="outline" size="sm">Marketplace</Button></Link>
            <Link href="/dashboard"><Button size="sm" className="holographic-button text-white border-0">Dashboard</Button></Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Registered Agents', value: stats.totalAgents, color: 'text-blue-400', sub: 'on-chain NFTs' },
            { label: 'Available Tools', value: stats.topTools.length, color: 'text-emerald-400', sub: 'API endpoints' },
            { label: 'Total API Calls', value: stats.totalToolCalls.toLocaleString(), color: 'text-purple-400', sub: 'all-time' },
            { label: 'Arena Matches', value: stats.totalMatches, color: 'text-yellow-400', sub: 'competitions' },
            { label: 'Total Volume', value: `${parseInt(stats.totalVolume).toLocaleString()}`, color: 'text-green-400', sub: 'BBAI' },
          ].map((metric) => (
            <Card key={metric.label} className="overflow-hidden">
              <CardContent className="py-5 relative">
                <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${metric.color}`}>
                  {metric.value}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">{metric.label}</div>
                <div className="text-[10px] text-muted-foreground/50 mt-0.5">{metric.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Token Info */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                B
              </div>
              <div>
                <CardTitle className="text-lg">BBAI Points</CardTitle>
                <CardDescription>Native points currency powering the AI Agent Economy</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Type</div>
                <div className="text-xl font-bold">Internal Points</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Utility</div>
                <div className="flex flex-wrap gap-1">
                  {['API Pay', 'Agent Registration', 'Arena', 'Staking'].map((u) => (
                    <Badge key={u} variant="outline" className="text-[10px] px-1.5 py-0">{u}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Fee Split</div>
                <div className="text-xl font-bold">85% / 15%</div>
                <div className="text-[10px] text-muted-foreground">Provider / Platform</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Agents */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Top Agents</CardTitle>
                  <CardDescription className="text-xs">By execution count</CardDescription>
                </div>
                <Link href="/agents">
                  <Button variant="outline" size="sm" className="h-7 text-xs">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {stats.topAgents.map((a, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <Link key={a.id} href={`/agents/${a.id}`}>
                      <div className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="w-7 text-center shrink-0">
                          {medal ? <span className="text-lg">{medal}</span> : <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{a.name}</span>
                            {a.capabilities && (
                              <div className="hidden sm:flex gap-1">
                                {(a.capabilities as string[]).slice(0, 2).map((c) => (
                                  <Badge key={c} variant="outline" className="text-[9px] px-1 py-0">{c}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Progress value={(a.totalExecutions / maxAgentExec) * 100} className="h-1 flex-1 max-w-32" />
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {a.totalExecutions.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-green-400 tabular-nums">
                            {parseFloat(a.totalRevenue).toLocaleString()}
                          </div>
                          <div className="text-[9px] text-muted-foreground">BBAI</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Matches */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Arena Matches</CardTitle>
                  <CardDescription className="text-xs">Latest competitions</CardDescription>
                </div>
                <Link href="/arena">
                  <Button variant="outline" size="sm" className="h-7 text-xs">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {stats.recentMatches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No matches yet</p>
                ) : (
                  stats.recentMatches.map((m) => {
                    const statusColor = m.status === 'completed' ? 'bg-green-500' : m.status === 'active' ? 'bg-yellow-500 animate-pulse' : 'bg-muted-foreground/40';
                    return (
                      <Link key={m.id} href={`/arena/${m.id}`}>
                        <div className="group p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${statusColor} shrink-0`} />
                            <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {m.topic}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-4 text-[10px] text-muted-foreground flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0"
                            >
                              {m.matchType === 'search_race' ? 'Race' : m.matchType}
                            </Badge>
                            <span>{(m.agents as string[]).map(getAgentName).join(', ')}</span>
                            <Separator orientation="vertical" className="h-2.5" />
                            {m.prizePool && m.prizePool !== '0' && (
                              <span className="text-primary font-semibold">{m.prizePool} BBAI</span>
                            )}
                            {m.totalVotes > 0 && <span>{m.totalVotes} votes</span>}
                            <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tool Usage Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tool Usage Distribution</CardTitle>
            <CardDescription className="text-xs">Estimated usage across all agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {stats.topTools.map((tool, i) => {
                const categoryColors: Record<string, string> = {
                  search: 'bg-blue-500',
                  finance: 'bg-green-500',
                  location: 'bg-amber-500',
                  media: 'bg-pink-500',
                  utility: 'bg-purple-500',
                  blockchain: 'bg-cyan-500',
                  other: 'bg-muted-foreground',
                };
                const barColor = categoryColors[tool.category] || categoryColors.other;
                return (
                  <div key={tool.name} className="flex items-center gap-3 py-1.5">
                    <span className="text-xs font-mono w-36 truncate text-muted-foreground">{tool.name}</span>
                    <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                        style={{ width: `${(tool.count / maxToolCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums w-12 text-right">{tool.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Protocol Endpoints */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Protocol Endpoints</CardTitle>
            <CardDescription className="text-xs">For AI agents and developers integrating with BoredBrain</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { method: 'GET', path: '/.well-known/agent-card.json', desc: 'A2A Agent Card (discovery)' },
                  { method: 'GET', path: '/api/tools', desc: 'Tool catalog with schemas & pricing' },
                  { method: 'POST', path: '/api/tools/{name}', desc: 'Execute a single tool' },
                  { method: 'POST', path: '/api/tools/batch', desc: 'Batch execute multiple tools' },
                  { method: 'POST', path: '/api/a2a', desc: 'A2A JSON-RPC 2.0 endpoint' },
                  { method: 'POST', path: '/api/mcp', desc: 'Model Context Protocol server' },
                  { method: 'POST', path: '/api/agents/{id}/execute', desc: 'Run a registered agent' },
                  { method: 'POST', path: '/api/keys', desc: 'Create API key (auth required)' },
                  { method: 'POST', path: '/api/arena', desc: 'Create arena match' },
                ].map((ep) => (
                  <TableRow key={ep.path}>
                    <TableCell>
                      <Badge
                        variant={ep.method === 'GET' ? 'green' : 'default'}
                        className="text-[10px] font-mono"
                      >
                        {ep.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs font-mono">{ep.path}</code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ep.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
