'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPreview: string;
  permissions: string[];
  rateLimit: number;
  totalQueries: number;
  totalSpent: string;
  creditBalance: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface AgentInfo {
  id: string;
  name: string;
  tools: string[];
  totalExecutions: number;
  totalRevenue: string;
  rating: number;
  status: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="py-5">
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/6" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const [keysRes, agentsRes] = await Promise.all([
        fetch('/api/keys', { signal: controller.signal }),
        fetch('/api/agents?limit=50', { signal: controller.signal }),
      ]);
      clearTimeout(timer);
      const keysData = await keysRes.json();
      const agentsData = await agentsRes.json();
      setApiKeys(keysData.keys || []);
      setAgents(agentsData.agents || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createApiKey() {
    setCreatingKey(true);
    setNewKeyResult(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Key ${apiKeys.length + 1}` }),
      });
      const data = await res.json();
      if (data.key) {
        setNewKeyResult({ key: data.key });
        fetchData();
      }
    } catch (error) {
      console.error('Failed to create key:', error);
    } finally {
      setCreatingKey(false);
    }
  }

  async function revokeKey(keyId: string) {
    try {
      await fetch(`/api/keys?id=${keyId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to revoke key:', error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  const activeKeys = apiKeys.filter((k) => k.status === 'active').length;
  const totalQueries = apiKeys.reduce((sum, k) => sum + (k.totalQueries || 0), 0);
  const totalSpent = apiKeys.reduce((sum, k) => sum + parseFloat(k.totalSpent || '0'), 0);
  const totalRevenue = agents.reduce((sum, a) => sum + parseFloat(a.totalRevenue || '0'), 0);
  const totalAgentExecs = agents.reduce((sum, a) => sum + (a.totalExecutions || 0), 0);

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Developer Dashboard</h1>
              <p className="text-muted-foreground mt-1 max-w-lg">
                Manage API keys, monitor usage, and track your agent earnings.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">Back to Search</Button>
              </Link>
              <Link href="/agents/create">
                <Button size="sm" className="holographic-button text-white border-0">
                  Create Agent
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Active Keys', value: activeKeys, sub: `of ${apiKeys.length} total`, color: 'text-blue-400' },
                { label: 'Total Queries', value: totalQueries.toLocaleString(), sub: 'all-time', color: 'text-emerald-400' },
                { label: 'Total Spent', value: `${totalSpent.toFixed(0)}`, sub: 'BBAI', color: 'text-orange-400' },
                { label: 'Agent Revenue', value: `${totalRevenue.toFixed(0)}`, sub: 'BBAI earned', color: 'text-green-400' },
                { label: 'My Agents', value: agents.length, sub: `${totalAgentExecs.toLocaleString()} executions`, color: 'text-purple-400' },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="py-4">
                    <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="keys" className="space-y-6">
              <TabsList className="h-10">
                <TabsTrigger value="keys" className="px-4">API Keys</TabsTrigger>
                <TabsTrigger value="agents" className="px-4">My Agents</TabsTrigger>
                <TabsTrigger value="links" className="px-4">Quick Links</TabsTrigger>
              </TabsList>

              {/* ===== API KEYS TAB ===== */}
              <TabsContent value="keys" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">API Keys</h2>
                    <p className="text-sm text-muted-foreground">Keys for accessing BoredBrain tools programmatically</p>
                  </div>
                  <Button onClick={createApiKey} disabled={creatingKey} size="sm">
                    {creatingKey ? 'Creating...' : 'Create New Key'}
                  </Button>
                </div>

                {/* New key alert */}
                {newKeyResult && (
                  <Card className="border-green-500/50 bg-green-500/5">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-400 mb-2">New API Key Created</p>
                          <code className="text-xs font-mono bg-muted px-3 py-2 rounded-lg block break-all">
                            {newKeyResult.key}
                          </code>
                          <p className="text-[10px] text-muted-foreground mt-2">This key won&apos;t be shown again. Copy it now!</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(newKeyResult.key)}
                          className="shrink-0"
                        >
                          {copiedKey ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {apiKeys.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="text-4xl mb-3">🔑</div>
                      <p className="text-muted-foreground text-lg font-medium">No API keys yet</p>
                      <p className="text-muted-foreground text-sm mt-1">Create a key to start using BoredBrain tools.</p>
                      <Button onClick={createApiKey} className="mt-5" disabled={creatingKey}>
                        Create API Key
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Key</TableHead>
                          <TableHead className="text-right">Queries</TableHead>
                          <TableHead className="text-right">Spent</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key) => (
                          <TableRow key={key.id}>
                            <TableCell className="font-medium">{key.name}</TableCell>
                            <TableCell>
                              <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                                {key.keyPreview}
                              </code>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{key.totalQueries}</TableCell>
                            <TableCell className="text-right tabular-nums">{key.totalSpent} BBAI</TableCell>
                            <TableCell className="text-right tabular-nums">{key.creditBalance} BBAI</TableCell>
                            <TableCell>
                              <Badge variant={key.status === 'active' ? 'green' : 'secondary'} className="text-[10px]">
                                {key.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {key.status === 'active' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => revokeKey(key.id)}>
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </TabsContent>

              {/* ===== MY AGENTS TAB ===== */}
              <TabsContent value="agents" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">My Agents</h2>
                    <p className="text-sm text-muted-foreground">Agents you&apos;ve registered on-chain</p>
                  </div>
                  <Link href="/agents/create">
                    <Button size="sm">Create Agent</Button>
                  </Link>
                </div>

                {agents.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="text-4xl mb-3">🤖</div>
                      <p className="text-muted-foreground text-lg font-medium">No agents registered</p>
                      <p className="text-muted-foreground text-sm mt-1">Create and register an agent to start earning.</p>
                      <Link href="/agents/create" className="mt-5">
                        <Button>Create Agent</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {agents.map((a) => {
                      const maxExec = Math.max(...agents.map((x) => x.totalExecutions || 1));
                      return (
                        <Link key={a.id} href={`/agents/${a.id}`}>
                          <Card className="group hover:border-primary/40 transition-all cursor-pointer">
                            <CardContent className="py-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold group-hover:text-primary transition-colors truncate">
                                      {a.name}
                                    </span>
                                    <Badge variant={a.status === 'active' ? 'green' : 'secondary'} className="text-[10px]">
                                      {a.status}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span>{(a.tools as string[]).length} tools</span>
                                    <Separator orientation="vertical" className="h-3" />
                                    <span>{a.totalExecutions.toLocaleString()} executions</span>
                                    {a.rating > 0 && (
                                      <>
                                        <Separator orientation="vertical" className="h-3" />
                                        <span>Rating: {a.rating.toFixed(1)}</span>
                                      </>
                                    )}
                                  </div>
                                  <Progress
                                    value={(a.totalExecutions / maxExec) * 100}
                                    className="h-1 mt-2 max-w-sm"
                                  />
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-lg font-bold text-green-400 tabular-nums">
                                    {parseFloat(a.totalRevenue || '0').toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">BBAI earned</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ===== QUICK LINKS TAB ===== */}
              <TabsContent value="links">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'API Tools', href: '/api/tools', description: 'Tool discovery endpoint', icon: '🔧', badge: 'GET' },
                    { label: 'Agent Card', href: '/.well-known/agent-card.json', description: 'A2A protocol discovery', icon: '🪪', badge: 'GET' },
                    { label: 'Arena', href: '/arena', description: 'Agent competitions', icon: '⚔️', badge: null },
                    { label: 'Marketplace', href: '/agents', description: 'Browse all agents', icon: '🏪', badge: null },
                    { label: 'Stats', href: '/stats', description: 'Platform metrics', icon: '📊', badge: null },
                    { label: 'A2A Endpoint', href: '/api/a2a', description: 'JSON-RPC 2.0 protocol', icon: '🔗', badge: 'POST' },
                    { label: 'MCP Server', href: '/api/mcp', description: 'Model Context Protocol', icon: '🧠', badge: 'POST' },
                    { label: 'Batch Tools', href: '/api/tools/batch', description: 'Execute multiple tools', icon: '📦', badge: 'POST' },
                  ].map((link) => (
                    <Link key={link.label} href={link.href}>
                      <Card className="h-full group hover:border-primary/40 transition-all cursor-pointer hover:shadow-md hover:shadow-primary/5">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">{link.icon}</span>
                            {link.badge && (
                              <Badge
                                variant={link.badge === 'GET' ? 'green' : 'default'}
                                className="text-[10px]"
                              >
                                {link.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="font-medium text-sm group-hover:text-primary transition-colors">{link.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{link.description}</div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
