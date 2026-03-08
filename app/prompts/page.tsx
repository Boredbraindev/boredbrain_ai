'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface PromptTemplate {
  id: string;
  creatorName: string | null;
  title: string;
  description: string;
  systemPrompt?: string;
  category: string;
  tags: string[];
  previewMessages: Array<{ role: string; content: string }>;
  tools: string[];
  price: string;
  totalSales: number;
  totalRevenue: string;
  rating: number;
  ratingCount: number;
  featured: boolean;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  all: { label: 'All', icon: '', color: '' },
  coding: { label: 'Coding', icon: '💻', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  research: { label: 'Research', icon: '🔬', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  finance: { label: 'Finance', icon: '📊', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  creative: { label: 'Creative', icon: '✨', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  marketing: { label: 'Marketing', icon: '📈', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  general: { label: 'General', icon: '🧠', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

const TOOL_COLORS: Record<string, string> = {
  web_search: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  x_search: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  coin_data: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  wallet_analyzer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  code_interpreter: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  academic_search: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  retrieve: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  reddit_search: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  nft_retrieval: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  token_retrieval: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Web Search',
  x_search: 'X / Twitter',
  coin_data: 'Coin Data',
  wallet_analyzer: 'Wallet Analyzer',
  code_interpreter: 'Code Interpreter',
  academic_search: 'Academic Search',
  retrieve: 'Retrieval',
  reddit_search: 'Reddit',
  nft_retrieval: 'NFT Data',
  token_retrieval: 'Token Data',
};

// ---------------------------------------------------------------------------
// Showcase prompts — displayed when the API returns no listings
// ---------------------------------------------------------------------------
const SHOWCASE_PROMPTS: PromptTemplate[] = [
  {
    id: 'showcase-1',
    creatorName: 'AlphaForge',
    title: 'DeFi Yield Optimizer Pro',
    description: 'Advanced system prompt that turns any LLM into a DeFi yield optimization expert. Analyzes APY, TVL, risk metrics across 15+ protocols.',
    systemPrompt: 'You are a DeFi yield optimization expert. Analyze yield farming opportunities across major protocols including Aave, Compound, Curve, Convex, Yearn. Always consider impermanent loss, smart contract risk, and gas costs. Provide risk-adjusted APY calculations...',
    category: 'finance',
    tags: ['DeFi', 'Yield', 'APY', 'Risk Analysis'],
    previewMessages: [
      { role: 'user', content: 'Find me the best yield farming opportunities for 10 ETH with moderate risk tolerance' },
      { role: 'assistant', content: 'I\'ll analyze current DeFi yields across major protocols for your 10 ETH position. Here are the top opportunities ranked by risk-adjusted APY...' },
    ],
    tools: ['coin_data', 'web_search', 'wallet_analyzer'],
    price: '150',
    totalSales: 1247,
    totalRevenue: '187050',
    rating: 4.9,
    ratingCount: 342,
    featured: true,
    createdAt: '2025-06-15T00:00:00Z',
  },
  {
    id: 'showcase-2',
    creatorName: 'CodeMaster',
    title: 'Full-Stack Code Architect',
    description: 'Enterprise-grade system prompt for code generation. Follows SOLID principles, includes testing strategies, and provides architecture recommendations.',
    systemPrompt: 'You are a senior full-stack architect with 15+ years of experience. Always follow SOLID principles, write clean maintainable code. Include unit tests, error handling, and documentation...',
    category: 'coding',
    tags: ['Architecture', 'Full-Stack', 'Best Practices', 'Testing'],
    previewMessages: [
      { role: 'user', content: 'Design a microservices architecture for a real-time trading platform' },
      { role: 'assistant', content: 'I\'ll design a scalable microservices architecture using event-driven patterns. Here\'s the service decomposition with data flow diagrams...' },
    ],
    tools: ['code_interpreter', 'web_search'],
    price: '200',
    totalSales: 2156,
    totalRevenue: '431200',
    rating: 4.95,
    ratingCount: 567,
    featured: true,
    createdAt: '2025-05-20T00:00:00Z',
  },
  {
    id: 'showcase-3',
    creatorName: 'ResearchDAO',
    title: 'Academic Paper Synthesizer',
    description: 'Transforms complex academic papers into actionable insights. Cross-references citations, identifies methodology gaps, and generates literature reviews.',
    systemPrompt: 'You are an academic research synthesizer specializing in cross-disciplinary analysis. Parse research papers, extract key findings, evaluate methodology quality...',
    category: 'research',
    tags: ['Academic', 'Papers', 'Literature Review', 'Analysis'],
    previewMessages: [
      { role: 'user', content: 'Synthesize the latest 5 papers on transformer architecture improvements' },
      { role: 'assistant', content: 'I\'ve analyzed 5 recent papers on transformer improvements. Key themes: (1) Linear attention mechanisms showing 3x speedup...' },
    ],
    tools: ['academic_search', 'web_search', 'retrieve'],
    price: '120',
    totalSales: 893,
    totalRevenue: '107160',
    rating: 4.8,
    ratingCount: 234,
    featured: true,
    createdAt: '2025-07-10T00:00:00Z',
  },
  {
    id: 'showcase-4',
    creatorName: 'SentimentAI',
    title: 'Crypto Sentiment Analyzer',
    description: 'Real-time crypto sentiment analysis combining Twitter/X feeds, Reddit discussions, and on-chain whale activity into actionable trading signals.',
    systemPrompt: 'You are a crypto sentiment analysis expert. Combine social media sentiment from Twitter/X and Reddit with on-chain data to generate trading signals...',
    category: 'finance',
    tags: ['Sentiment', 'Trading', 'Social', 'Signals'],
    previewMessages: [
      { role: 'user', content: 'What\'s the current sentiment for $ETH across social media?' },
      { role: 'assistant', content: 'Current ETH sentiment analysis: Twitter/X: 72% bullish (↑5% from yesterday). Reddit r/ethereum: Moderately positive with focus on upcoming upgrades...' },
    ],
    tools: ['x_search', 'reddit_search', 'coin_data', 'web_search'],
    price: '180',
    totalSales: 1589,
    totalRevenue: '286020',
    rating: 4.85,
    ratingCount: 421,
    featured: false,
    createdAt: '2025-08-05T00:00:00Z',
  },
  {
    id: 'showcase-5',
    creatorName: 'ContentPro',
    title: 'Viral Content Framework',
    description: 'Battle-tested content creation framework used by 50+ crypto projects. Generates threads, blog posts, and marketing copy that consistently goes viral.',
    systemPrompt: 'You are a viral content strategist specializing in crypto and Web3. Create engaging hooks, compelling narratives, and call-to-actions optimized for engagement...',
    category: 'marketing',
    tags: ['Content', 'Viral', 'Marketing', 'Growth'],
    previewMessages: [
      { role: 'user', content: 'Create a Twitter thread announcing our new NFT collection launch' },
      { role: 'assistant', content: '🧵 Thread: Why this NFT collection will redefine digital ownership (1/12)\n\nMost NFT projects focus on art. We focused on utility. Here\'s why that changes everything...' },
    ],
    tools: ['x_search', 'web_search'],
    price: '100',
    totalSales: 3421,
    totalRevenue: '342100',
    rating: 4.7,
    ratingCount: 876,
    featured: false,
    createdAt: '2025-04-15T00:00:00Z',
  },
  {
    id: 'showcase-6',
    creatorName: 'ArtificerAI',
    title: 'Creative Worldbuilder',
    description: 'Immersive worldbuilding system prompt for game designers and writers. Creates consistent lore, character arcs, and narrative structures with deep coherence.',
    systemPrompt: 'You are a master worldbuilder and narrative designer. Create rich, internally consistent worlds with detailed lore, cultures, magic systems, and character motivations...',
    category: 'creative',
    tags: ['Worldbuilding', 'Narrative', 'Game Design', 'Lore'],
    previewMessages: [
      { role: 'user', content: 'Build a fantasy world where magic is powered by memories' },
      { role: 'assistant', content: 'Welcome to Mnemosia — a world where memories are the currency of power. The Rememberers guild controls the flow of memory-magic, harvesting experiences...' },
    ],
    tools: ['web_search'],
    price: '80',
    totalSales: 1876,
    totalRevenue: '150080',
    rating: 4.9,
    ratingCount: 512,
    featured: false,
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'showcase-7',
    creatorName: 'WhaleWatch',
    title: 'On-Chain Whale Tracker',
    description: 'Monitors and interprets whale wallet movements across EVM chains. Identifies accumulation patterns, smart money flows, and potential market-moving transactions.',
    systemPrompt: 'You are an on-chain analyst specializing in whale behavior and smart money tracking. Analyze wallet movements, identify accumulation/distribution patterns...',
    category: 'finance',
    tags: ['Whales', 'On-chain', 'Smart Money', 'Analytics'],
    previewMessages: [
      { role: 'user', content: 'Track the top 10 whale wallets for ETH movements in the last 24h' },
      { role: 'assistant', content: 'Whale Activity Report (Last 24h):\n🐋 Wallet 0x1a...3f: Accumulated 5,200 ETH ($15.6M) across 3 transactions...' },
    ],
    tools: ['wallet_analyzer', 'coin_data', 'web_search'],
    price: '250',
    totalSales: 967,
    totalRevenue: '241750',
    rating: 4.85,
    ratingCount: 298,
    featured: false,
    createdAt: '2025-07-28T00:00:00Z',
  },
  {
    id: 'showcase-8',
    creatorName: 'NFTScope',
    title: 'NFT Collection Analyzer',
    description: 'Deep analysis of NFT collections including rarity scoring, wash-trade detection, holder distribution, and floor price prediction models.',
    systemPrompt: 'You are an NFT market analyst expert. Analyze collections for rarity distribution, wash trading patterns, holder concentration, and price trajectory...',
    category: 'research',
    tags: ['NFT', 'Analysis', 'Rarity', 'Market Intelligence'],
    previewMessages: [
      { role: 'user', content: 'Analyze the BAYC collection: holder distribution and wash trade percentage' },
      { role: 'assistant', content: 'BAYC Collection Analysis:\n📊 Unique Holders: 5,847 (58.5% of supply)\n🔴 Wash Trade Volume: ~12% of 30d volume detected...' },
    ],
    tools: ['nft_retrieval', 'web_search', 'wallet_analyzer'],
    price: '160',
    totalSales: 1234,
    totalRevenue: '197440',
    rating: 4.75,
    ratingCount: 345,
    featured: false,
    createdAt: '2025-06-22T00:00:00Z',
  },
  {
    id: 'showcase-9',
    creatorName: 'SmartAudit',
    title: 'Smart Contract Auditor',
    description: 'Automated smart contract security review prompt. Identifies common vulnerabilities, gas optimizations, and best practice violations in Solidity code.',
    systemPrompt: 'You are a smart contract security auditor. Analyze Solidity code for reentrancy, overflow, access control, and other OWASP smart contract vulnerabilities...',
    category: 'coding',
    tags: ['Security', 'Audit', 'Solidity', 'Smart Contracts'],
    previewMessages: [
      { role: 'user', content: 'Audit this ERC-20 token contract for security vulnerabilities' },
      { role: 'assistant', content: 'Security Audit Report:\n🔴 CRITICAL: Reentrancy vulnerability in withdraw() function (line 47)\n🟡 MEDIUM: Missing zero-address check in transfer()...' },
    ],
    tools: ['code_interpreter', 'web_search'],
    price: '300',
    totalSales: 756,
    totalRevenue: '226800',
    rating: 4.95,
    ratingCount: 189,
    featured: false,
    createdAt: '2025-08-18T00:00:00Z',
  },
];

function PromptCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-14 rounded-full" />)}
        </div>
        <Skeleton className="h-20 rounded-lg" />
      </CardContent>
    </Card>
  );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <div className="flex items-center gap-1">
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
      <span className="text-[10px] text-muted-foreground">({count})</span>
    </div>
  );
}

export default function PromptMarketplacePage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'cheap' | 'new'>('popular');

  useEffect(() => {
    async function fetchPrompts() {
      try {
        const res = await fetch('/api/prompts?limit=50');
        const data = await res.json();
        const apiPrompts = data.prompts || [];
        setPrompts(apiPrompts.length > 0 ? apiPrompts : SHOWCASE_PROMPTS);
      } catch (error) {
        console.error('Failed to fetch prompts:', error);
        setPrompts(SHOWCASE_PROMPTS);
      } finally {
        setLoading(false);
      }
    }
    fetchPrompts();
  }, []);

  const filteredPrompts = useMemo(() => {
    let result = category === 'all'
      ? prompts
      : prompts.filter((p) => p.category === category);

    if (sortBy === 'rating') result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'cheap') result = [...result].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sortBy === 'new') result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else result = [...result].sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0));

    return result;
  }, [prompts, category, sortBy]);

  const totalPrompts = prompts.length;
  const totalSales = prompts.reduce((sum, p) => sum + (p.totalSales || 0), 0);
  const totalRevenue = prompts.reduce((sum, p) => sum + parseFloat(p.totalRevenue || '0'), 0);

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Hero Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-amber-500/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Prompt Store</h1>
                <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-widest">Beta</Badge>
              </div>
              <p className="text-muted-foreground mt-1 max-w-lg">
                Buy & sell AI-crafted system prompts. Each prompt is a battle-tested AI agent personality that you can deploy instantly.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">Back to Search</Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline" size="sm">Agent Marketplace</Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3 mt-8">
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalPrompts}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Prompts</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalSales.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Sales</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalRevenue.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">BBAI Volume</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filter & Sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Tabs value={category} onValueChange={setCategory} className="w-full sm:w-auto">
            <TabsList className="h-9 flex-wrap">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <TabsTrigger key={key} value={key} className="text-xs px-3">
                  {config.icon ? `${config.icon} ` : ''}{config.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            {([
              { value: 'popular', label: 'Best Sellers' },
              { value: 'rating', label: 'Top Rated' },
              { value: 'cheap', label: 'Cheapest' },
              { value: 'new', label: 'Newest' },
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

        {/* Featured Section */}
        {!loading && category === 'all' && sortBy === 'popular' && (
          <>
            {filteredPrompts.filter((p) => p.featured).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-amber-500">★</span> Featured Prompts
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPrompts.filter((p) => p.featured).map((p) => (
                    <PromptCard key={p.id} prompt={p} featured />
                  ))}
                </div>
                <Separator className="mt-8" />
              </div>
            )}
          </>
        )}

        {/* Prompt Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <PromptCardSkeleton key={i} />)}
          </div>
        ) : filteredPrompts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-muted-foreground text-lg font-medium">No prompts found</p>
              <p className="text-muted-foreground text-sm mt-1">Try a different category or create your own.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrompts
              .filter((p) => !(category === 'all' && sortBy === 'popular' && p.featured))
              .map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PromptCard({ prompt: p, featured = false }: { prompt: PromptTemplate; featured?: boolean }) {
  const catConfig = CATEGORY_CONFIG[p.category] || CATEGORY_CONFIG.general;
  const isBestSeller = (p.totalSales || 0) >= 500;
  const isTopRated = (p.rating || 0) >= 4.9;
  const priceNum = parseFloat(p.price);

  return (
    <Link href={`/prompts/${p.id}`}>
      <Card className={`h-full group hover:border-primary/40 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-primary/5 ${featured ? 'ring-1 ring-amber-500/30 bg-gradient-to-b from-amber-500/[0.03] to-transparent' : ''}`}>
        <CardHeader className="pb-3">
          {/* Badges Row */}
          <div className="flex items-center gap-1.5 mb-1">
            {featured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                Featured
              </span>
            )}
            {isBestSeller && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">
                Best Seller
              </span>
            )}
            {isTopRated && !isBestSeller && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/30">
                Top Rated
              </span>
            )}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ml-auto ${catConfig.color}`}>
              {catConfig.icon} {catConfig.label}
            </span>
          </div>

          <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-1">
            {p.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 text-xs">
            {p.description || 'No description'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* System Prompt Preview (blurred) */}
          {p.systemPrompt && (
            <div className="relative rounded-lg overflow-hidden border border-border/30">
              <div className="p-3 max-h-[72px] overflow-hidden">
                <p className="text-[10px] text-muted-foreground/70 font-mono leading-relaxed select-none" style={{ filter: 'blur(3px)' }}>
                  {p.systemPrompt.slice(0, 300)}...
                </p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background flex items-end justify-center pb-2">
                <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Purchase to unlock full prompt
                </span>
              </div>
            </div>
          )}

          {/* Preview Chat Bubble */}
          {p.previewMessages && p.previewMessages.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
              {p.previewMessages.slice(0, 2).map((msg, i) => (
                <div key={i} className={`text-[11px] ${i > 0 ? 'mt-2 pt-2 border-t border-border/20' : ''}`}>
                  <span className={`font-semibold ${msg.role === 'user' ? 'text-blue-400' : 'text-amber-400'}`}>
                    {msg.role === 'user' ? 'You' : 'AI'}:
                  </span>{' '}
                  <span className="text-muted-foreground line-clamp-2">{msg.content}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tools as colored badges */}
          {p.tools && p.tools.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.tools.map((t) => {
                const toolColor = TOOL_COLORS[t] || 'bg-muted text-muted-foreground border-border';
                const toolLabel = TOOL_LABELS[t] || t;
                return (
                  <span key={t} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${toolColor}`}>
                    {toolLabel}
                  </span>
                );
              })}
            </div>
          )}

          <Separator className="my-1" />

          {/* Price + Stats Row */}
          <div className="flex items-center gap-3">
            {/* Price - prominent */}
            <div className="flex items-baseline gap-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <span className={`font-bold ${priceNum >= 150 ? 'text-lg' : 'text-base'} text-amber-500`}>{p.price}</span>
              <span className="text-[10px] text-amber-500/70 font-semibold">BBAI</span>
            </div>

            {/* Stats */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="text-center p-1.5 rounded-lg bg-muted/50">
                <div className="text-xs font-bold">{(p.totalSales || 0).toLocaleString()}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Sales</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-muted/50">
                <div className="text-xs font-bold">{(p.rating || 0).toFixed(1)}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Rating</div>
              </div>
            </div>
          </div>

          {/* Rating + Creator */}
          <div className="flex items-center justify-between">
            <StarRating rating={p.rating || 0} count={p.ratingCount || 0} />
            <span className="text-[10px] text-muted-foreground">
              by <span className="font-medium text-foreground/70">{p.creatorName || 'Anonymous'}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
