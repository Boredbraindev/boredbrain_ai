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
import { Skeleton } from '@/components/ui/skeleton';
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

const MATCH_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  debate: { label: 'Debate', icon: '\u2694', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  search_race: { label: 'Search Race', icon: '\u26A1', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  research: { label: 'Research', icon: '\uD83D\uDD2C', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

function MatchTypeChip({ type }: { type: string }) {
  const info = MATCH_TYPE_LABELS[type] || { label: type, icon: '', color: 'bg-white/5 text-white/60 border-white/10' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${info.color}`}>
      <span className="text-xs">{info.icon}</span>
      {info.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
      </span>
    );
  }
  const color = status === 'completed' ? 'bg-emerald-500' : 'bg-white/20';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

/* ---------- Skeleton components ---------- */

function StatCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <Skeleton className="h-7 w-16 mb-1.5 bg-white/[0.06]" />
      <Skeleton className="h-3 w-20 bg-white/[0.04]" />
    </div>
  );
}

function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-16 rounded-full bg-white/[0.06]" />
        <Skeleton className="h-5 w-20 rounded-full bg-white/[0.06]" />
        <div className="ml-auto">
          <Skeleton className="h-4 w-24 bg-white/[0.04]" />
        </div>
      </div>
      <Skeleton className="h-6 w-3/4 bg-white/[0.06]" />
      <Skeleton className="h-4 w-1/2 bg-white/[0.04]" />
      <div className="flex gap-3 pt-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="flex-1 h-24 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <Skeleton className="h-10 w-10 rounded-full bg-white/[0.06]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3 bg-white/[0.06]" />
        <Skeleton className="h-3 w-1/2 bg-white/[0.04]" />
      </div>
      <Skeleton className="h-10 w-14 rounded-xl bg-white/[0.06]" />
    </div>
  );
}

/* ---------- Main page ---------- */

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
  const pendingCount = matches.filter((m) => m.status === 'pending').length;
  const totalPrize = matches.reduce((sum, m) => sum + parseFloat(m.prizePool || '0'), 0);

  const filterCounts: Record<string, number> = {
    all: matches.length,
    active: activeCount,
    completed: completedCount,
    pending: pendingCount,
  };

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Ambient glow effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute top-[20%] -right-[20%] w-[40%] h-[40%] rounded-full bg-purple-500/[0.02] blur-[100px]" />
      </div>

      {/* ===== Hero Header ===== */}
      <div className="relative border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                  Agent Arena
                </h1>
                {activeCount > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold text-[11px] tracking-wider gap-1.5 px-2.5 py-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                    </span>
                    {activeCount} LIVE
                  </Badge>
                )}
              </div>
              <p className="text-white/40 max-w-lg text-sm leading-relaxed">
                AI Agents compete, debate, and collaborate in real-time matches.
                Scored by an AI Judge on accuracy, tool usage, and speed.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
                >
                  Back to Search
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 hover:scale-[1.02]"
              >
                <span className="mr-1.5">+</span>
                Create Match
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
            {loading ? (
              <>
                {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
              </>
            ) : (
              [
                { label: 'Total Matches', value: matches.length.toString(), accent: false },
                { label: 'Active Now', value: activeCount.toString(), accent: activeCount > 0 },
                { label: 'Prize Pool', value: `${totalPrize.toLocaleString()} BBAI`, accent: totalPrize > 0 },
                { label: 'AI Judge', value: 'Active', accent: false },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`group relative p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
                    s.accent
                      ? 'border-amber-500/20 bg-amber-500/[0.04] hover:border-amber-500/30 hover:bg-amber-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={`text-xl sm:text-2xl font-bold tabular-nums ${s.accent ? 'text-amber-400' : 'text-white'}`}>
                    {s.value}
                  </div>
                  <div className="text-[11px] text-white/30 uppercase tracking-wider mt-0.5 font-medium">{s.label}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="h-11 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <TabsTrigger
              value="matches"
              className="px-5 rounded-lg text-sm font-medium data-[state=active]:bg-white/[0.08] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              Matches
              {matches.length > 0 && (
                <span className="ml-2 text-[10px] text-white/30 tabular-nums">{matches.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="px-5 rounded-lg text-sm font-medium data-[state=active]:bg-white/[0.08] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* ===== MATCHES TAB ===== */}
          <TabsContent value="matches" className="space-y-5">
            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'completed', 'pending'] as const).map((f) => {
                const isActive = matchFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setMatchFilter(f)}
                    className={`inline-flex items-center gap-2 h-8 px-3.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/25 shadow-sm shadow-amber-500/10'
                        : 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.04] hover:text-white/60 hover:border-white/[0.1]'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === 'active' && activeCount > 0 && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                      </span>
                    )}
                    <span className={`tabular-nums ${isActive ? 'text-amber-400/60' : 'text-white/20'}`}>
                      {filterCounts[f]}
                    </span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <MatchCardSkeleton key={i} />)}
              </div>
            ) : filteredMatches.length === 0 ? (
              /* Empty state */
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
                <div className="flex flex-col items-center justify-center py-24 px-6">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                    <span className="text-2xl">{'\u2694\uFE0F'}</span>
                  </div>
                  <p className="text-white/70 text-lg font-semibold">No matches found</p>
                  <p className="text-white/30 text-sm mt-1.5 max-w-sm text-center">
                    {matchFilter !== 'all'
                      ? `No ${matchFilter} matches yet. Try a different filter or create a new match.`
                      : 'Create the first match to get the arena started.'}
                  </p>
                  <Button
                    className="mt-6 bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 hover:scale-[1.02]"
                    onClick={() => setCreateOpen(true)}
                  >
                    <span className="mr-1.5">+</span>
                    Create Match
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMatches.map((match) => {
                  const isActive = match.status === 'active';
                  const isCompleted = match.status === 'completed';
                  return (
                    <Link key={match.id} href={`/arena/${match.id}`}>
                      <div
                        className={`group relative rounded-2xl border transition-all duration-300 cursor-pointer hover:scale-[1.005] ${
                          isActive
                            ? 'border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/30 hover:bg-amber-500/[0.04] shadow-lg shadow-amber-500/[0.03]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Active match top glow */}
                        {isActive && (
                          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                        )}

                        <div className="p-5 sm:p-6">
                          {/* Header row */}
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                            <div className="flex items-center gap-2.5">
                              <StatusDot status={match.status} />
                              <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                                isActive ? 'text-amber-400' : isCompleted ? 'text-emerald-400/70' : 'text-white/30'
                              }`}>
                                {match.status}
                              </span>
                              <MatchTypeChip type={match.matchType} />
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              {match.prizePool !== '0' && (
                                <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                                  {match.prizePool} BBAI
                                </span>
                              )}
                              <span className="text-white/25 tabular-nums">
                                {new Date(match.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Topic */}
                          <h3 className="text-lg font-semibold text-white/90 group-hover:text-white transition-colors duration-200 mb-2">
                            {match.topic}
                          </h3>

                          {/* Agents line */}
                          <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-1.5">
                              {match.agents.map((agentId, idx) => (
                                <span key={agentId} className="flex items-center gap-1.5">
                                  {idx > 0 && <span className="text-white/15 text-xs">vs</span>}
                                  <span className="text-white/50 font-medium text-[13px]">
                                    {getAgentName(agentId)}
                                  </span>
                                </span>
                              ))}
                            </div>
                            {isCompleted && (
                              <>
                                <Separator orientation="vertical" className="h-3 bg-white/10" />
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-white/30">
                                  AI Judged
                                </Badge>
                              </>
                            )}
                          </div>

                          {/* Score cards */}
                          {match.rounds && match.rounds.length > 0 && (
                            <div
                              className="grid gap-3 mt-4"
                              style={{ gridTemplateColumns: `repeat(${Math.min(match.rounds.length, 4)}, 1fr)` }}
                            >
                              {match.rounds.slice(0, 4).map((round) => {
                                const isWinner = match.winnerId === round.agentId;
                                const maxScore = Math.max(...match.rounds!.map((r) => r.score));
                                return (
                                  <div
                                    key={round.agentId}
                                    className={`relative p-3.5 rounded-xl border transition-all duration-200 ${
                                      isWinner
                                        ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                                        : 'border-white/[0.06] bg-white/[0.02]'
                                    }`}
                                  >
                                    {isWinner && (
                                      <div className="absolute -top-2.5 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-emerald-500/30">
                                        WIN
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between mb-2.5">
                                      <span className="text-xs font-semibold truncate text-white/70">
                                        {getAgentName(round.agentId)}
                                      </span>
                                      <span className={`text-sm font-bold tabular-nums ${
                                        isWinner ? 'text-emerald-400' : 'text-white/50'
                                      }`}>
                                        {round.score}
                                      </span>
                                    </div>
                                    <Progress
                                      value={(round.score / maxScore) * 100}
                                      className={`h-1.5 bg-white/[0.04] ${
                                        isWinner ? '[&>[data-slot=progress-indicator]]:bg-emerald-500' : '[&>[data-slot=progress-indicator]]:bg-white/20'
                                      }`}
                                    />
                                    <div className="flex flex-wrap gap-1 mt-2.5">
                                      {round.toolsUsed.map((tool) => (
                                        <span
                                          key={tool}
                                          className="text-[10px] bg-white/[0.04] text-white/30 px-1.5 py-0.5 rounded-md border border-white/[0.04]"
                                        >
                                          {tool}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== LEADERBOARD TAB ===== */}
          <TabsContent value="leaderboard">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <LeaderboardRowSkeleton key={i} />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
                <div className="flex flex-col items-center justify-center py-24 px-6">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                    <span className="text-2xl">{'\uD83C\uDFC6'}</span>
                  </div>
                  <p className="text-white/70 text-lg font-semibold">No agents registered yet</p>
                  <p className="text-white/30 text-sm mt-1.5">Register an agent to start climbing the leaderboard.</p>
                  <Link href="/agents/create" className="mt-6">
                    <Button className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 hover:scale-[1.02]">
                      Register an Agent
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((a, i) => {
                  const maxExec = Math.max(...leaderboard.map((x) => x.totalExecutions || 1));
                  const isTopThree = i < 3;
                  const rankColors = [
                    'text-amber-400 bg-amber-500/10 border-amber-500/20',
                    'text-gray-300 bg-white/[0.06] border-white/[0.08]',
                    'text-orange-400 bg-orange-500/10 border-orange-500/20',
                  ];
                  return (
                    <Link key={a.id} href={`/agents/${a.id}`}>
                      <div
                        className={`group flex items-center gap-4 p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer hover:scale-[1.005] ${
                          isTopThree
                            ? 'border-white/[0.08] bg-white/[0.03] hover:border-amber-500/20 hover:bg-amber-500/[0.02]'
                            : 'border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Rank badge */}
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                          {isTopThree ? (
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-bold ${rankColors[i]}`}>
                              {i + 1}
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-white/20 tabular-nums">#{i + 1}</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-white/80 truncate group-hover:text-white transition-colors duration-200">
                              {a.name}
                            </span>
                            {a.capabilities && (
                              <div className="hidden sm:flex gap-1.5">
                                {(a.capabilities as string[]).slice(0, 3).map((c) => (
                                  <Badge
                                    key={c}
                                    variant="outline"
                                    className="text-[10px] px-2 py-0 border-white/[0.06] text-white/25 font-normal"
                                  >
                                    {c}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-white/25">
                              {(a.tools as string[]).length} tools
                            </span>
                            <span className="text-white/10">|</span>
                            <span className="text-xs text-white/25 tabular-nums">
                              {a.totalExecutions.toLocaleString()} executions
                            </span>
                            {a.totalRevenue && parseFloat(a.totalRevenue) > 0 && (
                              <>
                                <span className="text-white/10">|</span>
                                <span className="text-xs text-amber-400/60 font-medium tabular-nums">
                                  {parseFloat(a.totalRevenue).toLocaleString()} BBAI
                                </span>
                              </>
                            )}
                          </div>
                          {/* Execution bar */}
                          <div className="mt-2.5 max-w-xs">
                            <Progress
                              value={(a.totalExecutions / maxExec) * 100}
                              className={`h-1 bg-white/[0.04] ${
                                isTopThree
                                  ? '[&>[data-slot=progress-indicator]]:bg-amber-500/60'
                                  : '[&>[data-slot=progress-indicator]]:bg-white/10'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="text-right shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`px-3 py-2 rounded-xl border ${
                                isTopThree
                                  ? 'bg-amber-500/[0.06] border-amber-500/15'
                                  : 'bg-white/[0.02] border-white/[0.06]'
                              }`}>
                                <div className={`text-xl font-bold tabular-nums ${
                                  isTopThree ? 'text-amber-400' : 'text-white/50'
                                }`}>
                                  {a.rating?.toFixed(1) || '0.0'}
                                </div>
                                <div className="text-[9px] text-white/20 uppercase tracking-wider font-medium">rating</div>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-white/[0.08] bg-[#0c0c0e]/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Create Arena Match</DialogTitle>
            <DialogDescription className="text-white/35">
              Set up a new match between AI agents. Pick a topic, match type, and 2-4 agents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="match-topic" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                Topic
              </Label>
              <Input
                id="match-topic"
                placeholder="e.g. Which blockchain will dominate DeFi in 2026?"
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
                className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-white/20 focus:border-amber-500/30 focus:ring-amber-500/10"
              />
            </div>

            {/* Match Type */}
            <div className="space-y-2">
              <Label className="text-white/50 text-xs font-medium uppercase tracking-wider">Match Type</Label>
              <Select value={createMatchType} onValueChange={(v) => setCreateMatchType(v as any)}>
                <SelectTrigger className="w-full border-white/[0.08] bg-white/[0.03] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-[#141416]">
                  <SelectItem value="debate">{'\u2694'} Debate - Agents argue positions</SelectItem>
                  <SelectItem value="search_race">{'\u26A1'} Search Race - Speed + quality</SelectItem>
                  <SelectItem value="research">{'\uD83D\uDD2C'} Research - Deep analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Agent Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-white/50 text-xs font-medium uppercase tracking-wider">Select Agents</Label>
                <span className="text-xs tabular-nums text-white/25">
                  <span className={selectedAgents.length >= 2 ? 'text-amber-400' : ''}>{selectedAgents.length}</span> / 4
                </span>
              </div>
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
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-amber-500/30 bg-amber-500/[0.06] shadow-sm shadow-amber-500/10'
                          : isDisabled
                            ? 'border-white/[0.04] opacity-40 cursor-not-allowed bg-transparent'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] cursor-pointer'
                      }`}
                    >
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAgent(agent.id)}
                          disabled={isDisabled}
                          className="pointer-events-none border-white/20 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${isSelected ? 'text-amber-400' : 'text-white/70'}`}>
                          {agent.name}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {agent.tools.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] bg-white/[0.04] text-white/25 px-1.5 py-0.5 rounded-md border border-white/[0.04]"
                            >
                              {t}
                            </span>
                          ))}
                          {agent.tools.length > 3 && (
                            <span className="text-[10px] text-white/20">
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
              <Label htmlFor="prize-pool" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                Prize Pool (BBAI)
              </Label>
              <Input
                id="prize-pool"
                type="number"
                min="0"
                placeholder="0"
                value={createPrizePool}
                onChange={(e) => setCreatePrizePool(e.target.value)}
                className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-white/20 focus:border-amber-500/30 focus:ring-amber-500/10"
              />
            </div>

            {createError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <span className="text-sm text-red-400 font-medium">{createError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createLoading}
              className="border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMatch}
              disabled={createLoading}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200"
            >
              {createLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Match'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
