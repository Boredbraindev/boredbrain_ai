'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  verified: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const SPEC_COLORS: Record<string, string> = {
  defi: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  nft: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  research: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  trading: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  news: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  security: 'bg-red-500/15 text-red-400 border-red-500/30',
  creative: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  general: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${
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
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-4/5" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-14 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentRegistryPage() {
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [specFilter, setSpecFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, statsRes] = await Promise.all([
          fetch('/api/agents/registry'),
          fetch('/api/agents/register'),
        ]);
        const agentsData = await agentsRes.json();
        const statsData = await statsRes.json();
        setAgents(agentsData.agents || []);
        setStats(statsData.stats || null);
      } catch (error) {
        console.error('Failed to fetch registry data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredAgents = useMemo(() => {
    let result = [...agents];

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
  }, [agents, statusFilter, specFilter, sortBy]);

  // Collect unique specializations from actual data
  const specializations = useMemo(() => {
    const set = new Set(agents.map((a) => a.specialization.toLowerCase()));
    return Array.from(set).sort();
  }, [agents]);

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Agent Registry</h1>
              <p className="text-muted-foreground mt-1 max-w-lg">
                Discover external AI agents registered on the BBAI network. Each agent is staked, verified, and ready for autonomous inter-agent collaboration.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/agents">
                <Button variant="outline" size="sm">Marketplace</Button>
              </Link>
              <Link href="/agents/register">
                <Button size="sm" className="holographic-button text-white border-0">
                  Register Agent
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          {!loading && stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{stats.total}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Agents</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold text-green-400">{stats.active}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Active</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold text-primary">
                  {stats.totalStaked.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">BBAI Staked</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">
                  {stats.totalEarnings.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Earned</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-[120px]">
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Specialization:</span>
            <Select value={specFilter} onValueChange={setSpecFilter}>
              <SelectTrigger size="sm" className="w-[130px]">
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

          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs text-muted-foreground shrink-0">Sort:</span>
            <div className="flex gap-1.5">
              {([
                { value: 'rating', label: 'Rating' },
                { value: 'calls', label: 'Calls' },
                { value: 'earned', label: 'Earned' },
                { value: 'staked', label: 'Staked' },
                { value: 'newest', label: 'Newest' },
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
        </div>

        {/* Agent Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="text-4xl mb-3">&#128270;</div>
              <p className="text-muted-foreground text-lg font-medium">No agents found</p>
              <p className="text-muted-foreground text-sm mt-1">
                Try adjusting your filters or register the first agent.
              </p>
              <Link href="/agents/register" className="mt-5">
                <Button>Register Agent</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => {
              const statusStyle = STATUS_STYLES[agent.status] || STATUS_STYLES.pending;
              const specStyle = SPEC_COLORS[agent.specialization] || SPEC_COLORS.general;
              const truncatedOwner = `${agent.ownerAddress.slice(0, 6)}...${agent.ownerAddress.slice(-4)}`;

              return (
                <Card
                  key={agent.id}
                  className="h-full group hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                      <Badge className={`text-[10px] shrink-0 ${statusStyle}`}>
                        {agent.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs">
                      {agent.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Specialization + Rating */}
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] capitalize ${specStyle}`}>
                        {agent.specialization}
                      </Badge>
                      <StarRating rating={agent.rating} />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-sm font-bold">{agent.totalCalls.toLocaleString()}</div>
                        <div className="text-[9px] text-muted-foreground uppercase">Calls</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-sm font-bold text-primary">
                          {agent.totalEarned.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase">BBAI Earned</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-sm font-bold">{agent.stakingAmount}</div>
                        <div className="text-[9px] text-muted-foreground uppercase">Staked</div>
                      </div>
                    </div>

                    {/* Tools */}
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.slice(0, 4).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                          {t}
                        </Badge>
                      ))}
                      {agent.tools.length > 4 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          +{agent.tools.length - 4}
                        </Badge>
                      )}
                    </div>

                    <Separator className="my-1" />

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {truncatedOwner}
                      </span>
                      <Link href={`/api/agents/${agent.id}/invoke`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Invoke
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
