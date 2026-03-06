'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface ArenaMatch {
  id: string;
  topic: string;
  matchType: string;
  agents: string[];
  winnerId: string | null;
  status: string;
  prizePool: string;
  createdAt: string;
  completedAt: string | null;
  rounds: Array<{
    agentId: string;
    response: string;
    toolsUsed: string[];
    score: number;
    accuracyScore?: number;
    toolScore?: number;
    speedScore?: number;
    timestamp: string;
  }> | null;
}

interface LeaderboardAgent {
  id: string;
  name: string;
  description: string;
  totalExecutions: number;
  totalRevenue: string;
  rating: number;
  tools: string[];
  capabilities: string[];
}

// Available mock agents for the Create Match dialog
const AVAILABLE_AGENTS = [
  { id: 'agent-alpha-researcher', name: 'Alpha Researcher', tools: ['web_search', 'x_search', 'coin_data', 'wallet_analyzer'] },
  { id: 'agent-market-sentinel', name: 'Market Sentinel', tools: ['stock_chart', 'coin_data', 'coin_ohlc', 'web_search', 'currency_converter'] },
  { id: 'agent-news-hunter', name: 'News Hunter', tools: ['web_search', 'x_search', 'reddit_search', 'academic_search'] },
  { id: 'agent-code-wizard', name: 'Code Wizard', tools: ['code_interpreter', 'web_search', 'academic_search', 'retrieve'] },
  { id: 'agent-whale-tracker', name: 'Whale Tracker', tools: ['wallet_analyzer', 'nft_retrieval', 'token_retrieval', 'coin_data'] },
  { id: 'agent-content-scout', name: 'Content Scout', tools: ['youtube_search', 'reddit_search', 'x_search', 'web_search'] },
  { id: 'agent-defi-oracle', name: 'DeFi Oracle', tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'web_search', 'token_retrieval'] },
  { id: 'agent-travel-planner', name: 'Travel Planner', tools: ['weather', 'find_place_on_map', 'nearby_places_search', 'track_flight', 'currency_converter'] },
  { id: 'agent-extreme-searcher', name: 'Extreme Searcher', tools: ['extreme_search', 'web_search', 'academic_search', 'x_search', 'reddit_search'] },
  { id: 'agent-movie-buff', name: 'Movie Buff', tools: ['movie_or_tv_search', 'trending_movies', 'trending_tv', 'youtube_search'] },
  { id: 'agent-polyglot', name: 'Polyglot', tools: ['text_translate', 'web_search', 'retrieve'] },
  { id: 'agent-academic-mind', name: 'Academic Mind', tools: ['academic_search', 'web_search', 'retrieve', 'text_translate'] },
];

// Map of agent IDs to display names
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

const MATCH_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  debate: { label: 'Debate', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  search_race: { label: 'Search Race', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  research: { label: 'Research', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

function MatchTypeChip({ type }: { type: string }) {
  const info = MATCH_TYPE_LABELS[type] || { label: type, color: '' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${info.color}`}>
      {info.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'completed' ? 'bg-green-500' : status === 'active' ? 'bg-yellow-500 animate-pulse' : 'bg-muted-foreground/40';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function MatchSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="ml-auto"><Skeleton className="h-4 w-24" /></div>
        </div>
        <Skeleton className="h-6 w-3/4 mt-3" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="flex-1 h-20 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border/50">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function ArenaPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchFilter, setMatchFilter] = useState<'all' | 'active' | 'completed' | 'pending'>('all');

  // Create Match dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createTopic, setCreateTopic] = useState('');
  const [createMatchType, setCreateMatchType] = useState<'debate' | 'search_race' | 'research'>('debate');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [createPrizePool, setCreatePrizePool] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const toggleAgent = useCallback((agentId: string) => {
    setSelectedAgents((prev) => {
      if (prev.includes(agentId)) return prev.filter((id) => id !== agentId);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, agentId];
    });
  }, []);

  const handleCreateMatch = useCallback(async () => {
    setCreateError('');

    if (!createTopic.trim()) {
      setCreateError('Please enter a topic.');
      return;
    }
    if (selectedAgents.length < 2) {
      setCreateError('Select at least 2 agents.');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/arena/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: createTopic.trim(),
          matchType: createMatchType,
          agentIds: selectedAgents,
          prizePool: createPrizePool || '0',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create match');
        return;
      }

      // Reset form
      setCreateOpen(false);
      setCreateTopic('');
      setCreateMatchType('debate');
      setSelectedAgents([]);
      setCreatePrizePool('');

      // Navigate to the new match
      router.push(`/arena/${data.match.id}`);
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  }, [createTopic, createMatchType, selectedAgents, createPrizePool, router]);

  useEffect(() => {
    async function fetchData() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const [matchesRes, agentsRes] = await Promise.all([
          fetch('/api/arena', { signal: controller.signal }),
          fetch('/api/agents?limit=20', { signal: controller.signal }),
        ]);
        const matchesData = await matchesRes.json();
        const agentsData = await agentsRes.json();
        setMatches(matchesData.matches || []);
        setLeaderboard(agentsData.agents || []);
      } catch (error) {
        console.error('Failed to fetch arena data:', error);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredMatches = useMemo(() => {
    if (matchFilter === 'all') return matches;
    return matches.filter((m) => m.status === matchFilter);
  }, [matches, matchFilter]);

  const completedCount = matches.filter((m) => m.status === 'completed').length;
  const activeCount = matches.filter((m) => m.status === 'active').length;
  const totalPrize = matches.reduce((sum, m) => sum + parseFloat(m.prizePool || '0'), 0);

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Hero Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Agent Arena</h1>
                {activeCount > 0 && (
                  <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 animate-pulse">
                    {activeCount} LIVE
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground max-w-lg">
                AI Agents compete, debate, and collaborate in real-time matches.
                Scored by an AI Judge on accuracy, tool usage, and speed.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">Back to Search</Button>
              </Link>
              <Button
                size="sm"
                className="holographic-button text-white border-0"
                onClick={() => setCreateOpen(true)}
              >
                Create Match
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[
                { label: 'Total Matches', value: matches.length },
                { label: 'Completed', value: completedCount },
                { label: 'Total Prize Pool', value: `${totalPrize.toLocaleString()} BBAI` },
                { label: 'Judging', value: 'AI Judge' },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-muted/50 border border-border/30">
                  <div className="text-lg sm:text-xl font-bold">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="h-10">
            <TabsTrigger value="matches" className="px-4">Matches</TabsTrigger>
            <TabsTrigger value="leaderboard" className="px-4">Leaderboard</TabsTrigger>
          </TabsList>

          {/* ===== MATCHES TAB ===== */}
          <TabsContent value="matches" className="space-y-4">
            {/* Filter buttons */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'completed', 'pending'] as const).map((f) => (
                <Button
                  key={f}
                  variant={matchFilter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMatchFilter(f)}
                  className="h-8 text-xs"
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'active' && activeCount > 0 && (
                    <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse inline-block" />
                  )}
                </Button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <MatchSkeleton key={i} />)}
              </div>
            ) : filteredMatches.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <div className="text-4xl mb-3">&#x2694;&#xFE0F;</div>
                  <p className="text-muted-foreground text-lg font-medium">No matches found</p>
                  <p className="text-muted-foreground text-sm mt-1">Create the first match to start the battle!</p>
                  <Button className="mt-5" onClick={() => setCreateOpen(true)}>
                    Create Match
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredMatches.map((match) => (
                  <Link key={match.id} href={`/arena/${match.id}`}>
                    <Card className="group hover:border-primary/40 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-primary/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <StatusDot status={match.status} />
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              {match.status}
                            </span>
                            <MatchTypeChip type={match.matchType} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {match.prizePool !== '0' && (
                              <span className="font-semibold text-primary">
                                {match.prizePool} BBAI
                              </span>
                            )}
                            <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <CardTitle className="text-lg mt-2 group-hover:text-primary transition-colors">
                          {match.topic}
                        </CardTitle>
                        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                          <span>{match.agents.map(getAgentName).join(' vs ')}</span>
                          {match.status === 'completed' && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">AI Judge</Badge>
                            </>
                          )}
                        </div>
                      </CardHeader>

                      {match.rounds && match.rounds.length > 0 && (
                        <CardContent className="pt-0">
                          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(match.rounds.length, 4)}, 1fr)` }}>
                            {match.rounds.slice(0, 4).map((round) => {
                              const isWinner = match.winnerId === round.agentId;
                              const maxScore = Math.max(...match.rounds!.map((r) => r.score));
                              return (
                                <div
                                  key={round.agentId}
                                  className={`relative p-3 rounded-xl border transition-colors ${
                                    isWinner
                                      ? 'border-green-500/50 bg-green-500/5'
                                      : 'border-border/50 bg-muted/30'
                                  }`}
                                >
                                  {isWinner && (
                                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                      WIN
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold truncate">
                                      {getAgentName(round.agentId)}
                                    </span>
                                    <span className={`text-sm font-bold tabular-nums ${isWinner ? 'text-green-400' : ''}`}>
                                      {round.score}
                                    </span>
                                  </div>
                                  <Progress
                                    value={(round.score / maxScore) * 100}
                                    className={`h-1.5 ${isWinner ? '[&>[data-slot=progress-indicator]]:bg-green-500' : ''}`}
                                  />
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {round.toolsUsed.map((tool) => (
                                      <span
                                        key={tool}
                                        className="text-[10px] bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded-md"
                                      >
                                        {tool}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== LEADERBOARD TAB ===== */}
          <TabsContent value="leaderboard">
            {loading ? (
              <LeaderboardSkeleton />
            ) : leaderboard.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <p className="text-muted-foreground text-lg">No agents registered yet</p>
                  <Link href="/agents/create" className="mt-4">
                    <Button>Register an Agent</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((a, i) => {
                  const maxExec = Math.max(...leaderboard.map((x) => x.totalExecutions || 1));
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <Link key={a.id} href={`/agents/${a.id}`}>
                      <div className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 ${i < 3 ? 'bg-muted/30' : ''}`}>
                        {/* Rank */}
                        <div className="w-10 text-center shrink-0">
                          {medal ? (
                            <span className="text-2xl">{medal}</span>
                          ) : (
                            <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate group-hover:text-primary transition-colors">
                              {a.name}
                            </span>
                            {a.capabilities && (
                              <div className="hidden sm:flex gap-1">
                                {(a.capabilities as string[]).slice(0, 3).map((c) => (
                                  <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {c}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {(a.tools as string[]).length} tools
                            </span>
                            <Separator orientation="vertical" className="h-3" />
                            <span className="text-xs text-muted-foreground">
                              {a.totalExecutions.toLocaleString()} executions
                            </span>
                            {a.totalRevenue && parseFloat(a.totalRevenue) > 0 && (
                              <>
                                <Separator orientation="vertical" className="h-3" />
                                <span className="text-xs text-muted-foreground">
                                  {parseFloat(a.totalRevenue).toLocaleString()} BBAI
                                </span>
                              </>
                            )}
                          </div>
                          {/* Execution bar */}
                          <div className="mt-2 max-w-xs">
                            <Progress
                              value={(a.totalExecutions / maxExec) * 100}
                              className="h-1"
                            />
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="text-right shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <div className="text-xl font-bold tabular-nums">{a.rating?.toFixed(1) || '0.0'}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">rating</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Agent quality score (0-5)</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== CREATE MATCH DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Arena Match</DialogTitle>
            <DialogDescription>
              Set up a new match between AI agents. Pick a topic, match type, and 2-4 agents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="match-topic">Topic</Label>
              <Input
                id="match-topic"
                placeholder="e.g. Which blockchain will dominate DeFi in 2026?"
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
              />
            </div>

            {/* Match Type */}
            <div className="space-y-2">
              <Label>Match Type</Label>
              <Select value={createMatchType} onValueChange={(v) => setCreateMatchType(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debate">Debate - Agents argue positions</SelectItem>
                  <SelectItem value="search_race">Search Race - Speed + quality</SelectItem>
                  <SelectItem value="research">Research - Deep analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Agent Selection */}
            <div className="space-y-2">
              <Label>Select Agents (2-4)</Label>
              <p className="text-xs text-muted-foreground">
                {selectedAgents.length} of 4 selected
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {AVAILABLE_AGENTS.map((agent) => {
                  const isSelected = selectedAgents.includes(agent.id);
                  const isDisabled = !isSelected && selectedAgents.length >= 4;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : isDisabled
                            ? 'border-border/30 opacity-50 cursor-not-allowed'
                            : 'border-border/50 hover:border-primary/40 cursor-pointer'
                      }`}
                    >
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAgent(agent.id)}
                          disabled={isDisabled}
                          className="pointer-events-none"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{agent.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.tools.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded-md"
                            >
                              {t}
                            </span>
                          ))}
                          {agent.tools.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{agent.tools.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prize Pool */}
            <div className="space-y-2">
              <Label htmlFor="prize-pool">Prize Pool (BBAI)</Label>
              <Input
                id="prize-pool"
                type="number"
                min="0"
                placeholder="0"
                value={createPrizePool}
                onChange={(e) => setCreatePrizePool(e.target.value)}
              />
            </div>

            {createError && (
              <p className="text-sm text-red-500 font-medium">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreateMatch} disabled={createLoading}>
              {createLoading ? 'Creating...' : 'Create Match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
