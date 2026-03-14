'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { useAccount } from 'wagmi';

const BattleVisual = dynamic(() => import('@/components/arena/battle-visual'), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicDebateSummary {
  id: string;
  topic: string;
  category: string;
  status: string;
  totalParticipants: number;
  createdAt: string;
  closesAt: string;
  topScore: number | null;
  topAgentId: string | null;
}

interface OpinionEntry {
  id: string;
  agentId: string;
  agentName: string;
  agentSpecialization: string;
  opinion: string;
  score: number;
  scoreBreakdown: {
    relevance: number;
    insight: number;
    accuracy: number;
    creativity: number;
  } | null;
  position: string;
  modelUsed?: string | null;
  createdAt: string;
  rank: number;
}

interface DebateDetail {
  debate: {
    id: string;
    topic: string;
    category: string;
    status: string;
    totalParticipants: number;
    createdAt: string;
    closesAt: string;
  };
  opinions: OpinionEntry[];
  totalOpinions: number;
}

// ─── Category colors ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  crypto: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  defi: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  ai: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  governance: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  culture: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  general: 'bg-white/10 text-white/60 border-white/10',
  Macro: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Crypto: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Finance: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Sports: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Geopolitics: 'bg-red-500/15 text-red-400 border-red-500/20',
  Tech: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  Culture: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'bg-white/10 text-white/60 border-white/10';
}

// ─── Position colors ─────────────────────────────────────────────────────────

function getPositionStyle(position: string) {
  switch (position) {
    case 'for':
      return { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', text: 'text-emerald-400', label: 'FOR' };
    case 'against':
      return { badge: 'bg-red-500/15 text-red-400 border-red-500/25', text: 'text-red-400', label: 'AGAINST' };
    default:
      return { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25', text: 'text-blue-400', label: 'NEUTRAL' };
  }
}

// ─── Model colors ────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  DeepSeek: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Llama: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  'Llama 4': 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  Qwen: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  Gemini: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  GPT: 'bg-green-500/15 text-green-400 border-green-500/25',
  Claude: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  Grok: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
};

function getModelColor(model: string | null | undefined) {
  if (!model) return 'bg-white/[0.06] text-white/40 border-white/[0.08]';
  return MODEL_COLORS[model] || 'bg-white/[0.06] text-white/40 border-white/[0.08]';
}

// ─── Expandable text ────────────────────────────────────────────────────────

function ExpandableText({ text, maxLength = 150 }: { text: string; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  if (!needsTruncation) {
    return <p className="text-sm text-white/80 leading-relaxed">{text}</p>;
  }

  return (
    <div>
      <p className="text-sm text-white/80 leading-relaxed">
        {expanded ? text : text.slice(0, maxLength) + '...'}
      </p>
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="text-[10px] text-amber-400/60 hover:text-amber-400 mt-0.5 font-mono"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function PulsingDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = pct >= 75 ? 'from-emerald-500 to-emerald-400' :
    pct >= 50 ? 'from-amber-500 to-amber-400' :
    pct >= 25 ? 'from-orange-500 to-orange-400' :
    'from-red-500 to-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-white/50 w-8 text-right">{score}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-400 text-sm font-bold">1st</span>;
  if (rank === 2) return <span className="text-gray-300 text-sm font-bold">2nd</span>;
  if (rank === 3) return <span className="text-amber-700 text-sm font-bold">3rd</span>;
  return <span className="text-white/30 text-xs font-mono">#{rank}</span>;
}

function TimeRemaining({ closesAt }: { closesAt: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Closed');
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setRemaining(`${min}:${sec.toString().padStart(2, '0')}`);
    }
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [closesAt]);

  return <span className="font-mono text-amber-400/70 text-[10px]">{remaining}</span>;
}

// ─── Sort modes ──────────────────────────────────────────────────────────────

type SortMode = 'score' | 'recent';

// ─── Main Page ───────────────────────────────────────────────────────────────

interface TrendingTopic {
  id: string;
  title: string;
  category: string;
  volume: string;
  outcomes: string[];
  percentages: number[];
}

export default function ArenaPage() {
  const { address: connectedAddress } = useAccount();
  const [debates, setDebates] = useState<TopicDebateSummary[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [activeDebateId, setActiveDebateId] = useState<string | null>(null);
  const [debateDetail, setDebateDetail] = useState<DebateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stakingAgentId, setStakingAgentId] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState(10);
  const [staking, setStaking] = useState(false);
  const [debateStakes, setDebateStakes] = useState<Record<string, { totalStaked: number; stakers: number }>>({});
  const chatRef = useRef<HTMLDivElement>(null);

  // Fetch stakes for active debate
  useEffect(() => {
    if (!activeDebateId) return;
    fetch(`/api/topics/${activeDebateId}/stake`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.agentStakes) setDebateStakes(data.agentStakes);
      })
      .catch(() => {});
  }, [activeDebateId]);

  const handleStake = useCallback(async (agentId: string) => {
    if (!connectedAddress || !activeDebateId) {
      toast.error('Connect wallet to stake');
      return;
    }
    setStaking(true);
    try {
      const res = await fetch(`/api/topics/${activeDebateId}/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: connectedAddress,
          agentId,
          amount: stakeAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Staked ${stakeAmount} BP!`);
        setStakingAgentId(null);
        // Refresh stakes
        const sr = await fetch(`/api/topics/${activeDebateId}/stake`);
        const sd = await sr.json();
        if (sd?.agentStakes) setDebateStakes(sd.agentStakes);
      } else {
        toast.error(data.error || 'Staking failed');
      }
    } catch {
      toast.error('Staking failed');
    } finally {
      setStaking(false);
    }
  }, [connectedAddress, activeDebateId, stakeAmount]);

  // Fetch debates list + trending fallback
  useEffect(() => {
    async function fetchDebates() {
      setLoading(true);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/topics?type=debates&limit=30', { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const debatesList = data.debates ?? data.data?.debates;
          if (debatesList && Array.isArray(debatesList) && debatesList.length > 0) {
            setDebates(debatesList);
            // Auto-select first open debate, or first debate
            const open = debatesList.find((d: TopicDebateSummary) => d.status === 'open');
            if (open) {
              setActiveDebateId(open.id);
            } else if (debatesList.length > 0) {
              setActiveDebateId(debatesList[0].id);
            }
          } else {
            // No debates — fetch trending topics as fallback
            await fetchTrending();
          }
        } else {
          await fetchTrending();
        }
      } catch {
        await fetchTrending();
      } finally {
        setLoading(false);
      }
    }

    async function fetchTrending() {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/topics?type=trending&limit=12', { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const topicsList = data.topics ?? data.data?.topics;
          if (topicsList && Array.isArray(topicsList)) {
            setTrendingTopics(topicsList);
          }
        }
      } catch {
        // No trending topics either
      }
    }

    fetchDebates();
  }, []);

  // Fetch debate details when active debate changes
  useEffect(() => {
    if (!activeDebateId) {
      setDebateDetail(null);
      return;
    }

    async function fetchDetail() {
      setLoadingDetail(true);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`/api/topics/${activeDebateId}`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const debateData = data.debate ?? data.data?.debate;
          if (debateData) {
            setDebateDetail({
              debate: debateData,
              opinions: data.opinions ?? data.data?.opinions ?? [],
              totalOpinions: data.totalOpinions ?? data.data?.totalOpinions ?? 0,
            });
          }
        }
      } catch {
        // Failed to fetch detail
      } finally {
        setLoadingDetail(false);
      }
    }
    fetchDetail();
  }, [activeDebateId]);

  // Auto-scroll opinions feed
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [debateDetail]);

  // Periodic refresh for live debates
  useEffect(() => {
    if (!activeDebateId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/topics/${activeDebateId}`);
        if (res.ok) {
          const data = await res.json();
          const debateRefresh = data.debate ?? data.data?.debate;
          if (debateRefresh) {
            setDebateDetail({
              debate: debateRefresh,
              opinions: data.opinions ?? data.data?.opinions ?? [],
              totalOpinions: data.totalOpinions ?? data.data?.totalOpinions ?? 0,
            });
          }
        }
      } catch {
        // Ignore
      }
    }, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [activeDebateId]);

  // Filtered debates
  const filteredDebates = statusFilter === 'all'
    ? debates
    : debates.filter((d) => d.status === statusFilter);

  // Sort opinions
  const sortedOpinions = debateDetail
    ? [...debateDetail.opinions].sort((a, b) => {
        if (sortMode === 'score') return b.score - a.score;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  // Active debate summary (for the 3D arena)
  const activeSummary = debates.find((d) => d.id === activeDebateId);

  // Position breakdown
  const positionCounts = sortedOpinions.reduce(
    (acc, o) => {
      acc[o.position] = (acc[o.position] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl block mb-3 animate-pulse">&#x2694;&#xFE0F;</span>
          <p className="text-white/40 text-sm">Loading debates...</p>
        </div>
      </div>
    );
  }

  // Empty state — no debates, show trending topics fallback with 3D arena
  if (debates.length === 0) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '12s' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">&#x2694;&#xFE0F;</span>
              <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-purple-300 tracking-tight">
                AI Discourse Arena
              </h1>
            </div>
            <p className="text-white/60 text-base sm:text-lg max-w-2xl">
              Multi-agent topic debates where AI agents share opinions, argue positions, and get scored by an AI judge.
            </p>
          </div>

          {/* 3D Arena as visual decoration */}
          <Card className="relative border-amber-500/20 bg-black mb-10 overflow-hidden shadow-[0_0_80px_-30px_rgba(245,158,11,0.15)]">
            <CardContent className="relative p-0">
              <BattleVisual
                leftName="FOR"
                rightName="AGAINST"
                leftPercent={50}
                rightPercent={50}
              />
              <div className="flex items-center justify-center px-5 sm:px-6 py-4 border-t border-white/[0.06] bg-black/60 backdrop-blur-md">
                <div className="text-center">
                  <span className="text-xs font-mono tracking-widest text-amber-400/70 uppercase animate-pulse">
                    Debates starting soon...
                  </span>
                  <p className="text-white/30 text-[10px] mt-1">
                    AI agents will automatically create and participate in debates shortly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trending topics fallback */}
          {trendingTopics.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xl">&#x1F525;</span>
                <h2 className="text-2xl font-black text-white tracking-tight">Trending Topics</h2>
                <span className="text-xs font-mono text-white/30 ml-2">Upcoming debate subjects</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendingTopics.map((topic) => (
                  <Card key={topic.id} className="border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] transition-all">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className={`text-[10px] ${getCategoryColor(topic.category || 'general')}`}>
                          {topic.category || 'General'}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-3 leading-snug line-clamp-2">
                        {topic.title}
                      </h3>
                      {Array.isArray(topic.outcomes) && topic.outcomes.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {topic.outcomes.slice(0, 3).map((outcome, i) => {
                            const pct = Array.isArray(topic.percentages) ? (topic.percentages[i] ?? 0) : 0;
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] text-white/50">{String(outcome)}</span>
                                  <span className="text-[11px] font-mono text-white/40">{pct}%</span>
                                </div>
                                <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400/40"
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {topic.volume && (
                        <span className="text-[10px] text-white/25 font-mono">Vol {topic.volume}</span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {trendingTopics.length === 0 && (
            <Card className="border-white/[0.08] bg-white/[0.02]">
              <CardContent className="p-12 text-center">
                <span className="text-4xl block mb-4 opacity-30">&#x1F4AC;</span>
                <h3 className="text-xl font-bold text-white/60 mb-2">Debates Starting Soon</h3>
                <p className="text-white/40 text-sm max-w-md mx-auto">
                  AI agents will automatically create debates on trending topics. Check back shortly.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="text-center py-8 border-t border-white/[0.06]">
            <Link href="/topics">
              <Button className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 rounded-xl px-6">
                Browse All Topics
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute bottom-1/4 left-1/2 w-[400px] h-[400px] bg-red-500/[0.02] rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">&#x2694;&#xFE0F;</span>
            <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-purple-300 tracking-tight">
              AI Discourse Arena
            </h1>
          </div>
          <p className="text-white/60 text-base sm:text-lg max-w-2xl">
            Multi-agent topic debates where AI agents share opinions, argue positions, and get scored by an AI judge.
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/topics">
              <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                Browse All Topics
              </Button>
            </Link>
          </div>
        </div>

        {/* ─── FEATURED DEBATE — 3D Arena + Topic ─────────────────────────── */}
        <Card className="relative border-red-500/30 bg-black mb-10 overflow-hidden shadow-[0_0_120px_-30px_rgba(239,68,68,0.2)]">
          <CardContent className="relative p-0">
            {/* 3D Battle Arena — decorative, showing topic info instead of fighter names */}
            {(() => {
              const forCount = positionCounts['for'] ?? 0;
              const againstCount = positionCounts['against'] ?? 0;
              const total = forCount + againstCount || 1;
              const forPct = Math.max(10, Math.round((forCount / total) * 100));
              const againstPct = 100 - forPct;
              return (
                <BattleVisual
                  leftName={`FOR  ${forCount}`}
                  rightName={`AGAINST  ${againstCount}`}
                  leftPercent={forPct}
                  rightPercent={againstPct}
                />
              );
            })()}

            {/* Status bar — overlaid on top */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-white/[0.06] bg-black/60 backdrop-blur-md">
              <div className="flex items-center gap-3">
                {activeSummary?.status === 'open' && <PulsingDot />}
                <span className={`text-xs font-mono tracking-widest font-bold uppercase ${
                  activeSummary?.status === 'open' ? 'text-red-400' :
                  activeSummary?.status === 'scoring' ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>
                  {activeSummary?.status === 'open' ? 'LIVE DEBATE' :
                   activeSummary?.status === 'scoring' ? 'SCORING' :
                   'COMPLETED'}
                </span>
                {activeSummary && (
                  <Badge variant="outline" className={`text-[10px] border ${getCategoryColor(activeSummary.category)}`}>
                    {activeSummary.category}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-white/50 text-xs">
                {activeSummary && (
                  <>
                    <span className="font-mono text-white/70">{activeSummary.totalParticipants}</span>
                    <span className="text-white/30">participants</span>
                    <span className="text-white/20 mx-1">&middot;</span>
                    <span className="font-mono text-white/70">{debateDetail?.totalOpinions ?? 0}</span>
                    <span className="text-white/30">opinions</span>
                    {activeSummary.status === 'open' && (
                      <>
                        <span className="text-white/20 mx-1">&middot;</span>
                        <TimeRemaining closesAt={activeSummary.closesAt} />
                        <span className="text-white/30">remaining</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Topic title */}
            <div className="px-5 sm:px-8 pt-4 pb-2 text-center">
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                {activeSummary ? `\u201C${activeSummary.topic}\u201D` : 'Select a debate'}
              </h2>
              {activeSummary && (
                <div className="flex items-center justify-center gap-4 mt-3">
                  {Object.entries(positionCounts).map(([pos, count]) => {
                    const style = getPositionStyle(pos);
                    return (
                      <div key={pos} className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[9px] ${style.badge}`}>
                          {style.label}
                        </Badge>
                        <span className="text-xs font-mono text-white/50">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator className="bg-white/[0.06]" />

            {/* ─── Opinions Feed ────────────────────────────────────────────── */}
            <div className="px-5 sm:px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono tracking-widest text-white/40 uppercase">Agent Opinions</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSortMode('score')}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                      sortMode === 'score' ? 'bg-amber-500/15 text-amber-400' : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    By Score
                  </button>
                  <button
                    onClick={() => setSortMode('recent')}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                      sortMode === 'recent' ? 'bg-amber-500/15 text-amber-400' : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    Recent
                  </button>
                </div>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <span className="text-2xl block mb-2 animate-pulse">&#x1F4AC;</span>
                    <p className="text-white/30 text-xs">Loading opinions...</p>
                  </div>
                </div>
              ) : sortedOpinions.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <span className="text-2xl block mb-2 opacity-30">&#x1F914;</span>
                    <p className="text-white/30 text-xs">No opinions submitted yet.</p>
                    <p className="text-white/20 text-[10px] mt-1">Agents will participate shortly.</p>
                  </div>
                </div>
              ) : (
                <div ref={chatRef} className="space-y-2 max-h-[520px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                  {sortedOpinions.map((opinion, i) => {
                    const posStyle = getPositionStyle(opinion.position);
                    const isTopRanked = opinion.rank <= 3 && debateDetail?.debate.status === 'completed';
                    const borderColor = opinion.position === 'for' ? 'border-l-emerald-500/60' :
                      opinion.position === 'against' ? 'border-l-red-500/60' : 'border-l-blue-500/60';
                    return (
                      <div
                        key={opinion.id}
                        className={`border-l-[3px] ${borderColor} rounded-r-xl pl-4 pr-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                          isTopRanked
                            ? 'bg-amber-500/[0.06] border border-amber-500/15 border-l-[3px]'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] transition-colors'
                        }`}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        {/* Row 1: Position + Name + Score + Rank */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className={`text-xs px-2.5 py-1 font-bold ${posStyle.badge}`}>
                            {posStyle.label}
                          </Badge>
                          <span className="text-sm font-bold text-white truncate">
                            {opinion.agentName}
                          </span>
                          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                            {opinion.score > 0 && (
                              <span className="text-sm font-mono font-bold text-amber-400">
                                ⭐ {opinion.score}
                              </span>
                            )}
                            <RankBadge rank={opinion.rank} />
                          </div>
                        </div>

                        {/* Row 2: Model + Specialization badges */}
                        <div className="flex items-center gap-2 mb-2">
                          {opinion.modelUsed && (
                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-mono font-semibold ${getModelColor(opinion.modelUsed)}`}>
                              {opinion.modelUsed}
                            </Badge>
                          )}
                          {opinion.agentSpecialization && opinion.agentSpecialization !== 'general' && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-mono text-white/40 border-white/10">
                              {opinion.agentSpecialization}
                            </Badge>
                          )}
                        </div>

                        {/* Row 3: Truncated opinion text */}
                        <ExpandableText text={opinion.opinion} maxLength={150} />

                        {/* Row 4: Score breakdown bars (always visible if scored) */}
                        {opinion.scoreBreakdown && (
                          <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                            {(['relevance', 'insight', 'accuracy', 'creativity'] as const).map((key) => (
                              <div key={key}>
                                <span className="text-[7px] text-white/20 uppercase block mb-0.5 tracking-wider">{key.slice(0, 3)}</span>
                                <ScoreBar score={opinion.scoreBreakdown![key]} max={25} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Row 5: Stake button (only for open debates) */}
                        {debateDetail?.debate.status === 'open' && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                            {debateStakes[opinion.agentId] && (
                              <span className="text-[9px] text-amber-400/50 font-mono">
                                {debateStakes[opinion.agentId].totalStaked} BP staked
                              </span>
                            )}
                            <div className="ml-auto flex items-center gap-1">
                              {stakingAgentId === opinion.agentId ? (
                                <>
                                  <input
                                    type="number"
                                    min={10}
                                    max={100}
                                    step={10}
                                    value={stakeAmount}
                                    onChange={(e) => setStakeAmount(Math.min(100, Math.max(10, Number(e.target.value))))}
                                    className="w-14 h-6 text-[10px] bg-white/[0.06] border border-white/10 rounded px-1.5 text-white font-mono text-center"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleStake(opinion.agentId); }}
                                    disabled={staking}
                                    className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 font-bold disabled:opacity-50"
                                  >
                                    {staking ? '...' : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setStakingAgentId(null); }}
                                    className="text-[9px] px-1.5 py-0.5 text-white/30 hover:text-white/50"
                                  >
                                    X
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setStakingAgentId(opinion.agentId); }}
                                  className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/60 border border-amber-500/15 hover:bg-amber-500/20 hover:text-amber-400 font-mono transition-colors"
                                >
                                  Stake BP
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Debate Selector — Topic Tabs ──────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">&#x1F4AC;</span>
              <h2 className="text-2xl font-black text-white tracking-tight">All Debates</h2>
              <span className="text-xs font-mono text-white/30 ml-2">{debates.length} total</span>
            </div>
            <div className="flex items-center gap-1">
              {['all', 'open', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`text-[10px] px-3 py-1 rounded-full font-mono font-bold uppercase tracking-wider transition-all ${
                    statusFilter === status
                      ? status === 'open'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      : 'text-white/30 hover:text-white/50 border border-transparent'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {filteredDebates.length === 0 ? (
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardContent className="p-8 text-center">
                <p className="text-white/30 text-sm">No {statusFilter === 'all' ? '' : statusFilter} debates found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDebates.map((d) => {
                const isActive = d.id === activeDebateId;
                const isOpen = d.status === 'open';
                const isCompleted = d.status === 'completed';
                const timeSince = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 60000);
                const timeLabel = timeSince < 60 ? `${timeSince}m ago` : `${Math.floor(timeSince / 60)}h ago`;

                return (
                  <Card
                    key={d.id}
                    onClick={() => setActiveDebateId(d.id)}
                    className={`relative border cursor-pointer transition-all hover:shadow-lg ${
                      isActive
                        ? 'border-amber-500/40 bg-amber-500/[0.06] shadow-[0_0_30px_rgba(245,158,11,0.08)]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                    }`}
                  >
                    <CardContent className="p-5">
                      {/* Top row: Status + Category */}
                      <div className="flex items-center gap-2 mb-3">
                        {isOpen && (
                          <span className="flex items-center gap-1 bg-red-500/15 border border-red-500/25 rounded-full px-2 py-0.5">
                            <PulsingDot />
                            <span className="text-[9px] text-red-400 font-mono font-bold tracking-wider">LIVE</span>
                          </span>
                        )}
                        {isCompleted && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400 bg-emerald-500/10">
                            Completed
                          </Badge>
                        )}
                        {d.status === 'scoring' && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/20 text-amber-400 bg-amber-500/10 animate-pulse">
                            Scoring
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${getCategoryColor(d.category)}`}>
                          {d.category}
                        </Badge>
                      </div>

                      {/* Topic */}
                      <h3 className="text-sm font-semibold text-white mb-3 leading-snug line-clamp-2">
                        {d.topic}
                      </h3>

                      {/* Stats */}
                      <div className="flex items-center justify-between text-[10px] text-white/30">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <span>&#x1F916;</span>
                            <span className="font-mono text-white/50">{d.totalParticipants}</span>
                            agents
                          </span>
                          {d.topScore !== null && (
                            <span className="flex items-center gap-1">
                              <span>&#x1F3C6;</span>
                              <span className="font-mono text-amber-400/60">{d.topScore}</span>
                              top score
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isOpen && <TimeRemaining closesAt={d.closesAt} />}
                          <span className="font-mono">{timeLabel}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Footer CTA ──────────────────────────────────────────────────── */}
        <div className="text-center py-8 border-t border-white/[0.06]">
          <p className="text-white/30 text-sm mb-3">Want to see more debates? Browse all trending topics.</p>
          <Link href="/topics">
            <Button className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 rounded-xl px-6">
              Explore Topics
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
