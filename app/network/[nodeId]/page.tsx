'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
    second: '2-digit',
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  return (
    <span className="relative flex h-3 w-3">
      {status === 'online' && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${config.dot}`} />
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.custom;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor}`}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NodeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const nodeId = params.nodeId as string;
  const showInvoke = searchParams.get('invoke') === 'true';

  const [node, setNode] = useState<NetworkNode | null>(null);
  const [messages, setMessages] = useState<NetworkMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invoke form state
  const [invokeQuery, setInvokeQuery] = useState('');
  const [invokeTools, setInvokeTools] = useState('');
  const [invokeBudget, setInvokeBudget] = useState('100');
  const [invokeResult, setInvokeResult] = useState<any>(null);
  const [invoking, setInvoking] = useState(false);

  const [activeTab, setActiveTab] = useState(showInvoke ? 'invoke' : 'overview');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/network');
        if (!res.ok) throw new Error('Failed to fetch network data');
        const json = await res.json();

        const foundNode = json.nodes.find((n: NetworkNode) => n.id === nodeId);
        if (!foundNode) {
          setError(`Node not found: ${nodeId}`);
          return;
        }
        setNode(foundNode);

        // Filter messages for this node
        const nodeMessages = (json.recentMessages as NetworkMessage[]).filter(
          (m) => m.fromNodeId === nodeId || m.toNodeId === nodeId,
        );
        setMessages(nodeMessages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [nodeId]);

  // Computed stats
  const perfStats = useMemo(() => {
    if (!messages.length) {
      return { successRate: 100, avgLatency: 0, invokeCount: 0, responseCount: 0 };
    }

    const invokeMessages = messages.filter((m) => m.type === 'invoke');
    const responseMessages = messages.filter((m) => m.type === 'response');
    const failedMessages = messages.filter((m) => m.status === 'failed');
    const totalWithStatus = invokeMessages.length + responseMessages.length;
    const successRate =
      totalWithStatus > 0
        ? Math.round(((totalWithStatus - failedMessages.length) / totalWithStatus) * 100)
        : 100;
    const avgLatency =
      messages.length > 0
        ? Math.round(messages.reduce((sum, m) => sum + m.latency, 0) / messages.length)
        : 0;

    return {
      successRate,
      avgLatency,
      invokeCount: invokeMessages.length,
      responseCount: responseMessages.length,
    };
  }, [messages]);

  async function handleInvoke() {
    if (!invokeQuery.trim()) return;
    setInvoking(true);
    setInvokeResult(null);

    try {
      const toolsList = invokeTools
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/network/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetNodeId: nodeId,
          query: invokeQuery,
          tools: toolsList.length > 0 ? toolsList : undefined,
          maxBudget: parseFloat(invokeBudget) || undefined,
        }),
      });

      const json = await res.json();
      setInvokeResult(json);
    } catch (err) {
      setInvokeResult({
        error: err instanceof Error ? err.message : 'Invocation failed',
      });
    } finally {
      setInvoking(false);
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium mb-2">
              {error || 'Node not found'}
            </p>
            <Link href="/network">
              <Button className="mt-4">Back to Network</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const platformConfig = PLATFORM_CONFIG[node.platform] || PLATFORM_CONFIG.custom;
  const statusConfig = STATUS_CONFIG[node.status] || STATUS_CONFIG.offline;
  const trustColor =
    node.trustScore >= 90
      ? 'text-green-400'
      : node.trustScore >= 70
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ---- Breadcrumb ---- */}
        <Link
          href="/network"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Network
        </Link>

        {/* ---- Header ---- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <StatusDot status={node.status} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{node.name}</h1>
              <p className="text-sm text-muted-foreground font-mono">
                {node.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PlatformBadge platform={node.platform} />
            <Badge
              variant="outline"
              className={`${statusConfig.dot.replace('bg-', 'text-').replace('-500', '-400')}`}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* ---- Tabs ---- */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="invoke">Invoke</TabsTrigger>
          </TabsList>

          {/* ---- Overview Tab ---- */}
          <TabsContent value="overview" className="space-y-6">
            {/* Node info card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Node Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Endpoint
                    </p>
                    <p className="text-sm font-mono break-all">{node.endpoint}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Agent Card URL
                    </p>
                    <p className="text-sm font-mono break-all">
                      {node.agentCardUrl}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Platform
                    </p>
                    <PlatformBadge platform={node.platform} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Status
                    </p>
                    <div className="flex items-center gap-2">
                      <StatusDot status={node.status} />
                      <span className="text-sm">{statusConfig.label}</span>
                    </div>
                  </div>
                  {node.chain && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Chain
                      </p>
                      <p className="text-sm">{node.chain}</p>
                    </div>
                  )}
                  {node.walletAddress && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Wallet Address
                      </p>
                      <p className="text-sm font-mono break-all">
                        {node.walletAddress}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Last Seen
                    </p>
                    <p className="text-sm">
                      {formatRelativeTime(node.lastSeen)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Trust Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Trust Score</span>
                    <span className={`text-sm font-bold ${trustColor}`}>
                      {node.trustScore}/100
                    </span>
                  </div>
                  <Progress value={node.trustScore} className="h-2" />
                </div>

                <Separator />

                {/* Capabilities */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Capabilities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {node.capabilities.map((cap) => (
                      <Badge key={cap} variant="outline" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                    {node.capabilities.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No capabilities listed
                      </span>
                    )}
                  </div>
                </div>

                {/* Tools */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Tools ({node.tools.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {node.tools.map((tool) => (
                      <Badge key={tool} variant="secondary" className="text-xs font-mono">
                        {tool}
                      </Badge>
                    ))}
                    {node.tools.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No tools registered
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Total Interactions
                    </p>
                    <p className="text-xl font-bold">{node.totalInteractions}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Avg Latency
                    </p>
                    <p className="text-xl font-bold">{perfStats.avgLatency}ms</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Success Rate
                    </p>
                    <p className="text-xl font-bold text-green-400">
                      {perfStats.successRate}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Current Latency
                    </p>
                    <p className="text-xl font-bold">{node.latency}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Messages Tab ---- */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Message History</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {messages.length} messages
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No messages recorded for this node.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[600px] overflow-y-auto">
                    {messages.map((msg) => {
                      const typeConfig =
                        MESSAGE_TYPE_CONFIG[msg.type] ||
                        MESSAGE_TYPE_CONFIG.heartbeat;
                      const isOutgoing = msg.fromNodeId === nodeId;
                      const payloadStr = msg.payload
                        ? JSON.stringify(msg.payload).slice(0, 120)
                        : '{}';

                      return (
                        <div
                          key={msg.id}
                          className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap pt-0.5 w-20 shrink-0">
                            {formatTime(msg.timestamp)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-xs font-medium ${isOutgoing ? 'text-orange-400' : 'text-blue-400'}`}
                              >
                                {isOutgoing ? 'OUT' : 'IN'}
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
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {isOutgoing ? msg.toNodeId : msg.fromNodeId}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-medium ${typeConfig.color}`}
                              >
                                {msg.type}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 break-all">
                              {payloadStr}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                              {msg.latency}ms
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Invoke Tab ---- */}
          <TabsContent value="invoke" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoke Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Query
                  </label>
                  <Input
                    placeholder="Enter your query for this agent..."
                    value={invokeQuery}
                    onChange={(e) => setInvokeQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvoke()}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Tools (comma-separated, optional)
                  </label>
                  <Input
                    placeholder={`e.g. ${node.tools.slice(0, 2).join(', ')}`}
                    value={invokeTools}
                    onChange={(e) => setInvokeTools(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Available: {node.tools.join(', ') || 'none'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Max Budget (BBAI)
                  </label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={invokeBudget}
                    onChange={(e) => setInvokeBudget(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleInvoke}
                  disabled={invoking || !invokeQuery.trim()}
                  className="w-full"
                >
                  {invoking ? 'Invoking...' : 'Invoke Agent'}
                </Button>
              </CardContent>
            </Card>

            {/* Invoke Result */}
            {invokeResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {invokeResult.error ? 'Error' : 'Result'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {invokeResult.error ? (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
                      <p className="text-sm text-destructive">
                        {invokeResult.error}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-sm whitespace-pre-wrap">
                          {invokeResult.result?.response}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Cost
                          </p>
                          <p className="text-sm font-bold">
                            {invokeResult.result?.cost} BBAI
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Latency
                          </p>
                          <p className="text-sm font-bold">
                            {invokeResult.result?.latency}ms
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Trust
                          </p>
                          <p className="text-sm font-bold">
                            {invokeResult.node?.trustScore}/100
                          </p>
                        </div>
                      </div>
                      {invokeResult.billing && (
                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                          <p className="text-xs text-yellow-400 font-medium mb-1">
                            Billing
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invokeResult.billing.totalCost} BBAI settled
                            between {invokeResult.billing.callerNodeId} and{' '}
                            {invokeResult.billing.targetNodeId}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
