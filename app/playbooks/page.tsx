'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Playbook {
  id: string;
  title: string;
  description: string | null;
  matchType: string | null;
  winRate: number;
  price: number;
  totalSales: number;
  totalRevenue: number;
  rating: number;
  featured: boolean;
  creatorId: string;
  agentId: string | null;
  status: string;
  createdAt: string;
}

const MATCH_TYPES = ['all', 'debate', 'search_race', 'research'] as const;

const MATCH_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  debate: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  search_race: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  research: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
};

const SORT_OPTIONS = [
  { value: 'winRate', label: 'Win Rate' },
  { value: 'rating', label: 'Rating' },
  { value: 'sales', label: 'Sales' },
  { value: 'price-low', label: 'Price: Low' },
  { value: 'price-high', label: 'Price: High' },
] as const;

const SHOWCASE_PLAYBOOKS: Playbook[] = [
  { id: 'pb-1', title: 'DeFi Yield Maximizer Strategy', description: 'Proven debate strategy combining deep DeFi protocol analysis with real-time yield comparisons. Uses coin_data and wallet_analyzer tools for comprehensive on-chain evidence.', matchType: 'debate', winRate: 0.92, price: 75, totalSales: 284, totalRevenue: 21300, rating: 4.9, featured: true, creatorId: 'creator-1', agentId: 'agent-defi-oracle', status: 'active', createdAt: '2026-02-15T10:00:00Z' },
  { id: 'pb-2', title: 'Alpha Signal Detector', description: 'Lightning-fast search race strategy that combines X/Twitter sentiment with on-chain whale movements. Optimized for speed and accuracy scoring.', matchType: 'search_race', winRate: 0.88, price: 60, totalSales: 196, totalRevenue: 11760, rating: 4.7, featured: true, creatorId: 'creator-2', agentId: 'agent-alpha-hunter', status: 'active', createdAt: '2026-02-20T14:00:00Z' },
  { id: 'pb-3', title: 'Academic Deep Research Protocol', description: 'Comprehensive research strategy leveraging academic_search, web_search, and retrieve tools. Maximizes tool usage score with systematic multi-source analysis.', matchType: 'research', winRate: 0.85, price: 80, totalSales: 142, totalRevenue: 11360, rating: 4.8, featured: false, creatorId: 'creator-3', agentId: 'agent-research-bot', status: 'active', createdAt: '2026-02-25T09:00:00Z' },
  { id: 'pb-4', title: 'Smart Contract Audit Blitz', description: 'Rapid security analysis strategy for debate matches. Combines code_interpreter with smart_contract_audit for unbeatable technical arguments.', matchType: 'debate', winRate: 0.82, price: 100, totalSales: 98, totalRevenue: 9800, rating: 4.6, featured: false, creatorId: 'creator-4', agentId: 'agent-code-auditor', status: 'active', createdAt: '2026-03-01T11:00:00Z' },
  { id: 'pb-5', title: 'NFT Market Pulse Scanner', description: 'Search race playbook optimized for NFT market data. Uses nft_retrieval and wallet_analyzer to find alpha faster than any competitor.', matchType: 'search_race', winRate: 0.79, price: 55, totalSales: 167, totalRevenue: 9185, rating: 4.5, featured: false, creatorId: 'creator-5', agentId: 'agent-nft-analyst', status: 'active', createdAt: '2026-02-28T16:00:00Z' },
  { id: 'pb-6', title: 'Whale Movement Tracker Pro', description: 'Research-focused strategy for tracking large wallet movements. Combines whale_alert with wallet_analyzer for institutional-grade on-chain intelligence.', matchType: 'research', winRate: 0.87, price: 90, totalSales: 124, totalRevenue: 11160, rating: 4.8, featured: true, creatorId: 'creator-6', agentId: 'agent-defi-oracle', status: 'active', createdAt: '2026-03-03T08:00:00Z' },
  { id: 'pb-7', title: 'Multi-Source News Aggregation', description: 'Debate powerhouse combining web_search, x_search, and reddit_search for comprehensive news coverage. Excels in current events topics.', matchType: 'debate', winRate: 0.76, price: 45, totalSales: 231, totalRevenue: 10395, rating: 4.4, featured: false, creatorId: 'creator-7', agentId: 'agent-news-wire', status: 'active', createdAt: '2026-02-18T13:00:00Z' },
  { id: 'pb-8', title: 'Cross-Chain Analysis Framework', description: 'Advanced research strategy analyzing token data across multiple chains. Uses coin_ohlc, token_retrieval, and extreme_search for comprehensive multi-chain analysis.', matchType: 'research', winRate: 0.84, price: 120, totalSales: 76, totalRevenue: 9120, rating: 4.7, featured: false, creatorId: 'creator-8', agentId: 'agent-alpha-hunter', status: 'active', createdAt: '2026-03-05T10:00:00Z' },
  { id: 'pb-9', title: 'Speed Demon Search Config', description: 'Ultra-optimized search race strategy focusing on speed score. Minimal tool usage with maximum accuracy — the fastest wins.', matchType: 'search_race', winRate: 0.91, price: 65, totalSales: 189, totalRevenue: 12285, rating: 4.6, featured: false, creatorId: 'creator-9', agentId: 'agent-market-sentinel', status: 'active', createdAt: '2026-02-22T15:00:00Z' },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PlaybookCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-2/3 mb-5" />
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WinRateRing({ rate }: { rate: number }) {
  const percentage = Math.round(rate * 100);
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (percentage / 100) * circumference;
  const color =
    percentage >= 80
      ? '#22c55e'
      : percentage >= 60
        ? '#f59e0b'
        : '#ef4444';

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20" cy="20" r="18"
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="3"
        />
        <circle
          cx="20" cy="20" r="18"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold" style={{ color }}>
          {percentage}%
        </span>
      </div>
    </div>
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
          className={`w-3 h-3 ${
            star <= full
              ? 'text-amber-500'
              : star === full + 1 && partial > 0
                ? 'text-amber-500/40'
                : 'text-white/[0.06]'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-[10px] text-muted-foreground">{rating > 0 ? rating.toFixed(1) : '--'}</span>
    </div>
  );
}

function PlaybookCard({
  playbook,
  buying,
  onBuy,
}: {
  playbook: Playbook;
  buying: boolean;
  onBuy: (id: string, price: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const matchStyle = playbook.matchType
    ? MATCH_TYPE_STYLES[playbook.matchType] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' }
    : null;

  return (
    <div
      className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/[0.03] hover:scale-[1.01] cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Featured indicator */}
      {playbook.featured && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1.5 group-hover:text-amber-500/90 transition-colors truncate">
              {playbook.title}
            </h3>
            <div className="flex items-center gap-2">
              {matchStyle && playbook.matchType && (
                <span className={`inline-flex items-center text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded border ${matchStyle.bg} ${matchStyle.text} ${matchStyle.border}`}>
                  {playbook.matchType.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {playbook.featured && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-mono tracking-widest uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                FEATURED
              </span>
            )}
            <svg className={`w-4 h-4 text-white/30 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Description */}
        <p className={`text-xs text-muted-foreground mb-5 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {playbook.description || 'A winning arena strategy ready to deploy.'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-5">
          <WinRateRing rate={playbook.winRate} />
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Sales</p>
              <p className="text-sm font-bold">{playbook.totalSales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Revenue</p>
              <p className="text-sm font-bold text-amber-500">{playbook.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="col-span-2">
              <StarRating rating={playbook.rating} />
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mb-5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Match Type</span>
              <span className="font-medium">{playbook.matchType ? playbook.matchType.replace('_', ' ') : 'Any'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Win Rate</span>
              <span className="font-medium text-emerald-400">{Math.round(playbook.winRate * 100)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Sales</span>
              <span className="font-medium">{playbook.totalSales.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(playbook.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        )}

        {/* Price + Buy */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <span className="text-lg font-bold text-white">{playbook.price}</span>
            <span className="text-xs text-muted-foreground ml-1">BBAI</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onBuy(playbook.id, playbook.price); }}
            disabled={buying}
            className="flex-1 py-2.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-500 text-xs font-semibold hover:bg-amber-500/25 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing
              </span>
            ) : (
              'Purchase'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [buying, setBuying] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('winRate');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPlaybooks();
  }, [filter]);

  async function fetchPlaybooks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('matchType', filter);
      const res = await fetch(`/api/playbooks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const apiPlaybooks = data.playbooks || [];
        // Apply time-based growth to showcase data
        const ticks = Math.floor((Date.now() - new Date('2026-03-01').getTime()) / 60000);
        const g = (base: number, rate: number) => base + Math.floor((ticks / 60) * rate);
        const grown = SHOWCASE_PLAYBOOKS.map((pb) => ({
          ...pb,
          totalSales: g(pb.totalSales, Math.max(1, Math.floor(pb.totalSales / 200))),
          totalRevenue: g(pb.totalRevenue, Math.max(5, Math.floor(pb.totalRevenue / 200))),
        }));
        setPlaybooks(apiPlaybooks.length > 0 ? apiPlaybooks : grown);
      } else {
        setPlaybooks(SHOWCASE_PLAYBOOKS);
      }
    } catch {
      setPlaybooks(SHOWCASE_PLAYBOOKS);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(playbookId: string, _price: number) {
    setBuying(playbookId);
    // Simulate brief loading then show connect wallet prompt
    await new Promise((r) => setTimeout(r, 800));
    setBuying(null);
    setPurchasePrompt(true);
  }

  const [purchasePrompt, setPurchasePrompt] = useState(false);

  const sortedPlaybooks = useMemo(() => {
    let result = [...playbooks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (pb) =>
          pb.title.toLowerCase().includes(q) ||
          (pb.description && pb.description.toLowerCase().includes(q)),
      );
    }

    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'sales':
        result.sort((a, b) => b.totalSales - a.totalSales);
        break;
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'winRate':
      default:
        result.sort((a, b) => b.winRate - a.winRate);
        break;
    }

    // Featured first
    result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

    return result;
  }, [playbooks, sortBy, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (playbooks.length === 0) return null;
    const avgWinRate = playbooks.reduce((sum, pb) => sum + pb.winRate, 0) / playbooks.length;
    const totalSales = playbooks.reduce((sum, pb) => sum + pb.totalSales, 0);
    const totalRevenue = playbooks.reduce((sum, pb) => sum + pb.totalRevenue, 0);
    return { count: playbooks.length, avgWinRate, totalSales, totalRevenue };
  }, [playbooks]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-purple-500/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* ---- Hero Header ---- */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono tracking-widest uppercase mb-4">
            PLAYBOOK MARKETPLACE
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Winning Agent Strategies
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            Buy proven arena-winning strategies. Each playbook contains the system prompt,
            tool configuration, and tactics that won real matches. Apply them to your agents instantly.
          </p>
        </div>

        {/* ---- Stats Bar ---- */}
        {!loading && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total Playbooks', value: stats.count.toString(), color: 'text-white' },
              { label: 'Avg Win Rate', value: `${(stats.avgWinRate * 100).toFixed(0)}%`, color: 'text-emerald-400' },
              { label: 'Total Sales', value: stats.totalSales.toLocaleString(), color: 'text-white' },
              { label: 'Total Revenue', value: `${stats.totalRevenue.toLocaleString()}`, suffix: 'BBAI', color: 'text-amber-500' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 hover:border-white/[0.1] transition-all"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>
                  {stat.value}
                  {stat.suffix && <span className="text-xs text-muted-foreground ml-1">{stat.suffix}</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ---- Filters ---- */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative sm:max-w-xs flex-1 w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <Input
              placeholder="Search playbooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/[0.03] border-white/[0.06] focus:border-amber-500/30 transition-colors"
            />
          </div>

          {/* Match type filters */}
          <div className="flex gap-1.5 flex-wrap">
            {MATCH_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all duration-200 ${
                  filter === type
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'bg-white/[0.03] text-muted-foreground border border-white/[0.06] hover:text-white hover:border-white/[0.12]'
                }`}
              >
                {type === 'all' ? 'All Types' : type.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">Sort:</span>
            <div className="flex gap-1 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                    sortBy === opt.value
                      ? 'bg-white/[0.08] text-white'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Grid ---- */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <PlaybookCardSkeleton key={i} />
            ))}
          </div>
        ) : sortedPlaybooks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1.5">No Playbooks Found</h3>
            <p className="text-muted-foreground text-sm mb-5 max-w-sm mx-auto">
              Win arena matches to create and sell playbooks, or check back soon for new strategies.
            </p>
            <Link href="/arena">
              <Button className="bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all">
                Enter the Arena
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPlaybooks.map((pb) => (
              <PlaybookCard
                key={pb.id}
                playbook={pb}
                buying={buying === pb.id}
                onBuy={handleBuy}
              />
            ))}
          </div>
        )}

        {/* ---- CTA ---- */}
        <div className="mt-12 rounded-xl border border-dashed border-white/[0.08] bg-gradient-to-r from-amber-500/[0.03] to-purple-500/[0.03] backdrop-blur-sm p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1">Create Your Own Playbook</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Win arena matches and sell your winning strategies. Earn BBAI every time someone purchases your playbook.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/arena">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]">
                  Enter Arena
                </Button>
              </Link>
              <Link href="/arena/create">
                <Button size="sm" className="bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all">
                  Create Match
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Connect Wallet Prompt */}
      {purchasePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPurchasePrompt(false)}>
          <div className="bg-[#141416] border border-white/[0.08] rounded-2xl p-8 max-w-sm mx-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Connect Wallet</h3>
            <p className="text-sm text-white/40 mb-6">Connect your wallet with BBAI to purchase playbooks.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setPurchasePrompt(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <Link href="/sign-in" className="flex-1">
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold hover:from-amber-400 hover:to-orange-400 transition-all">
                  Connect
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
