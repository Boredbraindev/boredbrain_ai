'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentListing {
  agentId: string;
  name: string;
  description: string;
  longDescription: string;
  specialization: string;
  tools: string[];
  pricing: {
    perCall: number;
    subscription: number | null;
  };
  rating: number;
  reviewCount: number;
  totalCalls: number;
  successRate: number;
  avgResponseTime: number;
  featured: boolean;
  verified: boolean;
  createdAt: string;
  tags: string[];
  developer: {
    address: string;
    name: string;
    agentCount: number;
  };
}

interface MarketplaceStats {
  totalAgents: number;
  totalCalls: number;
  totalVolume: number;
  avgRating: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPECIALIZATIONS = [
  { value: 'all', label: 'All Agents', icon: '{}' },
  { value: 'DeFi', label: 'DeFi', icon: '{}' },
  { value: 'NFT', label: 'NFT', icon: '{}' },
  { value: 'Research', label: 'Research', icon: '{}' },
  { value: 'Trading', label: 'Trading', icon: '{}' },
  { value: 'News', label: 'News', icon: '{}' },
  { value: 'Security', label: 'Security', icon: '{}' },
];

const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'calls', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'price-low', label: 'Lowest Price' },
  { value: 'fastest', label: 'Fastest' },
  { value: 'success', label: 'Highest Success' },
  { value: 'newest', label: 'Newest' },
  { value: 'earned', label: 'Top Earned' },
  { value: 'price-high', label: 'Price: High to Low' },
];

/** Generate a deterministic mock weekly growth % for a showcase agent. */
function getWeeklyGrowth(agent: AgentListing): number {
  // Deterministic seed from agentId
  let seed = 0;
  for (let i = 0; i < agent.agentId.length; i++) {
    seed = ((seed << 5) - seed + agent.agentId.charCodeAt(i)) | 0;
  }
  const base = Math.abs(seed) % 30; // 0-29
  // Higher-rated & higher-call agents trend hotter
  const boost = Math.floor(agent.rating * 2 + agent.totalCalls / 50000);
  return Math.max(2, Math.min(45, base + boost));
}

/** Compute a trending score combining recency, calls, rating, and success. */
function trendingScore(agent: AgentListing): number {
  const ageMs = Date.now() - new Date(agent.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 1 - ageDays / 365); // newer = higher
  return (
    agent.totalCalls * 0.4 +
    agent.rating * 10000 * 0.2 +
    agent.successRate * 100 * 0.15 +
    recencyBoost * 50000 * 0.15 +
    (agent.featured ? 20000 : 0) * 0.1
  );
}

const MAX_COMPARE = 3;

// ---------------------------------------------------------------------------
// Showcase agents — displayed when the API returns no listings
// ---------------------------------------------------------------------------
const SHOWCASE_AGENTS: AgentListing[] = [
  {
    agentId: 'showcase-defi-sentinel',
    name: 'DeFi Sentinel',
    description: 'Real-time DeFi monitoring agent that tracks yield opportunities, liquidity pools, and impermanent loss across 12+ protocols.',
    longDescription: '',
    specialization: 'DeFi',
    tools: ['yield-scanner', 'pool-analyzer', 'il-calculator', 'gas-optimizer'],
    pricing: { perCall: 5, subscription: 200 },
    rating: 4.9,
    reviewCount: 342,
    totalCalls: 128500,
    successRate: 99.2,
    avgResponseTime: 1200,
    featured: true,
    verified: true,
    createdAt: '2025-11-15T00:00:00Z',
    tags: ['DeFi', 'Yield', 'Monitoring', 'Multi-chain'],
    developer: { address: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12', name: 'SentinelLabs', agentCount: 4 },
  },
  {
    agentId: 'showcase-alpha-hunter',
    name: 'Alpha Hunter',
    description: 'AI-powered trading signal generator combining on-chain analytics, social sentiment, and technical analysis for alpha discovery.',
    longDescription: '',
    specialization: 'Trading',
    tools: ['signal-engine', 'sentiment-scorer', 'whale-tracker', 'ta-analyzer'],
    pricing: { perCall: 15, subscription: 500 },
    rating: 4.8,
    reviewCount: 218,
    totalCalls: 87200,
    successRate: 94.7,
    avgResponseTime: 2100,
    featured: true,
    verified: true,
    createdAt: '2025-12-01T00:00:00Z',
    tags: ['Trading', 'Signals', 'Alpha', 'On-chain'],
    developer: { address: '0xabcdef1234567890abcdef1234567890abcdef34', name: 'AlphaForge', agentCount: 2 },
  },
  {
    agentId: 'showcase-nft-appraiser',
    name: 'NFT Appraiser',
    description: 'Valuates NFTs using rarity analysis, floor price tracking, wash-trade detection, and collection momentum scoring.',
    longDescription: '',
    specialization: 'NFT',
    tools: ['rarity-engine', 'floor-tracker', 'wash-detector', 'momentum-scorer'],
    pricing: { perCall: 8, subscription: 300 },
    rating: 4.7,
    reviewCount: 156,
    totalCalls: 64300,
    successRate: 97.1,
    avgResponseTime: 1800,
    featured: true,
    verified: true,
    createdAt: '2025-10-20T00:00:00Z',
    tags: ['NFT', 'Valuation', 'Rarity', 'Analytics'],
    developer: { address: '0x7890abcdef1234567890abcdef1234567890abcd', name: 'AppraisalDAO', agentCount: 3 },
  },
  {
    agentId: 'showcase-research-owl',
    name: 'Research Owl',
    description: 'Deep research agent that synthesizes whitepapers, audit reports, and governance proposals into actionable intelligence.',
    longDescription: '',
    specialization: 'Research',
    tools: ['paper-parser', 'audit-analyzer', 'gov-tracker', 'risk-scorer'],
    pricing: { perCall: 10, subscription: 350 },
    rating: 4.8,
    reviewCount: 289,
    totalCalls: 95700,
    successRate: 98.5,
    avgResponseTime: 3200,
    featured: false,
    verified: true,
    createdAt: '2025-09-05T00:00:00Z',
    tags: ['Research', 'Analysis', 'Governance', 'Audits'],
    developer: { address: '0xdef1234567890abcdef1234567890abcdef123456', name: 'OwlResearch', agentCount: 1 },
  },
  {
    agentId: 'showcase-news-wire',
    name: 'NewsWire AI',
    description: 'Aggregates and fact-checks crypto news from 200+ sources in real-time with impact scoring and portfolio relevance matching.',
    longDescription: '',
    specialization: 'News',
    tools: ['news-aggregator', 'fact-checker', 'impact-scorer', 'portfolio-matcher'],
    pricing: { perCall: 3, subscription: 100 },
    rating: 4.6,
    reviewCount: 412,
    totalCalls: 215000,
    successRate: 96.8,
    avgResponseTime: 800,
    featured: false,
    verified: true,
    createdAt: '2025-08-12T00:00:00Z',
    tags: ['News', 'Real-time', 'Fact-check', 'Aggregation'],
    developer: { address: '0x567890abcdef1234567890abcdef1234567890ab', name: 'WireProtocol', agentCount: 2 },
  },
  {
    agentId: 'showcase-shield-guard',
    name: 'Shield Guard',
    description: 'Smart contract security scanner with real-time rug-pull detection, honeypot analysis, and pre-transaction simulation.',
    longDescription: '',
    specialization: 'Security',
    tools: ['contract-scanner', 'rug-detector', 'honeypot-checker', 'tx-simulator'],
    pricing: { perCall: 12, subscription: 400 },
    rating: 4.9,
    reviewCount: 534,
    totalCalls: 178900,
    successRate: 99.8,
    avgResponseTime: 1500,
    featured: true,
    verified: true,
    createdAt: '2025-07-28T00:00:00Z',
    tags: ['Security', 'Audit', 'Rug-pull', 'Smart Contract'],
    developer: { address: '0x890abcdef1234567890abcdef1234567890abcdef', name: 'ShieldDAO', agentCount: 5 },
  },
];

// ---------------------------------------------------------------------------
// Icons (inline SVG components)
// ---------------------------------------------------------------------------

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function VerifiedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0v-1H3a1 1 0 010-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744l.893 3.573 3.573.893a1 1 0 010 1.934l-3.573.893-.893 3.573a1 1 0 01-1.934 0l-.893-3.573-3.573-.893a1 1 0 010-1.934l3.573-.893.893-3.573A1 1 0 0112 2z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l-3 9m0-12l-6 2m0 0v17" />
    </svg>
  );
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Weekly growth badge for agent cards */
function GrowthBadge({ agent }: { agent: AgentListing }) {
  const growth = getWeeklyGrowth(agent);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
      <TrendUpIcon className="w-2.5 h-2.5" />
      +{growth}% this week
    </span>
  );
}

/** Horizontal metric bar for the comparison modal */
function MetricBar({
  label,
  values,
  names,
  format = (v) => String(v),
  higherIsBetter = true,
}: {
  label: string;
  values: number[];
  names: string[];
  format?: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const max = Math.max(...values, 1);
  const bestIdx = higherIsBetter
    ? values.indexOf(Math.max(...values))
    : values.indexOf(Math.min(...values));

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{label}</div>
      <div className="space-y-1">
        {values.map((v, i) => {
          const pct = (v / max) * 100;
          const isBest = i === bestIdx;
          return (
            <div key={names[i]} className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 w-20 truncate shrink-0 text-right">{names[i]}</span>
              <div className="flex-1 h-5 rounded-md bg-white/[0.04] overflow-hidden relative">
                <div
                  className={`h-full rounded-md transition-all duration-500 ${isBest ? 'bg-amber-500/60' : 'bg-white/[0.12]'}`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold ${isBest ? 'text-amber-300' : 'text-white/50'}`}>
                  {format(v)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Comparison modal overlay */
function ComparisonModal({
  agents,
  onClose,
  onRemove,
}: {
  agents: AgentListing[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  if (agents.length < 2) return null;

  const names = agents.map((a) => a.name);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-[#0c0c0e] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0c0c0e]/95 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10">
              <ScaleIcon className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-base font-semibold text-white">Agent Comparison</h3>
            <span className="text-xs text-white/30 ml-1">({agents.length} agents)</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Agent headers row */}
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${agents.length}, 1fr)` }}>
            {agents.map((agent) => (
              <div key={agent.agentId} className="text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 mx-auto">
                    <span className="text-sm font-bold text-amber-400">{agent.name.charAt(0)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-semibold text-sm text-white">{agent.name}</span>
                    {agent.verified && <VerifiedIcon className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <span className="text-[10px] text-white/30">{agent.specialization}</span>
                </div>
                <button
                  onClick={() => onRemove(agent.agentId)}
                  className="text-[10px] text-white/20 hover:text-red-400/60 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison metrics */}
        <div className="px-6 py-5 space-y-5">
          {/* Rating */}
          <MetricBar
            label="Rating"
            values={agents.map((a) => a.rating)}
            names={names}
            format={(v) => v.toFixed(1) + ' / 5'}
          />
          {/* Price per call */}
          <MetricBar
            label="Price per Call"
            values={agents.map((a) => a.pricing.perCall)}
            names={names}
            format={(v) => v + ' BBAI'}
            higherIsBetter={false}
          />
          {/* Subscription price */}
          <MetricBar
            label="Subscription Price"
            values={agents.map((a) => a.pricing.subscription ?? 0)}
            names={names}
            format={(v) => (v > 0 ? v + ' BBAI/mo' : 'N/A')}
            higherIsBetter={false}
          />
          {/* Success Rate */}
          <MetricBar
            label="Success Rate"
            values={agents.map((a) => a.successRate)}
            names={names}
            format={(v) => v + '%'}
          />
          {/* Avg Response Time */}
          <MetricBar
            label="Avg Response Time"
            values={agents.map((a) => a.avgResponseTime)}
            names={names}
            format={(v) => (v / 1000).toFixed(1) + 's'}
            higherIsBetter={false}
          />
          {/* Total Calls */}
          <MetricBar
            label="Total Calls"
            values={agents.map((a) => a.totalCalls)}
            names={names}
            format={(v) => v.toLocaleString()}
          />
          {/* Review Count */}
          <MetricBar
            label="Reviews"
            values={agents.map((a) => a.reviewCount)}
            names={names}
            format={(v) => v.toLocaleString()}
          />
          {/* Arena ELO (placeholder) */}
          <MetricBar
            label="Arena ELO (Coming Soon)"
            values={agents.map((a) => 1200 + Math.floor(a.rating * 60 + a.successRate * 2))}
            names={names}
            format={(v) => String(v)}
          />

          {/* Tools / Capabilities */}
          <div className="space-y-1.5">
            <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">Tools & Capabilities</div>
            <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${agents.length}, 1fr)` }}>
              {agents.map((agent) => (
                <div key={agent.agentId} className="flex flex-wrap gap-1">
                  {agent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center text-[9px] bg-white/[0.04] text-white/40 px-1.5 py-0.5 rounded-full border border-white/[0.04]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Growth */}
          <div className="space-y-1.5">
            <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">Weekly Growth</div>
            <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${agents.length}, 1fr)` }}>
              {agents.map((agent) => (
                <div key={agent.agentId} className="text-center">
                  <GrowthBadge agent={agent} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-white/[0.06] flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.06]"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Floating comparison bar that appears when agents are selected */
function ComparisonBar({
  selectedAgents,
  onRemove,
  onClear,
  onCompare,
}: {
  selectedAgents: AgentListing[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onCompare: () => void;
}) {
  if (selectedAgents.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-3xl mx-auto px-4 pb-5 pointer-events-auto">
        <div className="relative rounded-xl border border-amber-500/20 bg-[#111113]/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-3">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/[0.04] to-orange-500/[0.04]" />
          <div className="relative flex items-center gap-3">
            {/* Icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/20">
              <ScaleIcon className="w-4 h-4 text-amber-400" />
            </div>

            {/* Selected agents */}
            <div className="flex-1 flex items-center gap-2 overflow-x-auto">
              {selectedAgents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] shrink-0"
                >
                  <span className="text-xs font-medium text-white/80">{agent.name}</span>
                  <button
                    onClick={() => onRemove(agent.agentId)}
                    className="p-0.5 rounded-md hover:bg-white/[0.08] text-white/25 hover:text-white/60 transition-colors"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {selectedAgents.length < MAX_COMPARE && (
                <span className="text-[10px] text-white/20 shrink-0">
                  Select {MAX_COMPARE - selectedAgents.length} more
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onClear}
                className="text-[10px] text-white/25 hover:text-white/60 transition-colors px-2"
              >
                Clear
              </button>
              <Button
                size="sm"
                onClick={onCompare}
                disabled={selectedAgents.length < 2}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold h-8 text-xs px-4 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Compare ({selectedAgents.length})
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  const sizeClass = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizeClass} transition-colors ${
            star <= full
              ? 'text-amber-400'
              : star === full + 1 && partial > 0
                ? 'text-amber-400/50'
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

function StatCard({
  value,
  label,
  icon,
  accent = false,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 transition-all duration-300 hover:border-amber-500/20 hover:bg-white/[0.04]">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
          {icon}
        </div>
        <div>
          <div className={`text-xl font-bold tracking-tight ${accent ? 'text-amber-400' : 'text-white'}`}>
            {value}
          </div>
          <div className="text-[11px] text-white/40 uppercase tracking-widest font-medium">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg bg-white/[0.06]" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 bg-white/[0.06]" />
            <Skeleton className="h-3 w-20 bg-white/[0.04]" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full bg-white/[0.06]" />
      </div>
      <Skeleton className="h-4 w-full bg-white/[0.04]" />
      <Skeleton className="h-4 w-3/4 bg-white/[0.04]" />
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-14 rounded-full bg-white/[0.04]" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg bg-white/[0.04]" />
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 flex-1 rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-9 flex-1 rounded-lg bg-white/[0.06]" />
      </div>
    </div>
  );
}

function FeaturedCard({ agent }: { agent: AgentListing }) {
  return (
    <Link href={`/marketplace/${agent.agentId}`} className="block min-w-[340px] max-w-[400px] group">
      <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-amber-500/50 via-amber-600/30 to-orange-500/50 group-hover:from-amber-400/70 group-hover:via-amber-500/50 group-hover:to-orange-400/70 transition-all duration-500 group-hover:shadow-lg group-hover:shadow-amber-500/10">
        <div className="relative h-full rounded-xl bg-[#0a0a0b]/95 backdrop-blur-xl p-5 overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-amber-500/[0.06] blur-3xl group-hover:bg-amber-500/[0.12] transition-all duration-700" />

          <div className="relative space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                  <BoltIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-white">{agent.name}</span>
                    {agent.verified && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><VerifiedIcon className="w-3.5 h-3.5 text-blue-400" /></span>
                          </TooltipTrigger>
                          <TooltipContent><p>Verified Agent</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <span className="text-[10px] text-white/30 font-medium">by {agent.developer.name}</span>
                </div>
              </div>
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px] font-semibold px-2 py-0.5">
                Featured
              </Badge>
            </div>

            {/* Description */}
            <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">{agent.description}</p>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <StarRating rating={agent.rating} />
              <span className="text-xs font-medium text-white/70">{agent.rating.toFixed(1)}</span>
              <span className="text-[10px] text-white/30">({agent.reviewCount})</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                <div className="text-sm font-bold text-white">{agent.totalCalls.toLocaleString()}</div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider font-medium">Calls</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                <div className="text-sm font-bold text-emerald-400">{agent.successRate}%</div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider font-medium">Success</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                <div className="text-sm font-bold text-amber-400">{agent.pricing.perCall}</div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider font-medium">BBAI/call</div>
              </div>
            </div>

            {/* CTA hint */}
            <div className="flex items-center justify-end gap-1 text-[10px] text-amber-400/60 group-hover:text-amber-400 transition-colors">
              <span className="font-medium">Explore agent</span>
              <ArrowRightIcon className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function AgentCard({
  agent,
  isCompareSelected,
  onToggleCompare,
  compareDisabled,
}: {
  agent: AgentListing;
  isCompareSelected?: boolean;
  onToggleCompare?: (id: string) => void;
  compareDisabled?: boolean;
}) {
  const truncatedAddress =
    agent.developer.address.slice(0, 6) + '...' + agent.developer.address.slice(-4);

  return (
    <div className="relative block group">
      <Link href={`/marketplace/${agent.agentId}`} className="block">
        <div className={`relative h-full rounded-xl border backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/[0.04] hover:scale-[1.01] ${
          isCompareSelected
            ? 'border-amber-500/30 bg-amber-500/[0.03]'
            : 'border-white/[0.06] bg-white/[0.015] hover:border-amber-500/25 hover:bg-white/[0.03]'
        }`}>
          {/* Top ambient glow on hover */}
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-amber-500/[0.04] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          {/* Featured indicator stripe */}
          {agent.featured && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
          )}

          <div className="relative p-5 space-y-3.5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.06] group-hover:border-amber-500/20 group-hover:from-amber-500/10 group-hover:to-amber-500/[0.02] transition-all duration-300">
                  <span className="text-base font-bold text-white/60 group-hover:text-amber-400 transition-colors">
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-white truncate group-hover:text-amber-50 transition-colors">
                      {agent.name}
                    </span>
                    {agent.verified && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><VerifiedIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" /></span>
                          </TooltipTrigger>
                          <TooltipContent><p>Verified Agent</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {agent.featured && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><StarIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" /></span>
                          </TooltipTrigger>
                          <TooltipContent><p>Featured Agent</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="text-[10px] text-white/25 font-medium mt-0.5">
                    by {agent.developer.name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <GrowthBadge agent={agent} />
                <Badge
                  variant="outline"
                  className="text-[10px] border-white/[0.08] text-white/50 bg-white/[0.02] font-medium"
                >
                  {agent.specialization}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{agent.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {agent.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center text-[10px] bg-white/[0.04] text-white/35 px-2 py-0.5 rounded-full border border-white/[0.04] font-medium"
                >
                  {tag}
                </span>
              ))}
              {agent.tags.length > 3 && (
                <span className="inline-flex items-center text-[10px] bg-white/[0.04] text-white/25 px-2 py-0.5 rounded-full border border-white/[0.04]">
                  +{agent.tags.length - 3}
                </span>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <StarRating rating={agent.rating} />
              <span className="text-xs font-semibold text-white/70">{agent.rating.toFixed(1)}</span>
              <span className="text-[10px] text-white/25">({agent.reviewCount} reviews)</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2.5 rounded-lg bg-white/[0.025] border border-white/[0.04]">
                <div className="text-sm font-bold text-white">{agent.totalCalls.toLocaleString()}</div>
                <div className="text-[9px] text-white/25 uppercase tracking-wider font-medium">Calls</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-white/[0.025] border border-white/[0.04]">
                <div className="text-sm font-bold text-emerald-400">{agent.successRate}%</div>
                <div className="text-[9px] text-white/25 uppercase tracking-wider font-medium">Success</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-white/[0.025] border border-white/[0.04]">
                <div className="text-sm font-bold text-white/70">{(agent.avgResponseTime / 1000).toFixed(1)}s</div>
                <div className="text-[9px] text-white/25 uppercase tracking-wider font-medium">Avg Time</div>
              </div>
            </div>

            {/* Pricing */}
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/[0.08]">
              <span className="text-sm font-bold text-amber-400">
                {agent.pricing.perCall} BBAI
                <span className="text-[10px] font-normal text-amber-400/50 ml-0.5">/call</span>
              </span>
              {agent.pricing.subscription && (
                <span className="text-[10px] text-white/30 font-medium">
                  or {agent.pricing.subscription} BBAI/mo
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-9 border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-all duration-200"
              >
                Details
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs h-9 bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30"
              >
                <BoltIcon className="w-3.5 h-3.5 mr-1" />
                Invoke
              </Button>
            </div>

            {/* Developer footer */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
              <span className="text-[10px] text-white/20 font-medium">{agent.developer.name}</span>
              <span className="text-[10px] text-white/15 font-mono">{truncatedAddress}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Compare toggle button (absolute, overlaid on the card) */}
      {onToggleCompare && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleCompare(agent.agentId);
          }}
          disabled={compareDisabled && !isCompareSelected}
          className={`absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
            isCompareSelected
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : compareDisabled
                ? 'bg-white/[0.04] text-white/15 border border-white/[0.04] cursor-not-allowed'
                : 'bg-white/[0.06] text-white/30 border border-white/[0.06] hover:text-white/60 hover:border-white/[0.15] hover:bg-white/[0.08]'
          }`}
        >
          {isCompareSelected ? (
            <CheckCircleIcon className="w-3 h-3" />
          ) : (
            <ScaleIcon className="w-3 h-3" />
          )}
          {isCompareSelected ? 'Selected' : 'Compare'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarketplaceBrowsePage() {
  const [listings, setListings] = useState<AgentListing[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialization, setSpecialization] = useState('all');
  const [sortBy, setSortBy] = useState<string>('trending');
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);

  const toggleCompare = useCallback((agentId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else if (next.size < MAX_COMPARE) {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  const removeFromCompare = useCallback((agentId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds(new Set());
    setShowCompareModal(false);
  }, []);

  useEffect(() => {
    // Apply time-based growth to showcase data
    const ticks = Math.floor((Date.now() - new Date('2026-03-01').getTime()) / 60000);
    const g = (base: number, rate: number) => base + Math.floor((ticks / 60) * rate);
    const grownAgents = SHOWCASE_AGENTS.map((a) => ({
      ...a,
      totalCalls: g(a.totalCalls, Math.floor(a.totalCalls / 1000)),
      reviewCount: g(a.reviewCount, Math.max(1, Math.floor(a.reviewCount / 200))),
    }));
    function makeStats(agents: AgentListing[]) {
      return {
        totalAgents: agents.length,
        totalCalls: agents.reduce((sum, a) => sum + a.totalCalls, 0),
        totalVolume: agents.reduce((sum, a) => sum + a.totalCalls * a.pricing.perCall, 0),
        avgRating: +(agents.reduce((sum, a) => sum + a.rating, 0) / agents.length).toFixed(1),
      };
    }
    async function fetchMarketplace() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch('/api/marketplace', { signal: controller.signal });
        const data = await res.json();
        const apiListings = data.listings || [];
        const hasReal = apiListings.length > 0;
        setListings(hasReal ? apiListings : grownAgents);
        const apiStats = data.stats;
        setStats(hasReal && apiStats && apiStats.totalAgents > 0 ? apiStats : makeStats(hasReal ? apiListings : grownAgents));
      } catch (error) {
        console.error('Failed to fetch marketplace:', error);
        setListings(grownAgents);
        setStats(makeStats(grownAgents));
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    }
    fetchMarketplace();
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSpecialization('all');
    setSortBy('trending');
  }, []);

  // Client-side filtering and sorting
  const filteredListings = useMemo(() => {
    let results = [...listings];

    // Filter by specialization
    if (specialization !== 'all') {
      results = results.filter(
        (l) => l.specialization.toLowerCase() === specialization.toLowerCase(),
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q)) ||
          l.specialization.toLowerCase().includes(q) ||
          l.developer.name.toLowerCase().includes(q),
      );
    }

    // Sort
    if (sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'calls') {
      results.sort((a, b) => b.totalCalls - a.totalCalls);
    } else if (sortBy === 'earned') {
      results.sort((a, b) => {
        const ea = a.totalCalls * a.pricing.perCall;
        const eb = b.totalCalls * b.pricing.perCall;
        return eb - ea;
      });
    } else if (sortBy === 'newest') {
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'price-low') {
      results.sort((a, b) => a.pricing.perCall - b.pricing.perCall);
    } else if (sortBy === 'price-high') {
      results.sort((a, b) => b.pricing.perCall - a.pricing.perCall);
    } else if (sortBy === 'fastest') {
      results.sort((a, b) => a.avgResponseTime - b.avgResponseTime);
    } else if (sortBy === 'success') {
      results.sort((a, b) => b.successRate - a.successRate);
    } else {
      // Trending (default): composite score
      results.sort((a, b) => trendingScore(b) - trendingScore(a));
    }

    return results;
  }, [listings, specialization, searchQuery, sortBy]);

  const featuredAgents = useMemo(
    () => listings.filter((l) => l.featured),
    [listings],
  );

  const hasActiveFilters = searchQuery.trim() !== '' || specialization !== 'all' || sortBy !== 'trending';

  const selectedAgentsForCompare = useMemo(
    () => listings.filter((l) => compareIds.has(l.agentId)),
    [listings, compareIds],
  );

  return (
    <div className="min-h-screen bg-[#050506] relative z-1">
      {/* Background ambient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/[0.02] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-orange-500/[0.015] blur-[100px]" />
      </div>

      {/* Hero Section */}
      <div className="relative border-b border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.03] via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/20">
                  <SparklesIcon className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/70">
                  Agent Marketplace
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                Discover AI Agents
              </h1>
              <p className="text-white/40 max-w-xl text-sm sm:text-base leading-relaxed">
                Browse, hire, and deploy specialized AI agents powered by <span className="text-amber-400 font-medium">$BBAI</span>.
                Transparent pricing, verified performance, and seamless integration.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.06] h-9"
                >
                  Back to Search
                </Button>
              </Link>
              <Link href="/agents/create">
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold h-9 shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 transition-all duration-200"
                >
                  <BoltIcon className="w-3.5 h-3.5 mr-1.5" />
                  List Your Agent
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg bg-white/[0.06]" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-16 bg-white/[0.06]" />
                      <Skeleton className="h-3 w-20 bg-white/[0.04]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
              <StatCard
                value={String(stats.totalAgents)}
                label="Active Agents"
                icon={<UsersIcon className="w-5 h-5" />}
              />
              <StatCard
                value={stats.totalCalls.toLocaleString()}
                label="Total Calls"
                icon={<BoltIcon className="w-5 h-5" />}
              />
              <StatCard
                value={String(stats.avgRating)}
                label="Avg Rating"
                icon={<StarIcon className="w-5 h-5" />}
              />
              <StatCard
                value={stats.totalVolume.toLocaleString()}
                label="BBAI Volume"
                icon={<CoinIcon className="w-5 h-5" />}
                accent
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search & Filter Bar */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-[#050506]/80 backdrop-blur-xl border-b border-white/[0.04] mb-6">
          <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative group">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-amber-400/60 transition-colors" />
              <Input
                placeholder="Search agents by name, tag, or specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-amber-500/30 focus:ring-amber-500/10 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Specialization tabs */}
              <div className="flex flex-wrap gap-1.5">
                {SPECIALIZATIONS.map((spec) => {
                  const isActive = specialization === spec.value;
                  return (
                    <button
                      key={spec.value}
                      onClick={() => setSpecialization(spec.value)}
                      className={`
                        relative h-8 px-3.5 rounded-lg text-xs font-medium transition-all duration-200
                        ${isActive
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25 shadow-sm shadow-amber-500/10'
                          : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60 hover:border-white/[0.12] hover:bg-white/[0.05]'
                        }
                      `}
                    >
                      {spec.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Active filter indicator */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-white/30 hover:text-white/60 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear filters
                  </button>
                )}

                {/* Sort tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                  {SORT_OPTIONS.map((opt) => {
                    const isActive = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setSortBy(opt.value)}
                        className={`
                          h-7 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200
                          ${isActive
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
                          }
                        `}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Agents Carousel */}
        {!loading && featuredAgents.length > 0 && specialization === 'all' && !searchQuery.trim() && (
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10">
                <StarIcon className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-base font-semibold text-white">Featured Agents</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent ml-3" />
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              {featuredAgents.map((agent) => (
                <FeaturedCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {/* Results Count */}
        {!loading && filteredListings.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-white/25 font-medium">
              Showing <span className="text-white/50">{filteredListings.length}</span> agent{filteredListings.length !== 1 ? 's' : ''}
              {specialization !== 'all' && (
                <span> in <span className="text-amber-400/60">{specialization}</span></span>
              )}
            </div>
          </div>
        )}

        {/* Agent Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-xl" />
              <div className="relative w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                <SearchIcon className="w-7 h-7 text-white/15" />
              </div>
            </div>
            <p className="text-white/60 text-lg font-medium">No agents found</p>
            <p className="text-white/25 text-sm mt-1.5 text-center max-w-sm">
              Try adjusting your search query or filters to discover more agents.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5 border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.06]"
              onClick={clearFilters}
            >
              Clear All Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredListings.map((agent) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                isCompareSelected={compareIds.has(agent.agentId)}
                onToggleCompare={toggleCompare}
                compareDisabled={compareIds.size >= MAX_COMPARE}
              />
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {stats && !loading && (
          <div className={`mt-16 pt-8 border-t border-white/[0.04] ${selectedAgentsForCompare.length > 0 ? 'pb-24' : ''}`}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-white/25">
              <div className="flex items-center gap-2">
                <CoinIcon className="w-4 h-4 text-amber-400/40" />
                <span>
                  Total volume:{' '}
                  <span className="font-semibold text-amber-400/70">
                    {stats.totalVolume.toLocaleString()} BBAI
                  </span>
                </span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-white/10" />
              <div className="flex items-center gap-2">
                <BoltIcon className="w-4 h-4 text-white/20" />
                <span>
                  <span className="font-semibold text-white/40">{stats.totalCalls.toLocaleString()}</span>{' '}
                  total agent calls
                </span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-white/10" />
              <div className="flex items-center gap-2">
                <ChartIcon className="w-4 h-4 text-white/20" />
                <span>
                  <span className="font-semibold text-white/40">{stats.avgRating}</span>{' '}
                  average rating
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comparison floating bar */}
      <ComparisonBar
        selectedAgents={selectedAgentsForCompare}
        onRemove={removeFromCompare}
        onClear={clearCompare}
        onCompare={() => setShowCompareModal(true)}
      />

      {/* Comparison modal */}
      {showCompareModal && (
        <ComparisonModal
          agents={selectedAgentsForCompare}
          onClose={() => setShowCompareModal(false)}
          onRemove={(id) => {
            removeFromCompare(id);
            // Close modal if fewer than 2 agents remain
            if (selectedAgentsForCompare.length <= 2) {
              setShowCompareModal(false);
            }
          }}
        />
      )}
    </div>
  );
}
