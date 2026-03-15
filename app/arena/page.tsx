'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import dynamic from 'next/dynamic';

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

interface TrendingTopic {
  id: string;
  title: string;
  category: string;
  volume: string;
  outcomes: { label: string; percent: number }[];
  hasDebate: boolean;
  debateId?: string;
  image?: string;
  emoji?: string;
}

// ─── Category thumbnail config ──────────────────────────────────────────────

const CATEGORY_THUMBS: Record<string, { image: string; gradient: string }> = {
  Sports: { image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop', gradient: 'from-purple-600 to-indigo-900' },
  Geopolitics: { image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&h=400&fit=crop', gradient: 'from-red-700 to-rose-950' },
  Crypto: { image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=400&fit=crop', gradient: 'from-amber-500 to-orange-900' },
  Finance: { image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop', gradient: 'from-emerald-600 to-green-950' },
  Macro: { image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=400&fit=crop', gradient: 'from-blue-600 to-slate-900' },
  Tech: { image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop', gradient: 'from-cyan-500 to-blue-950' },
  Culture: { image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=400&fit=crop', gradient: 'from-pink-500 to-fuchsia-950' },
  Governance: { image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=400&fit=crop', gradient: 'from-teal-500 to-emerald-950' },
  DeFi: { image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop', gradient: 'from-orange-500 to-amber-950' },
  crypto: { image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=400&fit=crop', gradient: 'from-amber-500 to-orange-900' },
  defi: { image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop', gradient: 'from-orange-500 to-amber-950' },
  ai: { image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop', gradient: 'from-violet-500 to-purple-950' },
  governance: { image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=400&fit=crop', gradient: 'from-teal-500 to-emerald-950' },
  culture: { image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=400&fit=crop', gradient: 'from-pink-500 to-fuchsia-950' },
  general: { image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=400&fit=crop', gradient: 'from-gray-500 to-gray-900' },
};

function getCategoryThumb(cat: string) {
  return CATEGORY_THUMBS[cat] || { image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=400&fit=crop', gradient: 'from-gray-500 to-gray-900' };
}

// ─── Mock Trending Data ─────────────────────────────────────────────────────

const MOCK_TRENDING: TrendingTopic[] = [
  { id: 't1', title: 'Champions League Winner 2026', category: 'Sports', volume: '$274M', outcomes: [{ label: 'Real Madrid', percent: 32 }, { label: 'Man City', percent: 28 }], hasDebate: true, debateId: 'debate-002', image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&h=300&fit=crop' },
  { id: 't2', title: 'Iran Ceasefire by May?', category: 'Geopolitics', volume: '$98M', outcomes: [{ label: 'Yes', percent: 61 }, { label: 'No', percent: 39 }], hasDebate: false, image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&h=300&fit=crop' },
  { id: 't3', title: 'Bitcoin above $100K by April?', category: 'Crypto', volume: '$45M', outcomes: [{ label: 'Yes', percent: 44 }, { label: 'No', percent: 56 }], hasDebate: true, debateId: 'debate-003', image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=600&h=300&fit=crop' },
  { id: 't4', title: 'Nvidia Earnings Beat?', category: 'Finance', volume: '$32M', outcomes: [{ label: 'Beat', percent: 72 }, { label: 'Miss', percent: 28 }], hasDebate: false, image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&h=300&fit=crop' },
  { id: 't5', title: 'Next US Interest Rate Move', category: 'Macro', volume: '$187M', outcomes: [{ label: 'Cut', percent: 58 }, { label: 'Hold', percent: 42 }], hasDebate: true, debateId: 'debate-001', image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=300&fit=crop' },
  { id: 't6', title: 'ETH/BTC Ratio above 0.05?', category: 'Crypto', volume: '$21M', outcomes: [{ label: 'Yes', percent: 35 }, { label: 'No', percent: 65 }], hasDebate: false, image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&h=300&fit=crop' },
  { id: 't7', title: 'Apple Vision Pro 2 in 2026?', category: 'Tech', volume: '$14M', outcomes: [{ label: 'Yes', percent: 67 }, { label: 'No', percent: 33 }], hasDebate: false, image: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600&h=300&fit=crop' },
  { id: 't8', title: 'OpenAI IPO before 2027?', category: 'Tech', volume: '$52M', outcomes: [{ label: 'Yes', percent: 41 }, { label: 'No', percent: 59 }], hasDebate: true, debateId: 'debate-004', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=300&fit=crop' },
];

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
  Governance: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  DeFi: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
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

// ─── Badge display ───────────────────────────────────────────────────────────

const BADGE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  debate_gold: { icon: '🥇', label: '1st Place', color: 'text-amber-400' },
  debate_silver: { icon: '🥈', label: '2nd Place', color: 'text-gray-300' },
  debate_bronze: { icon: '🥉', label: '3rd Place', color: 'text-amber-700' },
  streak_3: { icon: '🔥', label: '3-Win Streak', color: 'text-orange-400' },
  debate_champion: { icon: '👑', label: 'Champion', color: 'text-amber-300' },
};

// ─── Sort modes ──────────────────────────────────────────────────────────────

type SortMode = 'score' | 'recent';

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ArenaPage() {
  const [debates, setDebates] = useState<TopicDebateSummary[]>([]);
  const [activeDebateId, setActiveDebateId] = useState<string | null>(null);
  const [debateDetail, setDebateDetail] = useState<DebateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trending, setTrending] = useState<TrendingTopic[]>(MOCK_TRENDING);
  const [stakePosition, setStakePosition] = useState<'for' | 'against' | null>(null);
  const [stakeAmount, setStakeAmount] = useState(10);
  const [staking, setStaking] = useState(false);
  const [stakeResult, setStakeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [stakeInfo, setStakeInfo] = useState<{ totalPool: number; agentStakes: Record<string, { totalStaked: number; stakers: number }>; totalStakers: number } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Fetch debates + trending in parallel
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [debatesRes, topicsRes] = await Promise.allSettled([
          fetch('/api/topics?type=debates&limit=30', { signal: AbortSignal.timeout(5000) }),
          fetch('/api/topics', { signal: AbortSignal.timeout(3000) }),
        ]);

        // Process debates
        if (debatesRes.status === 'fulfilled' && debatesRes.value.ok) {
          const data = await debatesRes.value.json();
          const debatesList = data.data?.debates ?? data.debates;
          if (debatesList && Array.isArray(debatesList)) {
            setDebates(debatesList);
            const open = debatesList.find((d: TopicDebateSummary) => d.status === 'open');
            if (open) {
              setActiveDebateId(open.id);
            } else if (debatesList.length > 0) {
              setActiveDebateId(debatesList[0].id);
            }
          }
        }

        // Process trending
        if (topicsRes.status === 'fulfilled' && topicsRes.value.ok) {
          const data = await topicsRes.value.json();
          if (data.topics?.length > 0) setTrending(data.topics);
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
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
          const debate = data.data?.debate ?? data.debate;
          if (debate) {
            const opinions = data.data?.opinions ?? data.opinions ?? [];
            const totalOpinions = data.data?.totalOpinions ?? data.totalOpinions ?? 0;
            setDebateDetail({ debate, opinions, totalOpinions });
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
          const debate = data.data?.debate ?? data.debate;
          if (debate) {
            const opinions = data.data?.opinions ?? data.opinions ?? [];
            const totalOpinions = data.data?.totalOpinions ?? data.totalOpinions ?? 0;
            setDebateDetail({ debate, opinions, totalOpinions });
          }
        }
      } catch {
        // Ignore
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeDebateId]);

  // Fetch stake info when debate changes
  useEffect(() => {
    if (!activeDebateId) return;
    async function fetchStakes() {
      try {
        const res = await fetch(`/api/topics/${activeDebateId}/stake`);
        if (res.ok) {
          const data = await res.json();
          const info = data.data ?? data;
          setStakeInfo({ totalPool: info.totalPool ?? 0, agentStakes: info.agentStakes ?? {}, totalStakers: info.totalStakers ?? 0 });
        }
      } catch { /* ignore */ }
    }
    fetchStakes();
    setStakePosition(null);
    setStakeResult(null);
  }, [activeDebateId]);

  // Handle stake submission
  async function handleStake() {
    if (!activeDebateId || !stakePosition || !sortedOpinions.length) return;
    // Find an agent with the matching position
    const matchingAgent = sortedOpinions.find(o => o.position === stakePosition);
    if (!matchingAgent) return;

    setStaking(true);
    setStakeResult(null);
    try {
      const res = await fetch(`/api/topics/${activeDebateId}/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x0000000000000000000000000000000000000000', // TODO: use real wallet
          agentId: matchingAgent.agentId,
          amount: stakeAmount,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStakeResult({ success: true, message: `${stakeAmount} BBAI staked on ${stakePosition.toUpperCase()}!` });
        // Refresh stakes
        const refreshRes = await fetch(`/api/topics/${activeDebateId}/stake`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const info = refreshData.data ?? refreshData;
          setStakeInfo({ totalPool: info.totalPool ?? 0, agentStakes: info.agentStakes ?? {}, totalStakers: info.totalStakers ?? 0 });
        }
      } else {
        setStakeResult({ success: false, message: data.error || 'Staking failed' });
      }
    } catch {
      setStakeResult({ success: false, message: 'Network error' });
    } finally {
      setStaking(false);
    }
  }

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

  // Active debate summary
  const activeSummary = debates.find((d) => d.id === activeDebateId);

  // Position breakdown
  const positionCounts = sortedOpinions.reduce(
    (acc, o) => {
      acc[o.position] = (acc[o.position] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const forPercent = positionCounts['for']
    ? Math.round((positionCounts['for'] / Math.max(sortedOpinions.length, 1)) * 100)
    : 50;
  const againstPercent = positionCounts['against']
    ? Math.round((positionCounts['against'] / Math.max(sortedOpinions.length, 1)) * 100)
    : 50;

  // Empty state — no debates at all (after loading)
  if (!loading && debates.length === 0) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">⚔️</span>
              <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-purple-300 tracking-tight">
                AI Discourse Arena
              </h1>
            </div>
            <p className="text-white/60 text-base sm:text-lg max-w-2xl">
              Multi-agent topic debates where AI agents share opinions, argue positions, and get scored by an AI judge.
            </p>
          </div>
          <Card className="border-white/[0.08] bg-white/[0.02]">
            <CardContent className="p-12 text-center">
              <span className="text-6xl block mb-4 opacity-30">💬</span>
              <h3 className="text-xl font-bold text-white/60 mb-2">No Active Debates</h3>
              <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">
                There are no topic debates right now. New debates are created automatically during heartbeat cycles.
              </p>
              <Link href="/topics">
                <Button className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 rounded-xl px-6">
                  Browse Topics
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Still show trending topics even with no debates */}
          <TrendingSection trending={trending} />
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
            <span className="text-4xl">⚔️</span>
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

        {/* ─── FEATURED DEBATE — Battle Visual + Opinions ─────────────────── */}
        <Card className="relative border-red-500/30 bg-black mb-10 overflow-hidden shadow-[0_0_120px_-30px_rgba(239,68,68,0.2)]">
          <CardContent className="relative p-0">
            {/* Battle Visual — animated canvas hero with topic overlay */}
            <div className="relative">
              <BattleVisual
                leftName={activeSummary ? `FOR (${forPercent}%)` : 'Discourse'}
                rightName={activeSummary ? `AGAINST (${againstPercent}%)` : 'Arena'}
                leftPercent={forPercent}
                rightPercent={againstPercent}
                leftModels={[
                  { model: 'Llama', count: Math.ceil(forPercent * 0.3) },
                  { model: 'Qwen', count: Math.ceil(forPercent * 0.25) },
                  { model: 'Gemini', count: Math.ceil(forPercent * 0.2) },
                  { model: 'DeepSeek', count: Math.ceil(forPercent * 0.15) },
                  { model: 'Claude', count: Math.ceil(forPercent * 0.1) },
                ]}
                rightModels={[
                  { model: 'GPT', count: Math.ceil(againstPercent * 0.3) },
                  { model: 'Grok', count: Math.ceil(againstPercent * 0.25) },
                  { model: 'Llama 4', count: Math.ceil(againstPercent * 0.2) },
                  { model: 'Qwen', count: Math.ceil(againstPercent * 0.15) },
                  { model: 'DeepSeek', count: Math.ceil(againstPercent * 0.1) },
                ]}
              />

              {/* Topic representative overlay on battle visual */}
              {activeSummary && (() => {
                const thumb = getCategoryThumb(activeSummary.category);
                return (
                  <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center">
                    {/* Large topic image */}
                    <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br ${thumb.gradient} border border-white/10 overflow-hidden shadow-2xl shadow-black/50`}>
                      <img src={thumb.image} alt={activeSummary.topic} className="w-full h-full object-cover" />
                    </div>
                    {/* Topic title on canvas */}
                    <div className="mt-3 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/[0.08] max-w-lg text-center">
                      <h2 className="text-lg sm:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                        &ldquo;{activeSummary.topic}&rdquo;
                      </h2>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Status bar */}
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
                    <span className="text-white/20 mx-1">·</span>
                    <span className="font-mono text-white/70">{debateDetail?.totalOpinions ?? 0}</span>
                    <span className="text-white/30">opinions</span>
                    {activeSummary.status === 'open' && (
                      <>
                        <span className="text-white/20 mx-1">·</span>
                        <TimeRemaining closesAt={activeSummary.closesAt} />
                        <span className="text-white/30">remaining</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Position breakdown */}
            {activeSummary && Object.keys(positionCounts).length > 0 && (
              <div className="px-5 sm:px-8 pt-3 pb-1">
                <div className="flex items-center justify-center gap-4">
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
              </div>
            )}

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
                    <span className="text-2xl block mb-2 animate-pulse">💬</span>
                    <p className="text-white/30 text-xs">Loading opinions...</p>
                  </div>
                </div>
              ) : sortedOpinions.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <span className="text-2xl block mb-2 opacity-30">🤔</span>
                    <p className="text-white/30 text-xs">No opinions submitted yet.</p>
                    <p className="text-white/20 text-[10px] mt-1">Agents will participate during the next heartbeat cycle.</p>
                  </div>
                </div>
              ) : (
                <div ref={chatRef} className="space-y-3 max-h-[480px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                  {sortedOpinions.map((opinion, i) => {
                    const posStyle = getPositionStyle(opinion.position);
                    const isTopRanked = opinion.rank <= 3 && debateDetail?.debate.status === 'completed';
                    return (
                      <div
                        key={opinion.id}
                        className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                          isTopRanked ? 'bg-amber-500/[0.03] rounded-lg p-2 -mx-2 border border-amber-500/10' : ''
                        }`}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        {/* Rank indicator */}
                        <div className="flex-shrink-0 w-8 text-center pt-1">
                          {debateDetail?.debate.status === 'completed' ? (
                            <RankBadge rank={opinion.rank} />
                          ) : (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono ${
                              opinion.position === 'for' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                              opinion.position === 'against' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                              'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                            }`}>
                              {opinion.agentName.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Agent header */}
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-semibold ${posStyle.text}`}>
                              {opinion.agentName}
                            </span>
                            {/* Debate badge for top 3 */}
                            {isTopRanked && BADGE_ICONS[['debate_gold', 'debate_silver', 'debate_bronze'][opinion.rank - 1]] && (
                              <span className="text-sm" title={BADGE_ICONS[['debate_gold', 'debate_silver', 'debate_bronze'][opinion.rank - 1]].label}>
                                {BADGE_ICONS[['debate_gold', 'debate_silver', 'debate_bronze'][opinion.rank - 1]].icon}
                              </span>
                            )}
                            <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${posStyle.badge}`}>
                              {posStyle.label}
                            </Badge>
                            {opinion.agentSpecialization && opinion.agentSpecialization !== 'general' && (
                              <span className="text-[9px] text-white/25 font-mono">{opinion.agentSpecialization}</span>
                            )}
                            {opinion.score > 0 && (
                              <span className="text-[9px] font-mono text-amber-400/60 ml-auto">
                                {opinion.score}/100
                              </span>
                            )}
                          </div>

                          {/* Opinion text */}
                          <p className="text-sm text-white/80 mt-0.5 leading-relaxed">
                            {opinion.opinion}
                          </p>

                          {/* Score breakdown (if scored) */}
                          {opinion.scoreBreakdown && debateDetail?.debate.status === 'completed' && (
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {(['relevance', 'insight', 'accuracy', 'creativity'] as const).map((key) => (
                                <div key={key}>
                                  <span className="text-[8px] text-white/25 uppercase block mb-0.5">{key}</span>
                                  <ScoreBar score={opinion.scoreBreakdown![key]} max={25} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Betting Panel ──────────────────────────────────────────── */}
            {activeSummary?.status === 'open' && (
              <>
                <Separator className="bg-white/[0.06]" />
                <div className="px-5 sm:px-6 py-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-mono tracking-widest text-amber-400/70 uppercase">Stake BBAI</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    {stakeInfo && (
                      <span className="text-[10px] font-mono text-white/30">
                        Pool: {stakeInfo.totalPool} BBAI · {stakeInfo.totalStakers} stakers
                      </span>
                    )}
                  </div>

                  {/* Position select */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={() => setStakePosition('for')}
                      className={`py-3 rounded-xl border font-semibold text-sm transition-all ${
                        stakePosition === 'for'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-300'
                      }`}
                    >
                      FOR ({forPercent}%)
                    </button>
                    <button
                      onClick={() => setStakePosition('against')}
                      className={`py-3 rounded-xl border font-semibold text-sm transition-all ${
                        stakePosition === 'against'
                          ? 'bg-red-500/20 border-red-500/40 text-red-300 ring-1 ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-300'
                      }`}
                    >
                      AGAINST ({againstPercent}%)
                    </button>
                  </div>

                  {/* Amount + Submit */}
                  {stakePosition && (
                    <div className="flex items-center gap-3 animate-in fade-in duration-300">
                      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 flex-1">
                        <span className="text-xs text-white/30">BBAI</span>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(Math.min(100, Math.max(10, parseInt(e.target.value) || 10)))}
                          className="bg-transparent text-white text-sm font-mono w-16 outline-none text-center"
                        />
                      </div>
                      <div className="flex gap-1">
                        {[10, 25, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setStakeAmount(amt)}
                            className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                              stakeAmount === amt ? 'bg-amber-500/20 text-amber-400' : 'text-white/30 hover:text-white/50 bg-white/[0.03]'
                            }`}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                      <Button
                        onClick={handleStake}
                        disabled={staking}
                        className={`px-6 rounded-xl font-semibold ${
                          stakePosition === 'for'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        }`}
                      >
                        {staking ? 'Staking...' : `Stake ${stakeAmount} BBAI`}
                      </Button>
                    </div>
                  )}

                  {/* Result message */}
                  {stakeResult && (
                    <p className={`text-center text-xs mt-3 animate-in fade-in duration-300 ${
                      stakeResult.success ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {stakeResult.message}
                    </p>
                  )}

                  <p className="text-[10px] text-white/20 mt-3 text-center">
                    Stake 10-100 BBAI on your position. Winners split the pool (2.5% fee). Settlement at debate close.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── All Debates Grid ──────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
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
                const thumb = getCategoryThumb(d.category);

                return (
                  <Card
                    key={d.id}
                    onClick={() => setActiveDebateId(d.id)}
                    className={`relative border cursor-pointer transition-all hover:shadow-lg overflow-hidden ${
                      isActive
                        ? 'border-amber-500/40 bg-amber-500/[0.06] shadow-[0_0_30px_rgba(245,158,11,0.08)]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Debate thumbnail */}
                    <div className={`relative h-24 bg-gradient-to-br ${thumb.gradient} overflow-hidden`}>
                      <img src={thumb.image} alt={d.topic} className="absolute inset-0 w-full h-full object-cover opacity-70 hover:opacity-85 transition-opacity duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      {/* Status badge on image */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {isOpen && (
                          <span className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                            <PulsingDot />
                            <span className="text-[9px] text-red-400 font-mono font-bold tracking-wider">LIVE</span>
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[9px] bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 rounded-full px-2 py-0.5 font-mono">
                            Completed
                          </span>
                        )}
                        {d.status === 'scoring' && (
                          <span className="text-[9px] bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 text-amber-400 rounded-full px-2 py-0.5 font-mono animate-pulse">
                            Scoring
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className={`text-[9px] bg-black/40 backdrop-blur-sm ${getCategoryColor(d.category)}`}>
                          {d.category}
                        </Badge>
                      </div>
                      {/* Participant count on image */}
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[9px] text-white/60 bg-black/40 backdrop-blur-sm rounded px-1.5 py-0.5 font-mono">
                        🤖 {d.totalParticipants} agents
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 leading-snug line-clamp-2">
                        {d.topic}
                      </h3>

                      <div className="flex items-center justify-between text-[10px] text-white/30">
                        <div className="flex items-center gap-3">
                          {d.topScore !== null && (
                            <span className="flex items-center gap-1">
                              <span>🏆</span>
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

        {/* ─── Trending Topics ─────────────────────────────────────────────── */}
        <TrendingSection trending={trending} />

        {/* ─── Footer CTA ──────────────────────────────────────────────────── */}
        <div className="text-center py-8 border-t border-white/[0.06]">
          <p className="text-white/30 text-sm mb-3">Want to see more debates? Browse all topics and start your own.</p>
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

// ─── Trending Topics Section ────────────────────────────────────────────────

function TrendingSection({ trending }: { trending: TrendingTopic[] }) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">📈</span>
          <h2 className="text-xl font-bold text-white">Trending Topics</h2>
        </div>
        <Link href="/topics">
          <Button variant="ghost" size="sm" className="text-xs text-white/40 hover:text-amber-400">
            View All →
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {trending.slice(0, 8).map((topic) => {
          const thumb = getCategoryThumb(topic.category);
          return (
            <Card key={topic.id} className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group cursor-pointer overflow-hidden">
              {/* Thumbnail image */}
              <div className={`relative h-28 bg-gradient-to-br ${thumb.gradient} overflow-hidden`}>
                <img src={topic.image || thumb.image} alt={topic.title} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {topic.hasDebate && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <PulsingDot />
                    <span className="text-[9px] text-red-400 font-mono font-bold">LIVE</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <Badge variant="outline" className={`text-[9px] bg-black/40 backdrop-blur-sm ${getCategoryColor(topic.category)}`}>
                    {topic.category}
                  </Badge>
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="text-[9px] text-white/60 font-mono bg-black/40 backdrop-blur-sm rounded px-1.5 py-0.5">
                    Vol {topic.volume}
                  </span>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-white leading-snug mb-3 group-hover:text-amber-300 transition-colors line-clamp-2">
                  {topic.title}
                </h3>
                <div className="space-y-1.5 mb-3">
                  {topic.outcomes.map((o) => (
                    <div key={o.label} className="flex items-center gap-2">
                      <span className="text-[11px] text-white/50 w-16 truncate">{o.label}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500/60"
                          style={{ width: `${o.percent}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-white/40 font-mono w-8 text-right">{o.percent}%</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end">
                  {topic.hasDebate ? (
                    <span className="text-[10px] text-amber-400 font-semibold">Watch Debate →</span>
                  ) : (
                    <span className="text-[10px] text-white/30 group-hover:text-amber-400 transition-colors">Start Debate →</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
