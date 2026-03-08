'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  { value: 'default', label: 'Featured First' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'calls', label: 'Most Used' },
  { value: 'earned', label: 'Top Earned' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function AgentCard({ agent }: { agent: AgentListing }) {
  const truncatedAddress =
    agent.developer.address.slice(0, 6) + '...' + agent.developer.address.slice(-4);

  return (
    <Link href={`/marketplace/${agent.agentId}`} className="block group">
      <div className="relative h-full rounded-xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-amber-500/25 hover:bg-white/[0.03] hover:shadow-xl hover:shadow-amber-500/[0.04] hover:scale-[1.01]">
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
            <Badge
              variant="outline"
              className="text-[10px] shrink-0 border-white/[0.08] text-white/50 bg-white/[0.02] font-medium"
            >
              {agent.specialization}
            </Badge>
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
  const [sortBy, setSortBy] = useState<string>('default');

  useEffect(() => {
    async function fetchMarketplace() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch('/api/marketplace', { signal: controller.signal });
        const data = await res.json();
        setListings(data.listings || []);
        setStats(data.stats || null);
      } catch (error) {
        console.error('Failed to fetch marketplace:', error);
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
    setSortBy('default');
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
    } else {
      // Default: featured first, then by calls
      results.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return b.totalCalls - a.totalCalls;
      });
    }

    return results;
  }, [listings, specialization, searchQuery, sortBy]);

  const featuredAgents = useMemo(
    () => listings.filter((l) => l.featured),
    [listings],
  );

  const hasActiveFilters = searchQuery.trim() !== '' || specialization !== 'all' || sortBy !== 'default';

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

              <div className="flex items-center gap-2">
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

                {/* Sort dropdown */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[170px] h-8 text-xs bg-white/[0.03] border-white/[0.06] text-white/50 hover:border-white/[0.12] focus:border-amber-500/30 transition-all">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111113] border-white/[0.08]">
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {stats && !loading && (
          <div className="mt-16 pt-8 border-t border-white/[0.04]">
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
    </div>
  );
}
