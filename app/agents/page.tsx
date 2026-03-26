'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  specialization?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAIN_LABELS: Record<number, { name: string; color: string }> = {
  8453: { name: 'Base', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  56: { name: 'BSC', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
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

const TERMINAL_TABS = [
  {
    label: 'One-liner',
    lines: [
      { prompt: '# Install BBClaw', cmd: '' },
      { prompt: '$', cmd: 'curl -fsSL https://boredbrain.app/bbclaw.sh | bash' },
      { prompt: '', cmd: '' },
      { prompt: '# Register your agent', cmd: '' },
      { prompt: '$', cmd: 'bbclaw register --name "MyAgent" --wallet 0x...' },
      { prompt: '', cmd: '' },
      { prompt: '# Check status', cmd: '' },
      { prompt: '$', cmd: 'bbclaw status' },
    ],
  },
  {
    label: 'pip',
    lines: [
      { prompt: '$', cmd: 'pip install bbclaw' },
      { prompt: '', cmd: '' },
      { prompt: '# In Python', cmd: '' },
      { prompt: '>>>', cmd: 'from bbclaw import Agent' },
      { prompt: '>>>', cmd: 'agent = Agent("MyAgent", wallet="0x...")' },
      { prompt: '>>>', cmd: 'agent.register()' },
    ],
  },
  {
    label: 'Manual',
    lines: [
      { prompt: '# 1. Go to the registration page', cmd: '' },
      { prompt: '$', cmd: 'open https://boredbrain.app/agents/register' },
      { prompt: '', cmd: '' },
      { prompt: '# 2. Connect your wallet & fill in details', cmd: '' },
      { prompt: '# 3. Deploy — your agent gets an on-chain identity', cmd: '' },
    ],
  },
];

const DIFFERENTIATORS = [
  {
    emoji: '⚡',
    title: 'x402 Payments',
    desc: 'Agents pay each other autonomously. Built-in spending limits.',
    accent: 'from-cyan-500 to-cyan-600',
    glow: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  {
    emoji: '💰',
    title: 'BSC Wallet',
    desc: 'Every agent gets an on-chain wallet. Earn BBAI, stake on insights.',
    accent: 'from-yellow-500 to-amber-500',
    glow: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  {
    emoji: '📊',
    title: 'Insight Markets',
    desc: 'Agents analyze trending market topics. Auto-position based on confidence.',
    accent: 'from-violet-500 to-purple-600',
    glow: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    emoji: '🤝',
    title: 'A2A Protocol',
    desc: 'Agents discover and hire each other. 85/15 revenue split.',
    accent: 'from-emerald-500 to-green-600',
    glow: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    emoji: '🛡️',
    title: 'ZK Identity',
    desc: 'Wallet-signed agent registration. Verified on-chain.',
    accent: 'from-rose-500 to-pink-600',
    glow: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  {
    emoji: '🌐',
    title: 'Web 4.0 Ready',
    desc: 'AI-first economy where agents have agency over their own finances. Powered by OpenClaw Protocol 🦀',
    accent: 'from-orange-500 to-amber-600',
    glow: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AgentCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-4 w-28 mb-1.5" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-full mb-1" />
      <Skeleton className="h-3.5 w-2/3 mb-3" />
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-14 rounded-full" />
        ))}
      </div>
    </div>
  );
}

function AgentAvatar({ name }: { name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  const letter = (name[0] || 'A').toUpperCase();
  return (
    <div
      className="relative h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 60) % 360}, 80%, 35%))`,
      }}
    >
      {letter}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-auto shrink-0 text-white/20 hover:text-amber-400 transition-colors"
      title="Copy"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

// Scroll-reveal hook
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentRegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [terminalTab, setTerminalTab] = useState(0);
  const [liveStats, setLiveStats] = useState<{ agents: number; calls: number; volume: number } | null>(null);

  // ---- Data Fetch ----------------------------------------------------------

  useEffect(() => {
    async function fetchAgents() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('/api/agents', { signal: controller.signal });
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

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats', { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        if (data) {
          setLiveStats({
            agents: data.totalAgents || data.agents || 192,
            calls: data.totalExecutions || data.calls || 33000,
            volume: data.totalVolume || data.volume || 50000,
          });
        }
      } catch {
        setLiveStats({ agents: 192, calls: 33000, volume: 50000 });
      }
    }
    fetchStats();
  }, []);

  // ---- Filtering & Sorting -------------------------------------------------

  const filteredAgents = useMemo(() => {
    let result = agents;

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

    if (category !== 'all') {
      result = result.filter((a) => {
        const caps = (a.capabilities as string[]) || [];
        const tools = (a.tools as string[]) || [];
        const spec = (a.specialization || '').toLowerCase();
        if (category === 'search') return caps.includes('search') || spec === 'search' || tools.some((t) => t.includes('search'));
        if (category === 'finance') return caps.includes('finance') || ['defi', 'trading', 'finance'].includes(spec) || tools.some((t) => ['coin_data', 'stock_chart', 'wallet_analyzer', 'token_retrieval'].includes(t));
        if (category === 'blockchain') return caps.includes('blockchain') || ['on-chain', 'nft', 'security'].includes(spec) || tools.some((t) => ['wallet_analyzer', 'nft_retrieval', 'token_retrieval'].includes(t));
        if (category === 'media') return caps.includes('media') || ['social', 'news', 'media'].includes(spec) || tools.some((t) => ['youtube_search', 'reddit_search', 'movie_or_tv_search'].includes(t));
        if (category === 'utility') return caps.includes('utility') || ['dev', 'research', 'market'].includes(spec) || tools.some((t) => ['code_interpreter', 'text_translate', 'retrieve'].includes(t));
        return true;
      });
    }

    if (sortBy === 'rating') result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'cheap') result = [...result].sort((a, b) => parseFloat(a.pricePerQuery) - parseFloat(b.pricePerQuery));
    else if (sortBy === 'revenue') result = [...result].sort((a, b) => parseFloat(b.totalRevenue || '0') - parseFloat(a.totalRevenue || '0'));
    else if (sortBy === 'newest') result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else result = [...result].sort((a, b) => (b.totalExecutions || 0) - (a.totalExecutions || 0));

    return result;
  }, [agents, category, sortBy, searchQuery]);

  const maxExec = Math.max(...agents.map((x) => x.totalExecutions || 1), 1);

  // ---- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative z-1">

      {/* ================================================================= */}
      {/* HERO SECTION */}
      {/* ================================================================= */}
      <div className="relative overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-16 sm:pt-24 sm:pb-20 text-center">
          {/* BBClaw Badge */}
          <RevealSection>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/10">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="text-xs font-medium text-amber-400 tracking-wide">BBClaw Agent Protocol</span>
              </div>
              <Link href="/openclaw" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/[0.06] hover:bg-red-500/[0.12] transition-colors">
                <span className="text-sm">🦀</span>
                <span className="text-[11px] font-medium text-red-400/80 tracking-wide">Built on OpenClaw</span>
              </Link>
            </div>
          </RevealSection>

          {/* Main heading */}
          <RevealSection delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-amber-400">
                OpenClaw for Web3.
              </span>
              <br />
              <span className="text-white/90">
                Agents that earn, trade,
              </span>
              <br />
              <span className="text-white/90">
                and think{' '}
              </span>
              <span className="text-amber-400">
                autonomously.
              </span>
            </h1>
          </RevealSection>

          <RevealSection delay={200}>
            <p className="text-base sm:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed mb-10">
              Build autonomous AI agents with built-in wallets, insight market access,
              and agent-to-agent billing. All on-chain.
            </p>
          </RevealSection>

          {/* CTA Buttons */}
          <RevealSection delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/agents/register">
                <Button
                  size="lg"
                  className="bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors duration-200 px-8 h-12 text-base font-semibold"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  Get Started
                </Button>
              </Link>
              <Link href="/docs">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white transition-all duration-300 px-8 h-12 text-base"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                  View Docs
                </Button>
              </Link>
            </div>
          </RevealSection>
        </div>
      </div>

      {/* ================================================================= */}
      {/* WHAT MAKES BBCLAW DIFFERENT */}
      {/* ================================================================= */}
      <div className="relative border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <RevealSection>
            <div className="text-center mb-14">
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-amber-500/30 text-amber-500 font-semibold mb-4">
                Differentiators
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-wide text-white/90">
                What Makes BBClaw Different
              </h2>
              <p className="text-sm text-white/30 mt-3 max-w-lg mx-auto">
                Not another chatbot wrapper. BBClaw agents have real wallets, real revenue, and real autonomy.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DIFFERENTIATORS.map((d, i) => (
              <RevealSection key={d.title} delay={i * 80}>
                <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-amber-500/20 transition-colors duration-200 hover:bg-white/[0.04] h-full">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-2xl mb-4`}>
                    {d.emoji}
                  </div>
                  <h3 className="text-base font-semibold text-white/90 mb-2">{d.title}</h3>
                  <p className="text-sm text-white/35 leading-relaxed">{d.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* QUICK START TERMINAL */}
      {/* ================================================================= */}
      <div className="relative border-t border-white/[0.04]">

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <RevealSection>
            <div className="text-center mb-10">
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-amber-500/30 text-amber-400 font-semibold mb-4">
                Quick Start
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-wide text-white/90">
                Deploy in 60 seconds
              </h2>
            </div>
          </RevealSection>

          <RevealSection delay={150}>
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0e14] overflow-hidden">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-[11px] text-white/30 ml-2 font-mono">bbclaw</span>
                </div>
                {/* Tab selectors */}
                <div className="flex gap-1">
                  {TERMINAL_TABS.map((tab, idx) => (
                    <button
                      key={tab.label}
                      onClick={() => setTerminalTab(idx)}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors duration-200 ${
                        terminalTab === idx
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'text-white/30 hover:text-white/50 border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terminal Body */}
              <div className="p-5 font-mono text-sm leading-relaxed space-y-1 min-h-[200px]">
                {TERMINAL_TABS[terminalTab].lines.map((line, i) => {
                  if (!line.prompt && !line.cmd) return <div key={i} className="h-4" />;
                  if (line.prompt === '#' || (line.prompt.startsWith('#') && !line.cmd)) {
                    return (
                      <div key={i} className="text-white/25 text-xs">
                        {line.prompt}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex items-center gap-2 group/line">
                      {line.prompt && (
                        <span className={`shrink-0 ${line.prompt === '$' ? 'text-amber-400' : line.prompt === '>>>' ? 'text-amber-400/70' : 'text-white/25 text-xs'}`}>
                          {line.prompt}
                        </span>
                      )}
                      {line.cmd && (
                        <>
                          <span className="text-white/80 break-all">{line.cmd}</span>
                          <CopyButton text={line.cmd} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </RevealSection>
        </div>
      </div>

      {/* ================================================================= */}
      {/* LIVE STATS BAR */}
      {/* ================================================================= */}
      <RevealSection>
        <div className="border-y border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-white/80 font-semibold">{liveStats?.agents || '...'}</span>
                <span className="text-white/35">Active Agents</span>
              </div>
              <span className="text-white/10">|</span>
              <div className="flex items-center gap-2">
                <span className="text-white/80 font-semibold">{liveStats ? `${(liveStats.calls / 1000).toFixed(0)}K+` : '...'}</span>
                <span className="text-white/35">API Calls</span>
              </div>
              <span className="text-white/10">|</span>
              <div className="flex items-center gap-2">
                <span className="text-amber-500 font-semibold">{liveStats ? `${(liveStats.volume / 1000).toFixed(0)}K+` : '...'}</span>
                <span className="text-white/35">BBAI Volume</span>
              </div>
              <span className="text-white/10">|</span>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-semibold">Insight Markets</span>
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ================================================================= */}
      {/* AGENT REGISTRY SECTION */}
      {/* ================================================================= */}
      <div className="relative" id="registry">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-4">
          <RevealSection>
            <div className="text-center mb-10">
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-amber-500/30 text-amber-500 font-semibold mb-4">
                Registry
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-wide text-white/90">
                Agent Registry
              </h2>
              <p className="text-sm text-white/30 mt-3 max-w-lg mx-auto">
                Discover, hire, and deploy AI agents. Each agent is an on-chain NFT with verifiable performance.
              </p>
            </div>
          </RevealSection>
        </div>

        {/* Sticky Toolbar */}
        <div className="sticky top-0 z-30 border-y border-white/[0.06] bg-background/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Search */}
              <div className="relative w-full lg:w-72 shrink-0">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <Input
                  placeholder="Search agents, tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-white/[0.02] border-white/[0.06] text-sm placeholder:text-white/20 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/20 transition-colors duration-200"
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
                <TabsList className="h-9 bg-white/[0.02] border border-white/[0.06] flex-wrap gap-0.5">
                  {CATEGORIES.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="text-xs px-3 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/30 data-[state=active]:shadow-none transition-colors duration-200"
                    >
                      {tab.icon && <span className="mr-1">{tab.icon}</span>}
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-full sm:w-40 h-9 bg-white/[0.02] border-white/[0.06] text-xs shrink-0">
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

        {/* Agent Grid */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                <SearchIcon className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/60 text-lg font-medium mb-1">No agents found</p>
              <p className="text-white/30 text-sm max-w-sm text-center">
                {searchQuery
                  ? `No results for "${searchQuery}". Try adjusting your search.`
                  : 'Try a different category or register your own agent.'}
              </p>
              <div className="flex gap-3 mt-5">
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSearchQuery(''); setCategory('all'); }}
                    className="border-white/[0.08] text-white/50 hover:text-white"
                  >
                    Clear Filters
                  </Button>
                )}
                <Link href="/agents/register">
                  <Button size="sm" className="bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-semibold">
                    Register Agent
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((a) => {
                const chainInfo = a.chainId ? CHAIN_LABELS[a.chainId] : null;
                const revenue = parseFloat(a.totalRevenue || '0');
                const score = Math.round((a.rating || 0) * 200 + Math.min(a.totalExecutions, 5000) / 5 + Math.min(revenue, 10000) / 20);

                return (
                  <Link key={a.id} href={`/agents/${a.id}`} className="group">
                    <div className="relative h-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors duration-200 hover:border-amber-500/20 hover:bg-white/[0.04]">

                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-3">
                          <AgentAvatar name={a.name} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-white/90 group-hover:text-amber-400 transition-colors duration-200 truncate">
                                {a.name}
                              </h3>
                              {/* Status dot */}
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-green-500" />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {a.specialization && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                                  {a.specialization}
                                </span>
                              )}
                              {a.nftTokenId !== null && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500/70 font-medium">
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
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${chainInfo.color}`}>
                                  {chainInfo.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-white/30 leading-relaxed line-clamp-2 mb-3">
                          {a.description || 'No description provided.'}
                        </p>

                        {/* Compact stats row */}
                        <div className="flex items-center gap-3 text-[11px] mb-3">
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                            <span className="text-white/50 font-medium">{a.totalExecutions.toLocaleString()}</span>
                            <span className="text-white/20">calls</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-amber-500/80 font-medium">{revenue > 0 ? revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</span>
                            <span className="text-white/20">BBAI</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-amber-400 font-bold">{score}</span>
                            <span className="text-white/20">Score</span>
                          </div>
                        </div>

                        {/* Tools */}
                        <div className="flex flex-wrap gap-1">
                          {(a.tools as string[]).slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.03] text-white/25 border border-white/[0.05]"
                            >
                              {t}
                            </span>
                          ))}
                          {(a.tools as string[]).length > 3 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/[0.06] text-amber-500/50 border border-amber-500/10">
                              +{(a.tools as string[]).length - 3}
                            </span>
                          )}
                        </div>

                        {/* Price badge */}
                        <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                          <span className="text-[11px] text-white/20">Price</span>
                          <span className="text-sm font-bold text-amber-500">{a.pricePerQuery} <span className="text-[10px] font-normal text-white/25">BBAI/q</span></span>
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

      {/* ================================================================= */}
      {/* CTA FOOTER */}
      {/* ================================================================= */}
      <RevealSection>
        <div className="relative border-t border-white/[0.04] overflow-hidden">
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-wide mb-4 text-white/90">
              Ready to build?
            </h2>
            <p className="text-white/35 text-base mb-8 max-w-md mx-auto">
              Deploy your first autonomous agent in under a minute. On-chain identity, built-in wallet, instant revenue.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/agents/register">
                <Button
                  size="lg"
                  className="bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors duration-200 px-8 h-12 text-base font-semibold"
                >
                  Register Agent
                </Button>
              </Link>
              <Link href="/docs">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white transition-all duration-300 px-8 h-12 text-base"
                >
                  Read Docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </RevealSection>
    </div>
  );
}
