'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  pricePerQuery: string;
  totalExecutions: number;
  totalRevenue: string;
  rating: number;
  nftTokenId: number | null;
  chainId: number | null;
  createdAt: string;
}

const CHAIN_LABELS: Record<number, { name: string; color: string }> = {
  8453: { name: 'Base', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  56: { name: 'BSC', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
};

const CAPABILITY_ICONS: Record<string, string> = {
  search: '🔍',
  finance: '📊',
  blockchain: '⛓️',
  media: '🎬',
  utility: '🛠️',
  location: '📍',
};

function AgentCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-16 rounded-full" />)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      </CardContent>
    </Card>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3 h-3 ${star <= full ? 'text-yellow-500' : star === full + 1 && partial > 0 ? 'text-yellow-500/50' : 'text-muted-foreground/20'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function AgentMarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'cheap'>('popular');

  useEffect(() => {
    async function fetchAgents() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('/api/agents?limit=50', { signal: controller.signal });
        const data = await res.json();
        setAgents(data.agents || []);
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    let result = category === 'all'
      ? agents
      : agents.filter((a) => {
          const caps = a.capabilities as string[];
          const tools = a.tools as string[];
          if (category === 'search') return caps.includes('search') || tools.some((t) => t.includes('search'));
          if (category === 'finance') return caps.includes('finance') || tools.some((t) => ['coin_data', 'stock_chart', 'wallet_analyzer', 'token_retrieval'].includes(t));
          if (category === 'blockchain') return caps.includes('blockchain') || tools.some((t) => ['wallet_analyzer', 'nft_retrieval', 'token_retrieval'].includes(t));
          if (category === 'media') return caps.includes('media') || tools.some((t) => ['youtube_search', 'reddit_search', 'movie_or_tv_search'].includes(t));
          if (category === 'utility') return caps.includes('utility') || tools.some((t) => ['code_interpreter', 'text_translate', 'retrieve'].includes(t));
          return true;
        });

    if (sortBy === 'rating') result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'cheap') result = [...result].sort((a, b) => parseFloat(a.pricePerQuery) - parseFloat(b.pricePerQuery));
    else result = [...result].sort((a, b) => (b.totalExecutions || 0) - (a.totalExecutions || 0));

    return result;
  }, [agents, category, sortBy]);

  const totalAgents = agents.length;
  const totalExecutions = agents.reduce((sum, a) => sum + (a.totalExecutions || 0), 0);
  const avgRating = agents.length > 0 ? (agents.reduce((sum, a) => sum + (a.rating || 0), 0) / agents.length) : 0;

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Hero Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Agent Marketplace</h1>
              <p className="text-muted-foreground mt-1 max-w-lg">
                Discover, hire, and deploy AI agents. Each agent is an on-chain NFT with unique capabilities.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">Back to Search</Button>
              </Link>
              <Link href="/agents/create">
                <Button size="sm" className="holographic-button text-white border-0">
                  Create Agent
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Summary */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3 mt-8">
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalAgents}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Active Agents</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalExecutions.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Executions</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{avgRating.toFixed(1)}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Avg Rating</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filter & Sort Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Tabs value={category} onValueChange={setCategory} className="w-full sm:w-auto">
            <TabsList className="h-9 flex-wrap">
              {[
                { value: 'all', label: 'All' },
                { value: 'search', label: '🔍 Search' },
                { value: 'finance', label: '📊 Finance' },
                { value: 'blockchain', label: '⛓️ Chain' },
                { value: 'media', label: '🎬 Media' },
                { value: 'utility', label: '🛠️ Utility' },
              ].map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-3">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            {([
              { value: 'popular', label: 'Popular' },
              { value: 'rating', label: 'Top Rated' },
              { value: 'cheap', label: 'Cheapest' },
            ] as const).map((s) => (
              <Button
                key={s.value}
                variant={sortBy === s.value ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSortBy(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Agent Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <AgentCardSkeleton key={i} />)}
          </div>
        ) : filteredAgents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-muted-foreground text-lg font-medium">No agents found</p>
              <p className="text-muted-foreground text-sm mt-1">Try a different category or create your own agent.</p>
              <Link href="/agents/create" className="mt-5">
                <Button>Create Agent</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((a) => {
              const chainInfo = a.chainId ? CHAIN_LABELS[a.chainId] : null;
              const maxExec = Math.max(...agents.map((x) => x.totalExecutions || 1));
              return (
                <Link key={a.id} href={`/agents/${a.id}`}>
                  <Card className="h-full group hover:border-primary/40 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-primary/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                          {a.name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {a.nftTokenId !== null && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="green" className="text-[10px]">NFT #{a.nftTokenId}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>On-chain verified agent</TooltipContent>
                            </Tooltip>
                          )}
                          {chainInfo && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${chainInfo.color}`}>
                              {chainInfo.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <CardDescription className="line-clamp-2 text-xs">
                        {a.description || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Capabilities */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(a.capabilities as string[]).map((c) => (
                          <span key={c} className="inline-flex items-center gap-0.5 text-[10px] bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full">
                            {CAPABILITY_ICONS[c] || '•'} {c}
                          </span>
                        ))}
                      </div>

                      {/* Tools */}
                      <div className="flex flex-wrap gap-1">
                        {(a.tools as string[]).slice(0, 4).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{t}</Badge>
                        ))}
                        {(a.tools as string[]).length > 4 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            +{(a.tools as string[]).length - 4}
                          </Badge>
                        )}
                      </div>

                      <Separator className="my-1" />

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <div className="text-sm font-bold text-primary">{a.pricePerQuery}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">BBAI/query</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <div className="text-sm font-bold">{a.totalExecutions.toLocaleString()}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">Runs</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <div className="text-sm font-bold">{a.rating?.toFixed(1) || '0.0'}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">Rating</div>
                        </div>
                      </div>

                      {/* Popularity bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Popularity</span>
                          <span>{((a.totalExecutions / maxExec) * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={(a.totalExecutions / maxExec) * 100} className="h-1" />
                      </div>

                      {/* Rating Stars */}
                      <div className="flex items-center justify-between">
                        <StarRating rating={a.rating || 0} />
                        <span className="text-[10px] text-muted-foreground">
                          {parseFloat(a.totalRevenue || '0').toLocaleString()} BBAI earned
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
