'use client';

import { useEffect, useState, useMemo } from 'react';
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
  { value: 'all', label: 'All' },
  { value: 'DeFi', label: 'DeFi' },
  { value: 'NFT', label: 'NFT' },
  { value: 'Research', label: 'Research' },
  { value: 'Trading', label: 'Trading' },
  { value: 'News', label: 'News' },
  { value: 'Security', label: 'Security' },
];

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
          className={`${sizeClass} ${
            star <= full
              ? 'text-yellow-500'
              : star === full + 1 && partial > 0
                ? 'text-yellow-500/50'
                : 'text-muted-foreground/20'
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

function AgentCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-16 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FeaturedCard({ agent }: { agent: AgentListing }) {
  return (
    <Link href={`/marketplace/${agent.agentId}`} className="block min-w-[320px] max-w-[380px]">
      <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-yellow-500/60 via-primary/40 to-purple-500/60 hover:from-yellow-500/80 hover:via-primary/60 hover:to-purple-500/80 transition-all duration-300">
        <Card className="h-full rounded-xl border-0 bg-background/95 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{agent.name}</CardTitle>
                {agent.verified && (
                  <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-[10px]">
                Featured
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{agent.description}</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center gap-2">
              <StarRating rating={agent.rating} />
              <span className="text-xs text-muted-foreground">
                {agent.rating.toFixed(1)} ({agent.reviewCount})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-1.5 rounded-lg bg-muted/50">
                <div className="text-sm font-bold">{agent.totalCalls.toLocaleString()}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Calls</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-muted/50">
                <div className="text-sm font-bold">{agent.successRate}%</div>
                <div className="text-[9px] text-muted-foreground uppercase">Success</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-muted/50">
                <div className="text-sm font-bold text-primary">{agent.pricing.perCall}</div>
                <div className="text-[9px] text-muted-foreground uppercase">BBAI/call</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Link>
  );
}

function AgentCard({ agent }: { agent: AgentListing }) {
  const truncatedAddress =
    agent.developer.address.slice(0, 6) + '...' + agent.developer.address.slice(-4);

  return (
    <Card className="h-full group hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
              {agent.name}
            </CardTitle>
            {agent.verified && (
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {agent.featured && (
              <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {agent.specialization}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{agent.description}</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Rating */}
        <div className="flex items-center gap-2">
          <StarRating rating={agent.rating} />
          <span className="text-xs font-medium">{agent.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({agent.reviewCount} reviews)</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-sm font-bold">{agent.totalCalls.toLocaleString()}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Calls</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-sm font-bold">{agent.successRate}%</div>
            <div className="text-[9px] text-muted-foreground uppercase">Success</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-sm font-bold">{(agent.avgResponseTime / 1000).toFixed(1)}s</div>
            <div className="text-[9px] text-muted-foreground uppercase">Avg Time</div>
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-primary">
            {agent.pricing.perCall} BBAI/call
          </span>
          {agent.pricing.subscription && (
            <span className="text-[10px] text-muted-foreground">
              or {agent.pricing.subscription} BBAI/mo
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {agent.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center text-[10px] bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
          {agent.tags.length > 4 && (
            <span className="inline-flex items-center text-[10px] bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full">
              +{agent.tags.length - 4}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Link href={`/marketplace/${agent.agentId}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs h-8">
              View Details
            </Button>
          </Link>
          <Link href={`/marketplace/${agent.agentId}`} className="flex-1">
            <Button size="sm" className="w-full text-xs h-8">
              Invoke
            </Button>
          </Link>
        </div>

        {/* Developer */}
        <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
          <span>by {agent.developer.name}</span>
          <span className="font-mono">{truncatedAddress}</span>
        </div>
      </CardContent>
    </Card>
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

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Hero Section */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                AI Agent Marketplace
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Discover, hire, and deploy AI agents powered by $BBAI. Each agent brings specialized capabilities with transparent pricing and performance metrics.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Back to Search
                </Button>
              </Link>
              <Link href="/agents/create">
                <Button size="sm" className="holographic-button text-white border-0">
                  List Your Agent
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          {stats && !loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{stats.totalAgents}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Active Agents
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">
                  {stats.totalCalls.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Total Calls
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{stats.avgRating}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Avg Rating
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold text-primary">
                  {stats.totalVolume.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  BBAI Volume
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search Bar */}
        <div className="relative mb-6">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            placeholder="Search agents by name, tag, or specialization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Specialization tabs */}
          <div className="flex flex-wrap gap-1.5">
            {SPECIALIZATIONS.map((spec) => (
              <Button
                key={spec.value}
                variant={specialization === spec.value ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => setSpecialization(spec.value)}
              >
                {spec.label}
              </Button>
            ))}
          </div>

          {/* Sort dropdown */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="calls">Most Used</SelectItem>
              <SelectItem value="earned">Top Earned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Featured Agents Section */}
        {!loading && featuredAgents.length > 0 && specialization === 'all' && !searchQuery.trim() && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Featured Agents
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
              {featuredAgents.map((agent) => (
                <FeaturedCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          </div>
        )}

        {/* Agent Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-muted-foreground text-lg font-medium">No agents found</p>
              <p className="text-muted-foreground text-sm mt-1">
                Try adjusting your search or filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setSpecialization('all');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-3">
              Showing {filteredListings.length} agent{filteredListings.length !== 1 ? 's' : ''}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredListings.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          </>
        )}

        {/* Stats Footer */}
        {stats && !loading && (
          <div className="mt-12 pt-8 border-t border-border/50">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Total marketplace volume:{' '}
                <span className="font-semibold text-primary">
                  {stats.totalVolume.toLocaleString()} BBAI
                </span>{' '}
                across{' '}
                <span className="font-semibold">{stats.totalCalls.toLocaleString()}</span>{' '}
                agent calls
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
