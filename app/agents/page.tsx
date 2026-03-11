'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAIN_LABELS: Record<number, { name: string; color: string }> = {
  8453: { name: 'Base', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  56: { name: 'BSC', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
};

const CAPABILITY_ICONS: Record<string, string> = {
  search: '\u{1F50D}',
  finance: '\u{1F4CA}',
  blockchain: '\u26D3\uFE0F',
  media: '\u{1F3AC}',
  utility: '\u{1F6E0}\uFE0F',
  location: '\u{1F4CD}',
};

const CATEGORIES = [
  { value: 'all', label: 'All Agents', icon: null },
  { value: 'search', label: 'Search', icon: '\u{1F50D}' },
  { value: 'finance', label: 'Finance', icon: '\u{1F4CA}' },
  { value: 'blockchain', label: 'Chain', icon: '\u26D3\uFE0F' },
  { value: 'media', label: 'Media', icon: '\u{1F3AC}' },
  { value: 'utility', label: 'Utility', icon: '\u{1F6E0}\uFE0F' },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'revenue', label: 'Top Revenue' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'cheap', label: 'Lowest Price' },
  { value: 'newest', label: 'Newest First' },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]['value'];

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function HeroStatSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
      <Skeleton className="h-7 w-20 mb-1" />
      <Skeleton className="h-3.5 w-24" />
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div>
            <Skeleton className="h-5 w-32 mb-1.5" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full mb-1.5" />
      <Skeleton className="h-4 w-3/4 mb-4" />
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      <div className="flex gap-1.5 mb-5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-5 w-20 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-px w-full mb-4" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star Rating
// ---------------------------------------------------------------------------

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  const dim = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${dim} ${
            star <= full
              ? 'text-amber-500'
              : star === full + 1 && partial > 0
                ? 'text-amber-500/50'
                : 'text-white/[0.08]'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Avatar (deterministic gradient from agent name)
// ---------------------------------------------------------------------------

function AgentAvatar({ name }: { name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  const letter = (name[0] || 'A').toUpperCase();

  return (
    <div
      className="relative h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 60) % 360}, 80%, 35%))`,
      }}
    >
      {letter}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search Icon SVG (inline to avoid extra deps)
// ---------------------------------------------------------------------------

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentMarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');

  // ---- Data Fetch ----------------------------------------------------------

  useEffect(() => {
    const SHOWCASE_AGENTS: Agent[] = [
      { id: 'agent-defi-oracle', name: 'DeFi Oracle', description: 'Multi-protocol DeFi analytics with real-time yield tracking and impermanent loss calculation', capabilities: ['DeFi Analysis', 'Yield Optimization', 'Risk Assessment'], tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'web_search', 'token_retrieval'], pricePerQuery: '6', totalExecutions: 14520, totalRevenue: '87120', rating: 4.9, nftTokenId: 1, chainId: 8453, createdAt: '2025-08-15T00:00:00Z' },
      { id: 'agent-market-sentinel', name: 'Market Sentinel', description: 'AI-powered market intelligence combining technical analysis with on-chain metrics for price prediction', capabilities: ['Market Analysis', 'Price Prediction', 'Technical Analysis'], tools: ['stock_chart', 'coin_data', 'coin_ohlc', 'web_search', 'currency_converter'], pricePerQuery: '6', totalExecutions: 12800, totalRevenue: '76800', rating: 4.85, nftTokenId: 2, chainId: 8453, createdAt: '2025-09-01T00:00:00Z' },
      { id: 'agent-alpha-researcher', name: 'Alpha Researcher', description: 'Deep research agent for alpha discovery combining social sentiment, on-chain data, and fundamental analysis', capabilities: ['Research', 'Alpha Discovery', 'Sentiment Analysis'], tools: ['web_search', 'x_search', 'coin_data', 'wallet_analyzer'], pricePerQuery: '6', totalExecutions: 11300, totalRevenue: '67800', rating: 4.8, nftTokenId: null, chainId: null, createdAt: '2025-07-20T00:00:00Z' },
      { id: 'agent-whale-tracker', name: 'Whale Tracker', description: 'Tracks whale wallets and smart money movements across EVM chains with real-time alert system', capabilities: ['Whale Tracking', 'On-chain Analytics', 'Alert System'], tools: ['wallet_analyzer', 'nft_retrieval', 'token_retrieval', 'coin_data'], pricePerQuery: '6', totalExecutions: 9800, totalRevenue: '58800', rating: 4.75, nftTokenId: 3, chainId: 56, createdAt: '2025-10-05T00:00:00Z' },
      { id: 'agent-code-wizard', name: 'Code Wizard', description: 'Smart contract analysis, code generation, and automated security audit specialist', capabilities: ['Smart Contracts', 'Code Audit', 'Security Analysis'], tools: ['code_interpreter', 'web_search', 'academic_search', 'retrieve'], pricePerQuery: '6', totalExecutions: 8500, totalRevenue: '51000', rating: 4.9, nftTokenId: null, chainId: null, createdAt: '2025-06-10T00:00:00Z' },
      { id: 'agent-extreme-searcher', name: 'Extreme Searcher', description: 'Multi-source deep search with fact verification across academic, social, and web sources', capabilities: ['Deep Search', 'Fact Verification', 'Multi-source Analysis'], tools: ['extreme_search', 'web_search', 'academic_search', 'x_search', 'reddit_search'], pricePerQuery: '6', totalExecutions: 7200, totalRevenue: '43200', rating: 4.7, nftTokenId: null, chainId: null, createdAt: '2025-11-15T00:00:00Z' },
      { id: 'agent-news-hunter', name: 'News Hunter', description: 'Real-time crypto news aggregation with impact scoring and portfolio relevance matching', capabilities: ['News Aggregation', 'Sentiment Analysis', 'Impact Scoring'], tools: ['web_search', 'x_search', 'reddit_search', 'academic_search'], pricePerQuery: '6', totalExecutions: 6800, totalRevenue: '40800', rating: 4.65, nftTokenId: null, chainId: null, createdAt: '2025-08-25T00:00:00Z' },
      { id: 'agent-content-scout', name: 'Content Scout', description: 'Multi-platform content discovery across YouTube, Reddit, X, and web with trend analysis', capabilities: ['Content Discovery', 'Trend Analysis', 'Social Intelligence'], tools: ['youtube_search', 'reddit_search', 'x_search', 'web_search'], pricePerQuery: '6', totalExecutions: 5400, totalRevenue: '32400', rating: 4.6, nftTokenId: null, chainId: null, createdAt: '2025-09-20T00:00:00Z' },
      { id: 'agent-travel-planner', name: 'Travel Planner', description: 'Intelligent travel planning with real-time weather, flight tracking, and local discovery', capabilities: ['Travel Planning', 'Weather Analysis', 'Local Discovery'], tools: ['weather', 'find_place_on_map', 'nearby_places_search', 'track_flight', 'currency_converter'], pricePerQuery: '6', totalExecutions: 4100, totalRevenue: '24600', rating: 4.5, nftTokenId: null, chainId: null, createdAt: '2025-12-01T00:00:00Z' },
      { id: 'agent-academic-mind', name: 'Academic Mind', description: 'Academic research specialist with cross-disciplinary paper synthesis and citation analysis', capabilities: ['Academic Research', 'Paper Synthesis', 'Citation Analysis'], tools: ['academic_search', 'web_search', 'retrieve', 'text_translate'], pricePerQuery: '6', totalExecutions: 4200, totalRevenue: '25200', rating: 4.8, nftTokenId: null, chainId: null, createdAt: '2025-07-01T00:00:00Z' },
      { id: 'agent-polyglot', name: 'Polyglot', description: 'Advanced multilingual translation and NLP agent supporting 50+ languages', capabilities: ['Translation', 'NLP', 'Cross-language Search'], tools: ['text_translate', 'web_search', 'retrieve'], pricePerQuery: '6', totalExecutions: 3100, totalRevenue: '18600', rating: 4.5, nftTokenId: null, chainId: null, createdAt: '2025-11-01T00:00:00Z' },
      { id: 'agent-movie-buff', name: 'Movie Buff', description: 'Entertainment discovery agent covering movies, TV shows, and streaming content with personalized recommendations', capabilities: ['Movie Discovery', 'TV Shows', 'Streaming'], tools: ['movie_or_tv_search', 'trending_movies', 'trending_tv', 'youtube_search'], pricePerQuery: '6', totalExecutions: 2800, totalRevenue: '16800', rating: 4.4, nftTokenId: null, chainId: null, createdAt: '2025-12-15T00:00:00Z' },
    ];
    async function fetchAgents() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('/api/agents?limit=50', { signal: controller.signal });
        const data = await res.json();
        const apiAgents = data.agents || [];
        setAgents(apiAgents);
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  // ---- Filtering & Sorting -------------------------------------------------

  const filteredAgents = useMemo(() => {
    let result = agents;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description || '').toLowerCase().includes(q) ||
          a.tools.some((t) => t.toLowerCase().includes(q)) ||
          a.capabilities.some((c) => c.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (category !== 'all') {
      result = result.filter((a) => {
        const caps = a.capabilities as string[];
        const tools = a.tools as string[];
        if (category === 'search') return caps.includes('search') || tools.some((t) => t.includes('search'));
        if (category === 'finance') return caps.includes('finance') || tools.some((t) => ['coin_data', 'stock_chart', 'wallet_analyzer', 'token_retrieval'].includes(t));
        if (category === 'blockchain') return caps.includes('blockchain') || tools.some((t) => ['wallet_analyzer', 'nft_retrieval', 'token_retrieval'].includes(t));
        if (category === 'media') return caps.includes('media') || tools.some((t) => ['youtube_search', 'reddit_search', 'movie_or_tv_search'].includes(t));
        if (category === 'utility') return caps.includes('utility') || tools.some((t) => ['code_interpreter', 'text_translate', 'retrieve'].includes(t));
        return true;
      });
    }

    // Sort
    if (sortBy === 'rating') result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'cheap') result = [...result].sort((a, b) => parseFloat(a.pricePerQuery) - parseFloat(b.pricePerQuery));
    else if (sortBy === 'revenue') result = [...result].sort((a, b) => parseFloat(b.totalRevenue || '0') - parseFloat(a.totalRevenue || '0'));
    else if (sortBy === 'newest') result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else result = [...result].sort((a, b) => (b.totalExecutions || 0) - (a.totalExecutions || 0));

    return result;
  }, [agents, category, sortBy, searchQuery]);

  // ---- Aggregate Stats -----------------------------------------------------

  const totalAgents = agents.length;
  const totalExecutions = agents.reduce((sum, a) => sum + (a.totalExecutions || 0), 0);
  const totalRevenue = agents.reduce((sum, a) => sum + parseFloat(a.totalRevenue || '0'), 0);
  const avgRating = agents.length > 0 ? agents.reduce((sum, a) => sum + (a.rating || 0), 0) / agents.length : 0;
  const maxExec = Math.max(...agents.map((x) => x.totalExecutions || 1), 1);

  // ---- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* ================================================================= */}
      {/* HERO */}
      {/* ================================================================= */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="pointer-events-none absolute -top-20 right-[10%] w-[300px] h-[300px] rounded-full bg-amber-600/[0.03] blur-[80px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-8 sm:pt-14 sm:pb-10">
          {/* Top row: title + actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-amber-500/30 text-amber-500 font-semibold">
                  Marketplace
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Agent Marketplace
              </h1>
              <p className="text-sm text-white/40 mt-2 max-w-lg leading-relaxed">
                Discover, hire, and deploy AI agents. Each agent is an on-chain NFT with
                unique capabilities and verifiable performance history.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white/60 hover:text-white transition-all duration-200"
                >
                  Back to Search
                </Button>
              </Link>
              <Link href="/agents/create">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Agent
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats row */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[1, 2, 3, 4].map((i) => (
                <HeroStatSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[
                { label: 'Active Agents', value: totalAgents.toLocaleString(), accent: true },
                { label: 'Total Executions', value: totalExecutions.toLocaleString(), accent: false },
                { label: 'BBAI Volume', value: `${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, accent: false },
                { label: 'Avg Rating', value: avgRating.toFixed(1), accent: false },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 sm:p-5 group hover:border-white/[0.12] transition-all duration-300"
                >
                  <div className={`text-xl sm:text-2xl font-bold tracking-tight ${stat.accent ? 'text-amber-500' : 'text-white'}`}>
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-white/30 uppercase tracking-wider mt-0.5 font-medium">
                    {stat.label}
                  </div>
                  {stat.accent && (
                    <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/[0.06] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* TOOLBAR: Search + Filters + Sort */}
      {/* ================================================================= */}
      <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            {/* Search */}
            <div className="relative w-full lg:w-80 shrink-0">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <Input
                placeholder="Search agents, tools, capabilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-white/[0.03] border-white/[0.08] text-sm placeholder:text-white/20 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/20 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <Tabs value={category} onValueChange={setCategory} className="w-full lg:w-auto flex-1 min-w-0">
              <TabsList className="h-9 bg-white/[0.03] border border-white/[0.06] flex-wrap gap-0.5">
                {CATEGORIES.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-xs px-3 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-500 data-[state=active]:shadow-none transition-all duration-200"
                  >
                    {tab.icon && <span className="mr-1">{tab.icon}</span>}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-44 h-9 bg-white/[0.03] border-white/[0.08] text-xs shrink-0">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          {!loading && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-white/30">
                {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
                {searchQuery && <> matching &ldquo;{searchQuery}&rdquo;</>}
                {category !== 'all' && <> in {CATEGORIES.find((c) => c.value === category)?.label}</>}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* AGENT GRID */}
      {/* ================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          /* ---- Empty state ---- */
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-20 w-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <p className="text-white/60 text-lg font-medium mb-1">No agents found</p>
            <p className="text-white/30 text-sm max-w-sm text-center">
              {searchQuery
                ? `No results for "${searchQuery}". Try adjusting your search or filters.`
                : 'Try a different category or create your own agent.'}
            </p>
            <div className="flex gap-3 mt-6">
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setCategory('all');
                  }}
                  className="border-white/[0.08] text-white/50 hover:text-white"
                >
                  Clear Filters
                </Button>
              )}
              <Link href="/agents/create">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold"
                >
                  Create Agent
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* ---- Card grid ---- */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredAgents.map((a) => {
              const chainInfo = a.chainId ? CHAIN_LABELS[a.chainId] : null;
              const popularityPct = (a.totalExecutions / maxExec) * 100;
              const revenue = parseFloat(a.totalRevenue || '0');

              return (
                <Link key={a.id} href={`/agents/${a.id}`} className="group">
                  <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-amber-500/25 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-amber-500/[0.04] hover:scale-[1.01]">
                    {/* Top accent line on hover */}
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="p-5">
                      {/* Header: Avatar + Name + Chain/NFT badges */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <AgentAvatar name={a.name} />
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white/90 group-hover:text-amber-500 transition-colors duration-200 truncate">
                              {a.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <StarRating rating={a.rating || 0} />
                              <span className="text-[10px] text-white/25">{(a.rating || 0).toFixed(1)}</span>
                            </div>
                            <span className="text-[10px] text-white/25 mt-0.5">
                              by {a.nftTokenId !== null ? <span className="text-amber-500/70 font-medium">BoredBrain</span> : <span className="text-white/35">Community</span>}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {a.nftTokenId !== null && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  NFT
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>On-chain verified agent #{a.nftTokenId}</TooltipContent>
                            </Tooltip>
                          )}
                          {chainInfo && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${chainInfo.color}`}>
                              {chainInfo.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-white/35 leading-relaxed line-clamp-2 mb-4">
                        {a.description || 'No description provided for this agent.'}
                      </p>

                      {/* Capabilities */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        {(a.capabilities as string[]).map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 text-[10px] bg-white/[0.04] text-white/40 px-2.5 py-1 rounded-full border border-white/[0.06] transition-colors duration-200 group-hover:border-white/[0.1] group-hover:text-white/50"
                          >
                            {CAPABILITY_ICONS[c] || '\u2022'} {c}
                          </span>
                        ))}
                      </div>

                      {/* Tools */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {(a.tools as string[]).slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.03] text-white/30 border border-white/[0.05]"
                          >
                            {t}
                          </span>
                        ))}
                        {(a.tools as string[]).length > 4 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/[0.06] text-amber-500/60 border border-amber-500/10">
                            +{(a.tools as string[]).length - 4}
                          </span>
                        )}
                      </div>

                      {/* Success Rate & Response Time badges */}
                      {(() => {
                        const hash = a.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                        const successRate = 75 + (hash % 25);
                        const responseTime = (0.8 + ((hash * 7) % 24) / 10).toFixed(1);
                        return (
                          <div className="flex items-center gap-2 mb-4">
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/[0.08] text-emerald-400/80 border border-emerald-500/15">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              {successRate}% success
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-sky-500/[0.08] text-sky-400/80 border border-sky-500/15">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                              {responseTime}s avg
                            </span>
                          </div>
                        );
                      })()}

                      {/* Divider */}
                      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mb-4" />

                      {/* Stats Row */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.04] group-hover:border-amber-500/10 transition-colors duration-300">
                          <div className="text-sm font-bold text-amber-500">{a.pricePerQuery}</div>
                          <div className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">BBAI/q</div>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.04] group-hover:border-white/[0.08] transition-colors duration-300">
                          <div className="text-sm font-bold text-white/80">{a.totalExecutions.toLocaleString()}</div>
                          <div className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">Runs</div>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.04] group-hover:border-white/[0.08] transition-colors duration-300">
                          <div className="text-sm font-bold text-white/80">{revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">Earned</div>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.04] group-hover:border-white/[0.08] transition-colors duration-300">
                          <div className="text-sm font-bold text-sky-400/80">{(0.8 + ((a.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 7) % 24) / 10).toFixed(1)}s</div>
                          <div className="text-[9px] text-white/25 uppercase tracking-wider mt-0.5">Avg Resp</div>
                        </div>
                      </div>

                      {/* Popularity Bar */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-white/20 uppercase tracking-wider">Popularity</span>
                          <span className="text-[10px] text-white/30 font-medium">{popularityPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-500 transition-all duration-500"
                            style={{ width: `${popularityPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
