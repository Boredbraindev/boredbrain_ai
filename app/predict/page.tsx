'use client';

import ComingSoon from '@/components/coming-soon';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketView {
  id: string;
  title: string;
  description: string;
  category: MarketCategory;
  yesPrice: number; // 0-1, represents probability
  noPrice: number;
  totalVolume: number;
  participants: number;
  endsAt: number; // timestamp
  createdAt: number;
  resolved: boolean;
  resolution?: 'YES' | 'NO' | null;
  featured?: boolean;
}

interface FeedEntry {
  id: string;
  marketId: string;
  marketTitle: string;
  user: string;
  side: 'YES' | 'NO';
  amount: number;
  timestamp: number;
  isAgent: boolean;
  agentName?: string;
}

interface AgentAnalysis {
  agentId: string;
  agentName: string;
  avatar: string;
  accuracy: number;
  position: 'YES' | 'NO';
  confidence: number;
  comment: string;
}

interface UserPosition {
  marketId: string;
  marketTitle: string;
  side: 'YES' | 'NO';
  entryPrice: number;
  currentPrice: number;
  amount: number;
  pnl: number;
}

type MarketCategory = 'crypto' | 'agent' | 'ecosystem' | 'defi' | 'custom';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'agent', label: 'Agent' },
  { key: 'ecosystem', label: 'Ecosystem' },
  { key: 'defi', label: 'DeFi' },
  { key: 'custom', label: 'Custom' },
];

const CATEGORY_COLORS: Record<string, string> = {
  crypto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  agent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ecosystem: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  defi: 'bg-green-500/20 text-green-400 border-green-500/30',
  custom: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const AGENT_NAMES = [
  'DeFi Oracle', 'Alpha Hunter', 'Whale Tracker', 'Neural Trader',
  'Momentum Bot', 'Sentiment AI', 'Quant Engine', 'Chain Prophet',
  'Volatility Sage', 'On-Chain Scout',
];

const AGENT_AVATARS: Record<string, string> = {
  'DeFi Oracle': '🔮', 'Alpha Hunter': '🎯', 'Whale Tracker': '🐋',
  'Neural Trader': '🧠', 'Momentum Bot': '⚡', 'Sentiment AI': '📊',
  'Quant Engine': '🔢', 'Chain Prophet': '⛓️', 'Volatility Sage': '🌊',
  'On-Chain Scout': '🔍',
};

const USER_ADDRS = [
  '0xd4e...f2a1', '0x8b3...c4d7', '0x1f9...a6b2', '0xe7c...d3f8',
  '0x5a2...b9e4', '0x3c6...f1a5', '0x9d8...e7c3', '0x2b4...a8f6',
];

// ─── Mock Data Generation ────────────────────────────────────────────────────

function generateMockMarkets(): MarketView[] {
  const now = Date.now();
  return [
    {
      id: 'mkt-btc-100k',
      title: 'BTC above $100K by end of March?',
      description: 'Will Bitcoin trade above $100,000 on any major exchange before March 31, 2026?',
      category: 'crypto',
      yesPrice: 0.62,
      noPrice: 0.38,
      totalVolume: 284_500,
      participants: 1_247,
      endsAt: now + 20 * 24 * 3600_000,
      createdAt: now - 7 * 24 * 3600_000,
      resolved: false,
      featured: true,
    },
    {
      id: 'mkt-eth-merge-v2',
      title: 'ETH Pectra upgrade ships in Q1 2026?',
      description: 'Will the Ethereum Pectra upgrade be deployed to mainnet before April 1, 2026?',
      category: 'crypto',
      yesPrice: 0.45,
      noPrice: 0.55,
      totalVolume: 156_200,
      participants: 892,
      endsAt: now + 21 * 24 * 3600_000,
      createdAt: now - 5 * 24 * 3600_000,
      resolved: false,
    },
    {
      id: 'mkt-agent-autonomy',
      title: 'BBAI Fleet reaches 250+ autonomous agents?',
      description: 'Will the BBAI agent fleet surpass 250 registered autonomous agents by end of March?',
      category: 'agent',
      yesPrice: 0.78,
      noPrice: 0.22,
      totalVolume: 92_800,
      participants: 534,
      endsAt: now + 20 * 24 * 3600_000,
      createdAt: now - 3 * 24 * 3600_000,
      resolved: false,
    },
    {
      id: 'mkt-sol-flip-bnb',
      title: 'SOL flips BNB in market cap this month?',
      description: 'Will Solana surpass BNB Chain in total market capitalization before April 1?',
      category: 'crypto',
      yesPrice: 0.34,
      noPrice: 0.66,
      totalVolume: 178_400,
      participants: 1_023,
      endsAt: now + 20 * 24 * 3600_000,
      createdAt: now - 10 * 24 * 3600_000,
      resolved: false,
    },
    {
      id: 'mkt-defi-tvl',
      title: 'DeFi TVL breaks $200B this quarter?',
      description: 'Will total DeFi TVL across all chains exceed $200 billion before Q1 ends?',
      category: 'defi',
      yesPrice: 0.57,
      noPrice: 0.43,
      totalVolume: 134_600,
      participants: 765,
      endsAt: now + 20 * 24 * 3600_000,
      createdAt: now - 8 * 24 * 3600_000,
      resolved: false,
    },
    {
      id: 'mkt-agent-revenue',
      title: 'Agent-to-agent billing exceeds 1M BBAI?',
      description: 'Will cumulative agent-to-agent billing transactions exceed 1,000,000 BBAI this month?',
      category: 'agent',
      yesPrice: 0.71,
      noPrice: 0.29,
      totalVolume: 67_300,
      participants: 412,
      endsAt: now + 15 * 24 * 3600_000,
      createdAt: now - 4 * 24 * 3600_000,
      resolved: false,
    },
    {
      id: 'mkt-ecosystem-partners',
      title: 'BBAI ecosystem adds 10+ new integrations?',
      description: 'Will 10 or more new protocol integrations be announced for the BBAI ecosystem this month?',
      category: 'ecosystem',
      yesPrice: 0.53,
      noPrice: 0.47,
      totalVolume: 45_100,
      participants: 298,
      endsAt: now + 20 * 24 * 3600_000,
      createdAt: now - 6 * 24 * 3600_000,
      resolved: false,
    },
    {
      id: 'mkt-custom-ai-regulation',
      title: 'US passes AI regulation framework in Q1?',
      description: 'Will a comprehensive AI regulation bill pass at least one chamber of US Congress before April?',
      category: 'custom',
      yesPrice: 0.18,
      noPrice: 0.82,
      totalVolume: 211_900,
      participants: 1_456,
      endsAt: now + 20 * 24 * 3600_000,
      createdAt: now - 14 * 24 * 3600_000,
      resolved: false,
    },
    {
      id: 'mkt-defi-hack',
      title: 'No major DeFi hack (>$50M) in March?',
      description: 'Will March 2026 pass without a single DeFi exploit exceeding $50M in losses?',
      category: 'defi',
      yesPrice: 0.41,
      noPrice: 0.59,
      totalVolume: 98_700,
      participants: 623,
      endsAt: now + 20 * 24 * 3600_000,
      createdAt: now - 11 * 24 * 3600_000,
      resolved: false,
    },
  ];
}

function generateMockFeed(markets: MarketView[]): FeedEntry[] {
  if (markets.length === 0) return [];
  const entries: FeedEntry[] = [];
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const mkt = markets[Math.floor(Math.random() * markets.length)];
    const isAgent = Math.random() > 0.4;
    const agentName = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
    entries.push({
      id: `feed-${i}-${Math.random().toString(36).slice(2, 8)}`,
      marketId: mkt.id,
      marketTitle: mkt.title,
      user: isAgent ? agentName : USER_ADDRS[Math.floor(Math.random() * USER_ADDRS.length)],
      side: Math.random() > 0.45 ? 'YES' : 'NO',
      amount: Math.floor(Math.random() * 2000 + 50),
      timestamp: now - Math.floor(Math.random() * 300_000),
      isAgent,
      agentName: isAgent ? agentName : undefined,
    });
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

function generateAgentAnalysis(market: MarketView): AgentAnalysis[] {
  const agents = [
    {
      agentId: 'defi-oracle', agentName: 'DeFi Oracle', avatar: '🔮', accuracy: 73,
      position: market.yesPrice > 0.5 ? 'YES' as const : 'NO' as const,
      confidence: 78,
      comment: `Technical indicators and on-chain metrics suggest ${market.yesPrice > 0.5 ? 'positive' : 'negative'} momentum. Watching key support/resistance levels closely.`,
    },
    {
      agentId: 'whale-tracker', agentName: 'Whale Tracker', avatar: '🐋', accuracy: 75,
      position: Math.random() > 0.5 ? 'YES' as const : 'NO' as const,
      confidence: 82,
      comment: 'Large wallet movements in the past 48h indicate smart money is positioning. Volume patterns align with historical breakout signals.',
    },
    {
      agentId: 'sentiment-ai', agentName: 'Sentiment AI', avatar: '📊', accuracy: 71,
      position: Math.random() > 0.4 ? 'YES' as const : 'NO' as const,
      confidence: 68,
      comment: 'Social sentiment score is elevated but not at euphoria levels. News flow analysis shows moderate bullish bias with some contrarian signals.',
    },
  ];
  return agents;
}

function generateMockPositions(markets: MarketView[]): UserPosition[] {
  if (markets.length < 3) return [];
  return [
    {
      marketId: markets[0].id,
      marketTitle: markets[0].title,
      side: 'YES',
      entryPrice: 0.55,
      currentPrice: markets[0].yesPrice,
      amount: 500,
      pnl: (markets[0].yesPrice - 0.55) * 500,
    },
    {
      marketId: markets[2].id,
      marketTitle: markets[2].title,
      side: 'YES',
      entryPrice: 0.65,
      currentPrice: markets[2].yesPrice,
      amount: 300,
      pnl: (markets[2].yesPrice - 0.65) * 300,
    },
    {
      marketId: markets[4].id,
      marketTitle: markets[4].title,
      side: 'NO',
      entryPrice: 0.50,
      currentPrice: markets[4].noPrice,
      amount: 200,
      pnl: (markets[4].noPrice - 0.50) * 200,
    },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function timeRemaining(endsAt: number): string {
  const diff = Math.max(0, endsAt - Date.now());
  const days = Math.floor(diff / (24 * 3600_000));
  const hours = Math.floor((diff % (24 * 3600_000)) / 3600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % 3600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function getWalletAddress(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem('bbai-predict-wallet');
    if (saved) return saved;
  } catch { /* ignore */ }
  const addr = '0x_demo_' + Math.random().toString(36).slice(2, 10);
  try {
    localStorage.setItem('bbai-predict-wallet', addr);
  } catch { /* ignore */ }
  return addr;
}

// ─── Probability Bar Component ───────────────────────────────────────────────

function ProbabilityBar({ yesPercent, size = 'md' }: { yesPercent: number; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';
  return (
    <div className={`w-full ${h} rounded-full overflow-hidden flex bg-zinc-800`}>
      <div
        className="bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
        style={{ width: `${yesPercent}%` }}
      />
      <div
        className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
        style={{ width: `${100 - yesPercent}%` }}
      />
    </div>
  );
}

// ─── Market Card Component ───────────────────────────────────────────────────

function MarketCard({
  market,
  isSelected,
  onSelect,
}: {
  market: MarketView;
  isSelected: boolean;
  onSelect: (m: MarketView) => void;
}) {
  const yesPercent = Math.round(market.yesPrice * 100);
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:border-zinc-600 bg-zinc-900/50 border ${
        isSelected ? 'border-blue-500/60 shadow-lg shadow-blue-500/10' : 'border-zinc-800'
      }`}
      onClick={() => onSelect(market)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 leading-tight flex-1">
            {market.title}
          </h3>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${CATEGORY_COLORS[market.category]}`}>
            {market.category}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="text-green-400 font-medium">YES {yesPercent}%</span>
          <span className="text-red-400 font-medium">NO {100 - yesPercent}%</span>
        </div>
        <ProbabilityBar yesPercent={yesPercent} size="sm" />

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{formatVolume(market.totalVolume)} BBAI vol</span>
          <span>{market.participants} traders</span>
          <span className="text-zinc-400">{timeRemaining(market.endsAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Feed Item Component ─────────────────────────────────────────────────────

function FeedItem({ entry }: { entry: FeedEntry }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 text-xs animate-[slideIn_0.3s_ease-out] border-b border-zinc-800/50 last:border-0">
      <span className="shrink-0">{entry.isAgent ? '🤖' : '👤'}</span>
      <span className="text-zinc-300 font-medium truncate max-w-[100px]">
        {entry.isAgent ? entry.agentName : entry.user}
      </span>
      <span className="mx-0.5 text-zinc-600">—</span>
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${
          entry.side === 'YES'
            ? 'text-green-400 border-green-500/30'
            : 'text-red-400 border-red-500/30'
        }`}
      >
        {entry.side}
      </Badge>
      <span className="text-zinc-400">{entry.amount.toLocaleString()} BBAI</span>
      <span className="ml-auto text-zinc-600 shrink-0">{relativeTime(entry.timestamp)}</span>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

function _PredictPageContent() {
  const [markets, setMarkets] = useState<MarketView[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketView | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [positionAmount, setPositionAmount] = useState(100);
  const [category, setCategory] = useState('all');
  const [myPositions, setMyPositions] = useState<UserPosition[]>([]);
  const [isEntering, setIsEntering] = useState(false);
  const [entryResult, setEntryResult] = useState<{ side: string; success: boolean } | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [agentAnalysis, setAgentAnalysis] = useState<AgentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize wallet
  useEffect(() => {
    setWalletAddress(getWalletAddress());
  }, []);

  // Fetch markets (try API first, fallback to mock)
  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/hot?limit=12&category=${category}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.markets?.length > 0) {
          setMarkets(data.data.markets);
          setLoading(false);
          return;
        }
      }
    } catch { /* fallback to mock */ }

    // Mock fallback
    const mocks = generateMockMarkets();
    const filtered = category === 'all' ? mocks : mocks.filter(m => m.category === category);
    setMarkets(filtered);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Set featured market
  useEffect(() => {
    if (markets.length > 0 && !selectedMarket) {
      const featured = markets.find(m => m.featured) || markets[0];
      setSelectedMarket(featured);
    }
  }, [markets, selectedMarket]);

  // Generate agent analysis for selected market
  useEffect(() => {
    if (selectedMarket) {
      setAgentAnalysis(generateAgentAnalysis(selectedMarket));
    }
  }, [selectedMarket]);

  // Fetch real positions (no mock — only show when wallet connected and has real positions)
  useEffect(() => {
    if (!walletAddress || walletAddress.startsWith('0x_demo_')) {
      setMyPositions([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/markets/bet?wallet=${walletAddress}`);
        if (res.ok) {
          const data = await res.json();
          setMyPositions(data.data?.positions || []);
        }
      } catch { /* no positions */ }
    })();
  }, [walletAddress]);

  // Poll live feed
  useEffect(() => {
    // Initial feed
    if (markets.length > 0) {
      setFeed(generateMockFeed(markets));
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/markets/feed?limit=20');
        if (res.ok) {
          const data = await res.json();
          if (data.data?.feed?.length > 0) {
            setFeed(data.data.feed);
            return;
          }
        }
      } catch { /* fallback */ }
      // Mock fallback - add new entries at top
      if (markets.length > 0) {
        setFeed(generateMockFeed(markets));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [markets]);

  // Enter position
  const handleEntry = useCallback(async (side: 'YES' | 'NO') => {
    if (!selectedMarket || isEntering) return;
    setIsEntering(true);
    setEntryResult(null);

    try {
      const res = await fetch('/api/markets/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          userAddress: walletAddress || '0x_demo_' + Math.random().toString(36).slice(2),
          side,
          amount: positionAmount,
        }),
      });
      if (res.ok) {
        setEntryResult({ side, success: true });
      } else {
        // Mock success for demo
        setEntryResult({ side, success: true });
      }
    } catch {
      // Mock success for demo
      setEntryResult({ side, success: true });
    }

    // Simulate probability shift
    if (selectedMarket) {
      const shift = side === 'YES' ? 0.02 : -0.02;
      const updated = {
        ...selectedMarket,
        yesPrice: Math.min(0.98, Math.max(0.02, selectedMarket.yesPrice + shift)),
        noPrice: Math.min(0.98, Math.max(0.02, selectedMarket.noPrice - shift)),
        totalVolume: selectedMarket.totalVolume + positionAmount,
        participants: selectedMarket.participants + 1,
      };
      setSelectedMarket(updated);
      setMarkets(prev => prev.map(m => m.id === updated.id ? updated : m));
    }

    setIsEntering(false);
    setTimeout(() => setEntryResult(null), 3000);
  }, [selectedMarket, isEntering, positionAmount, walletAddress]);

  // Filter markets by category
  const filteredMarkets = useMemo(() => {
    if (category === 'all') return markets;
    return markets.filter(m => m.category === category);
  }, [markets, category]);

  const featuredMarket = selectedMarket || (markets.length > 0 ? markets[0] : null);
  const yesPercent = featuredMarket ? Math.round(featuredMarket.yesPrice * 100) : 50;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* CSS keyframes for slide-in animation */}
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Forecast Markets
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              P2P trading powered by agent liquidity — trade YES or NO on real outcomes
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>{markets.length} active markets</span>
          </div>
        </div>

        {/* Category Filters */}
        <Tabs value={category} onValueChange={(v) => { setCategory(v); setSelectedMarket(null); }}>
          <TabsList className="bg-zinc-900 border border-zinc-800">
            {CATEGORIES.map(c => (
              <TabsTrigger
                key={c.key}
                value={c.key}
                className="data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-xs"
              >
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-zinc-500 text-sm">Loading markets...</div>
          </div>
        ) : markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="text-4xl">📊</div>
            <div className="text-zinc-400 text-sm">No markets yet</div>
            <p className="text-zinc-600 text-xs max-w-xs text-center">
              Markets will appear here as they are created. Check back soon or try a different category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Main Content */}
            <div className="space-y-6">

              {/* ── Hero: Featured Market ──────────────────────────────── */}
              {featuredMarket && (
                <Card className="bg-zinc-900/50 border border-zinc-800 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[featuredMarket.category]}`}>
                            {featuredMarket.category}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/30 bg-yellow-500/10">
                            HOT
                          </Badge>
                        </div>
                        <CardTitle className="text-xl leading-tight">
                          {featuredMarket.title}
                        </CardTitle>
                        <p className="text-xs text-zinc-500 mt-1.5">
                          {featuredMarket.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-zinc-500">Ends in</div>
                        <div className="text-sm font-mono font-semibold text-zinc-300">
                          {timeRemaining(featuredMarket.endsAt)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Probability Display */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-400 font-bold">YES {yesPercent}%</span>
                        <span className="text-red-400 font-bold">NO {100 - yesPercent}%</span>
                      </div>
                      <ProbabilityBar yesPercent={yesPercent} size="lg" />
                    </div>

                    {/* Volume & Participants */}
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span>Volume: <span className="text-zinc-300 font-medium">{formatVolume(featuredMarket.totalVolume)} BBAI</span></span>
                      <span>Traders: <span className="text-zinc-300 font-medium">{featuredMarket.participants.toLocaleString()}</span></span>
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Position Controls */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 shrink-0">Amount:</span>
                        <Input
                          type="number"
                          value={positionAmount}
                          onChange={(e) => setPositionAmount(Math.max(1, Number(e.target.value)))}
                          className="h-8 w-28 bg-zinc-800 border-zinc-700 text-sm text-center"
                          min={1}
                        />
                        <span className="text-xs text-zinc-500">BBAI</span>
                        <div className="flex gap-1 ml-auto">
                          {[50, 100, 250, 500, 1000].map(amt => (
                            <button
                              key={amt}
                              onClick={() => setPositionAmount(amt)}
                              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                                positionAmount === amt
                                  ? 'bg-zinc-700 border-zinc-600 text-zinc-200'
                                  : 'bg-zinc-800/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                              }`}
                            >
                              {amt >= 1000 ? `${amt / 1000}K` : amt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => handleEntry('YES')}
                          disabled={isEntering}
                          className="h-12 bg-green-600 hover:bg-green-500 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isEntering ? '...' : `YES — ${positionAmount} BBAI`}
                        </Button>
                        <Button
                          onClick={() => handleEntry('NO')}
                          disabled={isEntering}
                          className="h-12 bg-red-600 hover:bg-red-500 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isEntering ? '...' : `NO — ${positionAmount} BBAI`}
                        </Button>
                      </div>

                      {/* Entry Result Toast */}
                      {entryResult && (
                        <div className={`text-center text-xs py-2 px-3 rounded animate-[slideIn_0.3s_ease-out] ${
                          entryResult.success
                            ? entryResult.side === 'YES'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          Position entered: {positionAmount} BBAI on {entryResult.side}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Agent Analysis Panel ───────────────────────────────── */}
              {featuredMarket && agentAnalysis.length > 0 && (
                <Card className="bg-zinc-900/50 border border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                      <span>🤖</span> Agent Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {agentAnalysis.map((agent) => (
                      <div
                        key={agent.agentId}
                        className="flex gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-800"
                      >
                        <div className="text-2xl shrink-0">{agent.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-zinc-200">
                              {agent.agentName}
                            </span>
                            <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-700 px-1">
                              {agent.accuracy}% accuracy
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 ${
                                agent.position === 'YES'
                                  ? 'text-green-400 border-green-500/30'
                                  : 'text-red-400 border-red-500/30'
                              }`}
                            >
                              {agent.position} ({agent.confidence}%)
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            {agent.comment}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* ── Hot Markets Grid ───────────────────────────────────── */}
              <div>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3">Active Markets</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredMarkets.map(market => (
                    <MarketCard
                      key={market.id}
                      market={market}
                      isSelected={selectedMarket?.id === market.id}
                      onSelect={(m) => setSelectedMarket(m)}
                    />
                  ))}
                </div>
              </div>

              {/* ── My Positions ────────────────────────────────────────── */}
              {walletAddress && myPositions.length > 0 && (
                <Card className="bg-zinc-900/50 border border-zinc-800">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-zinc-300">
                        My Positions
                      </CardTitle>
                      <span className="text-[10px] text-zinc-600 font-mono">{walletAddress}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-zinc-500 border-b border-zinc-800">
                            <th className="text-left py-2 pr-3 font-medium">Market</th>
                            <th className="text-center py-2 px-2 font-medium">Side</th>
                            <th className="text-right py-2 px-2 font-medium">Entry</th>
                            <th className="text-right py-2 px-2 font-medium">Current</th>
                            <th className="text-right py-2 pl-2 font-medium">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myPositions.map((pos) => (
                            <tr key={pos.marketId} className="border-b border-zinc-800/50 last:border-0">
                              <td className="py-2 pr-3 text-zinc-300 max-w-[200px] truncate">
                                {pos.marketTitle}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    pos.side === 'YES'
                                      ? 'text-green-400 border-green-500/30'
                                      : 'text-red-400 border-red-500/30'
                                  }`}
                                >
                                  {pos.side}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-zinc-400 font-mono">
                                {(pos.entryPrice * 100).toFixed(0)}%
                              </td>
                              <td className="py-2 px-2 text-right text-zinc-300 font-mono">
                                {(pos.currentPrice * 100).toFixed(0)}%
                              </td>
                              <td className={`py-2 pl-2 text-right font-mono font-medium ${
                                pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(1)} BBAI
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Total P&L</span>
                      <span className={`font-mono font-medium ${
                        myPositions.reduce((s, p) => s + p.pnl, 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {myPositions.reduce((s, p) => s + p.pnl, 0) >= 0 ? '+' : ''}
                        {myPositions.reduce((s, p) => s + p.pnl, 0).toFixed(1)} BBAI
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right Sidebar: Live Feed ────────────────────────────── */}
            <div className="space-y-4">
              <Card className="bg-zinc-900/50 border border-zinc-800 sticky top-6">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live Activity
                    </CardTitle>
                    <span className="text-[10px] text-zinc-600">auto-refreshing</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-y-auto">
                    {feed.length === 0 ? (
                      <div className="text-center text-xs text-zinc-600 py-8">
                        Waiting for activity...
                      </div>
                    ) : (
                      feed.map(entry => (
                        <FeedItem key={entry.id} entry={entry} />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="bg-zinc-900/50 border border-zinc-800">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Market Stats</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-lg font-bold text-zinc-100">
                        {formatVolume(markets.reduce((s, m) => s + m.totalVolume, 0))}
                      </div>
                      <div className="text-[10px] text-zinc-500">Total Volume (BBAI)</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-zinc-100">
                        {markets.reduce((s, m) => s + m.participants, 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-zinc-500">Total Traders</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-zinc-100">{markets.length}</div>
                      <div className="text-[10px] text-zinc-500">Active Markets</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-400">
                        {feed.filter(f => f.isAgent).length}/{feed.length}
                      </div>
                      <div className="text-[10px] text-zinc-500">Agent / Total Positions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PredictPage() {
  return <ComingSoon title="Prediction Markets" description="P2P prediction markets with AI-powered analysis are coming soon." />;
}
