'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetworkNode {
  id: string;
  name: string;
  platform: 'boredbrain' | 'claude' | 'openai' | 'gemini' | 'custom';
  endpoint: string;
  agentCardUrl: string;
  capabilities: string[];
  tools: string[];
  status: 'online' | 'offline' | 'degraded';
  lastSeen: string;
  latency: number;
  totalInteractions: number;
  trustScore: number;
  chain: string | null;
  walletAddress: string | null;
}

interface NetworkMessage {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: 'discovery' | 'invoke' | 'response' | 'billing' | 'heartbeat';
  payload: any;
  timestamp: string;
  latency: number;
  status: 'sent' | 'delivered' | 'processed' | 'failed';
}

interface NetworkStats {
  totalNodes: number;
  onlineNodes: number;
  totalMessages: number;
  avgLatency: number;
  totalVolume: number;
  platformBreakdown: Record<string, number>;
}

interface NetworkData {
  stats: NetworkStats;
  nodes: NetworkNode[];
  recentMessages: NetworkMessage[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  boredbrain: {
    label: 'BoredBrain',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/30',
  },
  claude: {
    label: 'Claude',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/30',
  },
  openai: {
    label: 'OpenAI',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    borderColor: 'border-green-500/30',
  },
  gemini: {
    label: 'Gemini',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
  },
  custom: {
    label: 'Custom',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/15',
    borderColor: 'border-gray-500/30',
  },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  online: { dot: 'bg-green-500', label: 'Online' },
  offline: { dot: 'bg-red-500', label: 'Offline' },
  degraded: { dot: 'bg-yellow-500', label: 'Degraded' },
};

const MESSAGE_TYPE_CONFIG: Record<string, { color: string }> = {
  discovery: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  invoke: { color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  response: { color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  billing: { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  heartbeat: { color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

function NodeCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />
        <Skeleton className="h-2 w-full rounded-full mb-4" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === 'online' && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dot}`} />
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.custom;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor}`}
    >
      {config.label}
    </span>
  );
}

function PlatformBar({
  platform,
  count,
  total,
}: {
  platform: string;
  count: number;
  total: number;
}) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.custom;
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-medium w-24 ${config.color}`}>
        {config.label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor:
              platform === 'boredbrain'
                ? '#a855f7'
                : platform === 'claude'
                  ? '#f97316'
                  : platform === 'openai'
                    ? '#22c55e'
                    : platform === 'gemini'
                      ? '#3b82f6'
                      : '#6b7280',
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {count}
      </span>
    </div>
  );
}

function NodeCard({ node }: { node: NetworkNode }) {
  const truncatedEndpoint =
    node.endpoint.length > 40
      ? node.endpoint.slice(0, 37) + '...'
      : node.endpoint;

  const trustColor =
    node.trustScore >= 90
      ? 'text-green-400'
      : node.trustScore >= 70
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <Card className="h-full hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot status={node.status} />
            <CardTitle className="text-sm font-semibold truncate">
              {node.name}
            </CardTitle>
          </div>
          <PlatformBadge platform={node.platform} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Endpoint */}
        <p className="text-xs text-muted-foreground font-mono truncate" title={node.endpoint}>
          {truncatedEndpoint}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Tools
            </p>
            <p className="text-sm font-semibold">{node.tools.length}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Calls
            </p>
            <p className="text-sm font-semibold">{node.totalInteractions}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Latency
            </p>
            <p className="text-sm font-semibold">{node.latency}ms</p>
          </div>
        </div>

        {/* Trust score */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Trust Score</span>
            <span className={`text-xs font-semibold ${trustColor}`}>
              {node.trustScore}/100
            </span>
          </div>
          <Progress value={node.trustScore} className="h-1.5" />
        </div>

        {/* Last seen */}
        <p className="text-[10px] text-muted-foreground">
          Last seen: {formatRelativeTime(node.lastSeen)}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Link href={`/network/${node.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs">
              View Details
            </Button>
          </Link>
          <Link href={`/network/${node.id}?invoke=true`} className="flex-1">
            <Button size="sm" className="w-full text-xs">
              Invoke
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageRow({ message }: { message: NetworkMessage }) {
  const typeConfig = MESSAGE_TYPE_CONFIG[message.type] || MESSAGE_TYPE_CONFIG.heartbeat;
  const payloadPreview = message.payload
    ? JSON.stringify(message.payload).slice(0, 80)
    : '{}';

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap pt-0.5 w-16 shrink-0">
        {formatTime(message.timestamp)}
      </span>

      {/* From -> To */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium truncate max-w-[120px]">
            {message.fromNodeId}
          </span>
          <svg
            className="w-3 h-3 text-muted-foreground shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
          <span className="text-xs font-medium truncate max-w-[120px]">
            {message.toNodeId}
          </span>
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-medium ${typeConfig.color}`}
          >
            {message.type}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
          {payloadPreview}
        </p>
      </div>

      {/* Latency & Status */}
      <div className="text-right shrink-0">
        <span className="text-[10px] text-muted-foreground">{message.latency}ms</span>
        <div>
          <span
            className={`text-[10px] ${
              message.status === 'processed'
                ? 'text-green-400'
                : message.status === 'failed'
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }`}
          >
            {message.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NetworkPage() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchNetwork() {
      try {
        const res = await fetch('/api/network');
        if (!res.ok) throw new Error('Failed to fetch network data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    fetchNetwork();
    const interval = setInterval(fetchNetwork, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    let nodes = data.nodes;
    if (platformFilter !== 'all') {
      nodes = nodes.filter((n) => n.platform === platformFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          n.endpoint.toLowerCase().includes(q),
      );
    }
    return nodes;
  }, [data, platformFilter, searchQuery]);

  const avgTrust = useMemo(() => {
    if (!data || data.nodes.length === 0) return 0;
    const sum = data.nodes.reduce((acc, n) => acc + n.trustScore, 0);
    return Math.round(sum / data.nodes.length);
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <NodeCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium mb-2">
              Failed to load network
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentMessages } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ---- Header ---- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Network</h1>
            <p className="text-muted-foreground mt-1">
              Cross-platform AI agent network -- MCP + A2A protocols
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
              <StatusDot status="online" />
              <span className="text-sm font-medium">
                {stats.onlineNodes} online
              </span>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-1.5">
              <span className="text-sm text-muted-foreground">
                {stats.totalMessages} msgs
              </span>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-1.5">
              <span className="text-sm text-muted-foreground">
                {stats.totalVolume.toFixed(1)} BBAI vol
              </span>
            </div>
          </div>
        </div>

        {/* ---- Stats Cards ---- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Total Nodes
              </p>
              <p className="text-2xl font-bold">{stats.totalNodes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Online
              </p>
              <p className="text-2xl font-bold text-green-400">
                {stats.onlineNodes}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Avg Latency
              </p>
              <p className="text-2xl font-bold">{stats.avgLatency}ms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Total Volume
              </p>
              <p className="text-2xl font-bold">
                {stats.totalVolume.toFixed(1)}{' '}
                <span className="text-sm text-muted-foreground">BBAI</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Avg Trust
              </p>
              <p className="text-2xl font-bold">{avgTrust}/100</p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Platform Breakdown ---- */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Platform Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Object.entries(stats.platformBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => (
                <PlatformBar
                  key={platform}
                  platform={platform}
                  count={count}
                  total={stats.totalNodes}
                />
              ))}
          </CardContent>
        </Card>

        {/* ---- Filters ---- */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={platformFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPlatformFilter('all')}
            >
              All
            </Button>
            {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
              <Button
                key={key}
                variant={platformFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPlatformFilter(key)}
              >
                {config.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ---- Node Grid ---- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredNodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
          {filteredNodes.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No nodes match your filters.</p>
            </div>
          )}
        </div>

        <Separator className="mb-8" />

        {/* ---- Recent Messages Feed ---- */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Messages</h2>
            <Badge variant="outline" className="text-xs">
              {recentMessages.length} messages
            </Badge>
          </div>
          <Card>
            <CardContent className="p-2 max-h-[500px] overflow-y-auto">
              {recentMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No messages yet.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentMessages.slice(0, 30).map((msg) => (
                    <MessageRow key={msg.id} message={msg} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---- Register External Agent CTA ---- */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <div>
              <p className="font-semibold">Register External Agent</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Connect a Claude, GPT, Gemini, or custom AI agent to the
                BoredBrain network via MCP or A2A.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/agents">
                <Button variant="outline">Agent Registry</Button>
              </Link>
              <Link href="/connectors">
                <Button>Register Agent</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
