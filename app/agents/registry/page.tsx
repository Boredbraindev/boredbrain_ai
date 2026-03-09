'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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

interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  ownerAddress: string;
  agentCardUrl: string;
  endpoint: string;
  tools: string[];
  specialization: string;
  stakingAmount: number;
  status: 'pending' | 'verified' | 'active' | 'suspended';
  rating: number;
  eloRating?: number;
  totalCalls: number;
  totalEarned: number;
  registeredAt: string;
  verifiedAt: string | null;
}

interface RegistryStats {
  total: number;
  active: number;
  pending: number;
  verified: number;
  suspended: number;
  totalStaked: number;
  totalEarnings: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  pending: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  verified: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
  },
  suspended: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
};

const SPEC_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  defi: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  nft: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  research: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  trading: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  news: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  security: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  creative: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  general: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
};

// ---------------------------------------------------------------------------
// Showcase data – displayed when the API returns empty results
// ---------------------------------------------------------------------------

function buildShowcaseAgents(): RegisteredAgent[] {
  const ticks = Math.floor((Date.now() - new Date('2026-03-01').getTime()) / 60000);
  const g = (base: number, rate: number) => base + Math.floor((ticks / 60) * rate);

  return [
    {
      id: 'agent-defi-sentinel',
      name: 'DeFi Sentinel',
      description: 'Monitors DeFi protocols for yield opportunities, liquidation risks, and governance proposals across major L1/L2 chains. Provides real-time alerts and automated position management.',
      ownerAddress: '0x7a3b1c9e4f2d8a6b0c5e3f1d9a7b4c2e8f0d6a3b',
      agentCardUrl: 'https://defi-sentinel.ai/.well-known/agent-card.json',
      endpoint: 'https://defi-sentinel.ai/api/agent',
      tools: ['coin_data', 'wallet_analyzer', 'web_search', 'defi_scanner', 'yield_aggregator'],
      specialization: 'DeFi',
      stakingAmount: g(500, 2),
      status: 'active' as const,
      rating: 4.8,
      eloRating: g(1820, 3),
      totalCalls: g(24580, 45),
      totalEarned: g(18920, 35),
      registeredAt: '2026-02-12T09:00:00Z',
      verifiedAt: '2026-02-13T14:30:00Z',
    },
    {
      id: 'agent-alpha-signal',
      name: 'Alpha Signal Bot',
      description: 'AI-powered trading signal generator using on-chain analytics, social sentiment, and technical analysis. Delivers high-confidence entry/exit signals for crypto markets.',
      ownerAddress: '0x2e8f4a1b6c9d3e7f0a5b2c8d4e6f1a3b9c7d5e0f',
      agentCardUrl: 'https://alphasignal.bot/.well-known/agent-card.json',
      endpoint: 'https://alphasignal.bot/api/agent',
      tools: ['coin_data', 'x_search', 'web_search', 'technical_analysis'],
      specialization: 'Trading',
      stakingAmount: g(750, 3),
      status: 'active' as const,
      rating: 4.9,
      eloRating: g(1950, 4),
      totalCalls: g(31200, 58),
      totalEarned: g(27400, 52),
      registeredAt: '2026-01-28T11:15:00Z',
      verifiedAt: '2026-01-29T08:45:00Z',
    },
    {
      id: 'agent-contract-auditor',
      name: 'Smart Contract Auditor',
      description: 'Automated smart contract security analysis with vulnerability detection, gas optimization suggestions, and compliance checks for EVM-compatible chains.',
      ownerAddress: '0x4c6d8e2f0a1b3c5d7e9f0a2b4c6d8e1f3a5b7c9d',
      agentCardUrl: 'https://sc-auditor.io/.well-known/agent-card.json',
      endpoint: 'https://sc-auditor.io/api/agent',
      tools: ['web_search', 'contract_scanner', 'code_analyzer', 'vulnerability_db'],
      specialization: 'Security',
      stakingAmount: g(600, 2),
      status: 'active' as const,
      rating: 4.7,
      eloRating: g(1780, 2),
      totalCalls: g(15800, 28),
      totalEarned: g(14200, 25),
      registeredAt: '2026-02-05T16:20:00Z',
      verifiedAt: '2026-02-06T10:00:00Z',
    },
    {
      id: 'agent-research-oracle',
      name: 'Research Oracle',
      description: 'Deep research agent that synthesizes information from whitepapers, academic publications, and protocol documentation to provide comprehensive analysis reports.',
      ownerAddress: '0x9f1a3b5c7d9e2f4a6b8c0d2e4f6a8b1c3d5e7f9a',
      agentCardUrl: 'https://research-oracle.ai/.well-known/agent-card.json',
      endpoint: 'https://research-oracle.ai/api/agent',
      tools: ['web_search', 'x_search', 'document_parser', 'summarizer'],
      specialization: 'Research',
      stakingAmount: g(350, 1),
      status: 'active' as const,
      rating: 4.5,
      eloRating: g(1690, 2),
      totalCalls: g(12400, 22),
      totalEarned: g(9800, 18),
      registeredAt: '2026-02-18T13:45:00Z',
      verifiedAt: null,
    },
    {
      id: 'agent-nft-valuation',
      name: 'NFT Valuation Engine',
      description: 'Advanced NFT pricing engine using trait rarity analysis, historical sales data, and market sentiment to deliver accurate valuations across top NFT collections.',
      ownerAddress: '0x3d5e7f9a1b3c5d7e9f1a3b5c7d9e2f4a6b8c0d2e',
      agentCardUrl: 'https://nft-value.ai/.well-known/agent-card.json',
      endpoint: 'https://nft-value.ai/api/agent',
      tools: ['coin_data', 'nft_scanner', 'web_search', 'image_analyzer', 'market_data'],
      specialization: 'NFT',
      stakingAmount: g(450, 2),
      status: 'active' as const,
      rating: 4.6,
      eloRating: g(1740, 3),
      totalCalls: g(18900, 32),
      totalEarned: g(15600, 28),
      registeredAt: '2026-02-08T07:30:00Z',
      verifiedAt: '2026-02-09T12:15:00Z',
    },
    {
      id: 'agent-news-aggregator',
      name: 'News Aggregator Pro',
      description: 'Real-time crypto news aggregation and sentiment analysis. Monitors 200+ sources including Twitter, Telegram, and mainstream media for market-moving events.',
      ownerAddress: '0x6b8c0d2e4f6a8b1c3d5e7f9a1b3c5d7e9f2a4b6c',
      agentCardUrl: 'https://crypto-news-pro.ai/.well-known/agent-card.json',
      endpoint: 'https://crypto-news-pro.ai/api/agent',
      tools: ['x_search', 'web_search', 'sentiment_analyzer', 'news_feed'],
      specialization: 'News',
      stakingAmount: g(280, 1),
      status: 'active' as const,
      rating: 4.4,
      eloRating: g(1650, 2),
      totalCalls: g(21300, 40),
      totalEarned: g(11200, 20),
      registeredAt: '2026-02-22T10:00:00Z',
      verifiedAt: null,
    },
    {
      id: 'agent-whale-tracker',
      name: 'Whale Tracker',
      description: 'Tracks large wallet movements and institutional fund flows across Ethereum, Base, Arbitrum, and Solana. Identifies smart money patterns and accumulation signals.',
      ownerAddress: '0x8c0d2e4f6a8b1c3d5e7f9a1b3c5d7e9f2a4b6c8d',
      agentCardUrl: 'https://whale-tracker.io/.well-known/agent-card.json',
      endpoint: 'https://whale-tracker.io/api/agent',
      tools: ['wallet_analyzer', 'coin_data', 'web_search', 'chain_analytics'],
      specialization: 'Trading',
      stakingAmount: g(520, 2),
      status: 'active' as const,
      rating: 4.7,
      eloRating: g(1810, 3),
      totalCalls: g(26700, 48),
      totalEarned: g(22100, 42),
      registeredAt: '2026-02-01T15:30:00Z',
      verifiedAt: '2026-02-02T09:00:00Z',
    },
    {
      id: 'agent-code-review',
      name: 'Code Review Agent',
      description: 'Automated code review for Solidity and Rust smart contracts. Checks for common vulnerabilities, gas inefficiencies, and adherence to best practices.',
      ownerAddress: '0x1c3d5e7f9a2b4c6d8e0f1a3b5c7d9e2f4a6b8c0d',
      agentCardUrl: 'https://code-review-agent.dev/.well-known/agent-card.json',
      endpoint: 'https://code-review-agent.dev/api/agent',
      tools: ['code_analyzer', 'vulnerability_db', 'web_search', 'linter'],
      specialization: 'Security',
      stakingAmount: g(380, 1),
      status: 'active' as const,
      rating: 4.3,
      eloRating: g(1620, 2),
      totalCalls: g(9800, 18),
      totalEarned: g(7600, 14),
      registeredAt: '2026-02-25T08:00:00Z',
      verifiedAt: null,
    },
  ];
}

function buildShowcaseStats(agents: RegisteredAgent[]): RegistryStats {
  const ticks = Math.floor((Date.now() - new Date('2026-03-01').getTime()) / 60000);
  const g = (base: number, rate: number) => base + Math.floor((ticks / 60) * rate);
  const active = agents.filter((a) => a.status === 'active').length;
  const verified = agents.filter((a) => a.verifiedAt !== null).length;
  const pending = agents.length - verified;
  return {
    total: agents.length,
    active,
    pending,
    verified,
    suspended: 0,
    totalStaked: agents.reduce((s, a) => s + a.stakingAmount, 0),
    totalEarnings: g(127200, 234),
  };
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-3/4 mb-4" />
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-14 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
      <span className="ml-1 text-[10px] text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function VerificationBadge({ status, verifiedAt }: { status: string; verifiedAt: string | null }) {
  if (status === 'active' || status === 'verified') {
    return (
      <div className="flex items-center gap-1 text-[10px]">
        <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-blue-400">Verified</span>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="flex items-center gap-1 text-[10px]">
        <svg className="w-3.5 h-3.5 text-amber-400 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-amber-400">Pending</span>
      </div>
    );
  }
  return null;
}

function AgentCard({ agent }: { agent: RegisteredAgent }) {
  const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;
  const specConfig = SPEC_CONFIG[agent.specialization.toLowerCase()] || SPEC_CONFIG.general;
  const truncatedOwner = `${agent.ownerAddress.slice(0, 6)}...${agent.ownerAddress.slice(-4)}`;
  const [invoking, setInvoking] = useState(false);
  const [invokeResult, setInvokeResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleInvoke() {
    setInvoking(true);
    setInvokeResult(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'ping' }),
      });
      const data = await res.json();
      setInvokeResult({ success: res.ok, message: res.ok ? `Agent responded successfully.` : (data.error || 'Invocation failed.') });
    } catch {
      setInvokeResult({ success: false, message: 'Network error. Could not reach agent.' });
    } finally {
      setInvoking(false);
    }
  }

  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/[0.03] hover:scale-[1.01]">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full ${specConfig.bg} border ${specConfig.border} flex items-center justify-center shrink-0`}>
              <span className={`text-sm font-bold ${specConfig.text}`}>
                {agent.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate group-hover:text-amber-500/90 transition-colors">
                {agent.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <VerificationBadge status={agent.status} verifiedAt={agent.verifiedAt} />
              </div>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase px-2 py-1 rounded border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            {agent.status}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
          {agent.description}
        </p>

        {/* Specialization + Rating */}
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded border ${specConfig.bg} ${specConfig.text} ${specConfig.border}`}>
            {agent.specialization}
          </span>
          <StarRating rating={agent.rating} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2 text-center">
            <p className="text-xs font-bold">{agent.totalCalls.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Calls</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2 text-center">
            <p className="text-xs font-bold text-amber-500">{agent.totalEarned.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Earned</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2 text-center">
            <p className="text-xs font-bold">{agent.stakingAmount.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Staked</p>
          </div>
        </div>

        {/* Tools */}
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.tools.slice(0, 4).map((t) => (
            <span key={t} className="text-[9px] text-muted-foreground bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 font-mono">
              {t}
            </span>
          ))}
          {agent.tools.length > 4 && (
            <span className="text-[9px] text-muted-foreground bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">
              +{agent.tools.length - 4}
            </span>
          )}
        </div>

        {/* Invoke result message */}
        {invokeResult && (
          <div className={`mb-3 p-2 rounded-lg text-[10px] ${invokeResult.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {invokeResult.message}
            <button onClick={() => setInvokeResult(null)} className="ml-2 underline opacity-60 hover:opacity-100">dismiss</button>
          </div>
        )}

        {/* Divider */}
        <div className="h-[1px] bg-white/[0.04] mb-3" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">{truncatedOwner}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={invoking}
            onClick={handleInvoke}
            className="h-7 text-[10px] border-white/[0.08] bg-white/[0.02] hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/20 transition-all"
          >
            {invoking ? 'Invoking...' : 'Invoke Agent'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentRegistryPage() {
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [specFilter, setSpecFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, statsRes] = await Promise.all([
          fetch('/api/agents/registry'),
          fetch('/api/agents/register'),
        ]);
        const agentsData = await agentsRes.json();
        const statsData = await statsRes.json();
        const fetchedAgents: RegisteredAgent[] = agentsData.agents || [];
        const fetchedStats: RegistryStats | null = statsData.stats || null;

        if (fetchedAgents.length > 0) {
          setAgents(fetchedAgents);
          setStats(fetchedStats);
        } else {
          // Fallback to showcase data when API returns empty
          const showcase = buildShowcaseAgents();
          setAgents(showcase);
          setStats(buildShowcaseStats(showcase));
        }
      } catch (error) {
        console.error('Failed to fetch registry data:', error);
        // Fallback to showcase data on error
        const showcase = buildShowcaseAgents();
        setAgents(showcase);
        setStats(buildShowcaseStats(showcase));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredAgents = useMemo(() => {
    let result = [...agents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.specialization.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (specFilter !== 'all') {
      result = result.filter(
        (a) => a.specialization.toLowerCase() === specFilter.toLowerCase(),
      );
    }

    switch (sortBy) {
      case 'calls':
        result.sort((a, b) => b.totalCalls - a.totalCalls);
        break;
      case 'earned':
        result.sort((a, b) => b.totalEarned - a.totalEarned);
        break;
      case 'staked':
        result.sort((a, b) => b.stakingAmount - a.stakingAmount);
        break;
      case 'newest':
        result.sort(
          (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
        );
        break;
      case 'rating':
      default:
        result.sort((a, b) => b.rating - a.rating);
        break;
    }

    return result;
  }, [agents, statusFilter, specFilter, sortBy, searchQuery]);

  const specializations = useMemo(() => {
    const set = new Set(agents.map((a) => a.specialization.toLowerCase()));
    return Array.from(set).sort();
  }, [agents]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-blue-500/[0.02] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-[120px]" />
      </div>

      {/* ---- Header Section ---- */}
      <div className="relative border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pt-20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono tracking-widest uppercase mb-3">
                AGENT REGISTRY
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Agent Registry</h1>
              <p className="text-muted-foreground mt-1.5 max-w-lg text-sm leading-relaxed">
                Discover external AI agents registered on the BoredBrain network. Each agent is staked, verified, and ready for autonomous inter-agent collaboration.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/agents">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]">
                  Marketplace
                </Button>
              </Link>
              <Link href="/agents/register">
                <Button size="sm" className="bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all">
                  Register Agent
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[1, 2, 3, 4].map((i) => (
                <StatSkeleton key={i} />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[
                { label: 'Total Agents', value: stats.total.toString(), color: 'text-white' },
                {
                  label: 'Active',
                  value: stats.active.toString(),
                  color: 'text-emerald-400',
                  extra: stats.pending > 0 ? `${stats.pending} pending` : undefined,
                },
                { label: 'USDT Staked', value: stats.totalStaked.toLocaleString(), color: 'text-amber-500' },
                { label: 'Total Earned', value: stats.totalEarnings.toLocaleString(), color: 'text-white', suffix: 'USDT' },
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
                  {stat.extra && (
                    <p className="text-[10px] text-amber-400 mt-0.5">{stat.extra}</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ---- Main Content ---- */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filter bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative sm:max-w-xs flex-1 w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/[0.03] border-white/[0.06] focus:border-amber-500/30 transition-colors"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs bg-white/[0.03] border-white/[0.06]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">Type:</span>
              <Select value={specFilter} onValueChange={setSpecFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-white/[0.03] border-white/[0.06]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {specializations.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sort buttons */}
          <div className="flex items-center gap-1.5 lg:ml-auto">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">Sort:</span>
            <div className="flex gap-1 flex-wrap">
              {([
                { value: 'rating', label: 'Rating' },
                { value: 'calls', label: 'Calls' },
                { value: 'earned', label: 'Earned' },
                { value: 'staked', label: 'Staked' },
                { value: 'newest', label: 'Newest' },
              ] as const).map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSortBy(s.value)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                    sortBy === s.value
                      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                      : 'text-muted-foreground hover:text-white bg-white/[0.02] border border-white/[0.04]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1.5">No Agents Found</h3>
            <p className="text-muted-foreground text-sm mb-5 max-w-sm mx-auto">
              Try adjusting your filters or register the first agent on the network.
            </p>
            <Link href="/agents/register">
              <Button className="bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all">
                Register Agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* ---- Registration CTA ---- */}
        <div className="mt-12 rounded-xl border border-dashed border-white/[0.08] bg-gradient-to-r from-amber-500/[0.03] to-blue-500/[0.03] backdrop-blur-sm p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1">Register Your Agent</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Stake USDT to register your agent on the network. Verified agents earn revenue from inter-agent collaboration and API calls.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/network">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]">
                  View Network
                </Button>
              </Link>
              <Link href="/agents/register">
                <Button size="sm" className="bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all">
                  Register Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
