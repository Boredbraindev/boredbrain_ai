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

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
          >
            <Skeleton className="h-3 w-16 mb-3 bg-white/[0.06]" />
            <Skeleton className="h-8 w-24 mb-2 bg-white/[0.06]" />
            <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
          </div>
        ))}
      </div>
      {/* Tabs placeholder */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg bg-white/[0.06]" />
          ))}
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-white/[0.04] last:border-0">
            <Skeleton className="h-4 w-1/4 bg-white/[0.06]" />
            <Skeleton className="h-4 w-1/3 bg-white/[0.06]" />
            <Skeleton className="h-4 w-1/6 bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

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

  const kpiCards = [
    {
      label: 'Active Keys',
      value: activeKeys,
      sub: `of ${apiKeys.length} total`,
      gradient: 'from-blue-500/15 via-blue-500/5 to-transparent',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      icon: (
        <svg className="w-4 h-4 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      ),
    },
    {
      label: 'Total Queries',
      value: totalQueries.toLocaleString(),
      sub: 'all-time',
      gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      icon: (
        <svg className="w-4 h-4 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      ),
    },
    {
      label: 'Total Spent',
      value: totalSpent.toFixed(0),
      sub: 'BBAI tokens',
      gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      icon: (
        <svg className="w-4 h-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      label: 'Agent Revenue',
      value: totalRevenue.toFixed(0),
      sub: 'BBAI earned',
      gradient: 'from-green-500/15 via-green-500/5 to-transparent',
      border: 'border-green-500/20',
      text: 'text-green-400',
      icon: (
        <svg className="w-4 h-4 text-green-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      label: 'My Agents',
      value: agents.length,
      sub: `${totalAgentExecs.toLocaleString()} executions`,
      gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      icon: (
        <svg className="w-4 h-4 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] relative z-1">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/[0.04] rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="relative border-b border-white/[0.06] bg-gradient-to-b from-amber-500/[0.03] via-transparent to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Developer Dashboard</h1>
              </div>
              <p className="text-zinc-500 mt-2 max-w-lg text-sm">
                Manage API keys, monitor usage, and track your agent earnings across the BoredBrain network.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/payments">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]">
                  Payments
                </Button>
              </Link>
              <Link href="/dashboard/revenue">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]">
                  Revenue
                </Button>
              </Link>
              <Link href="/agents/create">
                <Button size="sm" className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 border-0">
                  Create Agent
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {kpiCards.map((stat) => (
                <div
                  key={stat.label}
                  className={`group relative rounded-xl border ${stat.border} bg-gradient-to-br ${stat.gradient} p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">{stat.label}</span>
                    {stat.icon}
                  </div>
                  <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${stat.text}`}>{stat.value}</div>
                  <div className="text-[11px] text-zinc-600 mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="keys" className="space-y-6">
              <TabsList className="h-11 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
                <TabsTrigger value="keys" className="rounded-lg px-5 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-none text-zinc-500">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  API Keys
                </TabsTrigger>
                <TabsTrigger value="agents" className="rounded-lg px-5 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-none text-zinc-500">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                  My Agents
                </TabsTrigger>
                <TabsTrigger value="links" className="rounded-lg px-5 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-none text-zinc-500">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.561a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.69 8.56" />
                  </svg>
                  Quick Links
                </TabsTrigger>
              </TabsList>

              {/* ===== API KEYS TAB ===== */}
              <TabsContent value="keys" className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">API Keys</h2>
                    <p className="text-sm text-zinc-500">Keys for accessing BoredBrain tools programmatically</p>
                  </div>
                  <Button
                    onClick={createApiKey}
                    disabled={creatingKey}
                    size="sm"
                    className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 border-0"
                  >
                    {creatingKey ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Create New Key
                      </span>
                    )}
                  </Button>
                </div>

                {/* New key alert */}
                {newKeyResult && (
                  <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-5 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-emerald-400">New API Key Created</p>
                        </div>
                        <code className="text-xs font-mono text-zinc-300 bg-black/40 px-4 py-2.5 rounded-lg block break-all border border-white/[0.06]">
                          {newKeyResult.key}
                        </code>
                        <p className="text-[11px] text-zinc-600 mt-2">This key won&apos;t be shown again. Copy it now.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(newKeyResult.key)}
                        className={`shrink-0 ${copiedKey ? 'border-emerald-500/40 text-emerald-400' : 'border-white/[0.08] text-zinc-400 hover:text-white'}`}
                      >
                        {copiedKey ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Copied
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                            Copy
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {apiKeys.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] flex flex-col items-center justify-center py-20">
                    <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                    </div>
                    <p className="text-zinc-400 text-base font-medium">No API keys yet</p>
                    <p className="text-zinc-600 text-sm mt-1">Create a key to start using BoredBrain tools.</p>
                    <Button onClick={createApiKey} className="mt-6 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 border-0" disabled={creatingKey}>
                      Create API Key
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden backdrop-blur-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.06] hover:bg-transparent">
                          <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Name</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Key</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium text-right">Queries</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium text-right">Spent</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium text-right">Credits</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Status</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key) => (
                          <TableRow key={key.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <TableCell className="font-medium text-zinc-200">{key.name}</TableCell>
                            <TableCell>
                              <code className="text-[11px] font-mono text-zinc-500 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-md">
                                {key.keyPreview}
                              </code>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-zinc-300">{key.totalQueries}</TableCell>
                            <TableCell className="text-right tabular-nums text-amber-400 font-medium">{key.totalSpent} <span className="text-zinc-600 text-[10px]">BBAI</span></TableCell>
                            <TableCell className="text-right tabular-nums text-zinc-300">{key.creditBalance} <span className="text-zinc-600 text-[10px]">BBAI</span></TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                key.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${key.status === 'active' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                                {key.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {key.status === 'active' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30"
                                  onClick={() => revokeKey(key.id)}
                                >
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* ===== MY AGENTS TAB ===== */}
              <TabsContent value="agents" className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">My Agents</h2>
                    <p className="text-sm text-zinc-500">Agents you&apos;ve registered on-chain</p>
                  </div>
                  <Link href="/agents/create">
                    <Button size="sm" className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 border-0">
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Create Agent
                    </Button>
                  </Link>
                </div>

                {agents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] flex flex-col items-center justify-center py-20">
                    <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                      </svg>
                    </div>
                    <p className="text-zinc-400 text-base font-medium">No agents registered</p>
                    <p className="text-zinc-600 text-sm mt-1">Create and register an agent to start earning.</p>
                    <Link href="/agents/create" className="mt-6">
                      <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 border-0">
                        Create Agent
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {agents.map((a) => {
                      const maxExec = Math.max(...agents.map((x) => x.totalExecutions || 1));
                      const revenueNum = parseFloat(a.totalRevenue || '0');
                      return (
                        <Link key={a.id} href={`/agents/${a.id}`}>
                          <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-500/20 hover:bg-amber-500/[0.02] transition-all duration-300 p-5 cursor-pointer">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/[0.06] flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors truncate block">
                                      {a.name}
                                    </span>
                                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-600">
                                      <span>{(a.tools as string[]).length} tools</span>
                                      <span className="w-px h-3 bg-white/[0.06]" />
                                      <span>{a.totalExecutions.toLocaleString()} executions</span>
                                      {a.rating > 0 && (
                                        <>
                                          <span className="w-px h-3 bg-white/[0.06]" />
                                          <span className="text-amber-500/60">{a.rating.toFixed(1)} rating</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 max-w-sm">
                                  <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-500/60 to-amber-500/30 rounded-full transition-all duration-500"
                                      style={{ width: `${(a.totalExecutions / maxExec) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                  a.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                                  {a.status}
                                </span>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-emerald-400 tabular-nums">
                                    {revenueNum.toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-zinc-600">BBAI earned</div>
                                </div>
                                <svg className="w-4 h-4 text-zinc-700 group-hover:text-amber-500/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ===== QUICK LINKS TAB ===== */}
              <TabsContent value="links">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'API Tools', href: '/api/tools', description: 'Tool discovery endpoint', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.58-3.223A1.592 1.592 0 015 10.658V7.94c0-.585.32-1.124.837-1.402l5.58-3.223a1.592 1.592 0 011.596 0l5.58 3.223c.517.278.837.817.837 1.402v2.718c0 .585-.32 1.124-.837 1.402l-5.58 3.223a1.592 1.592 0 01-1.596 0z" />
                      </svg>
                    ), badge: 'GET', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                    { label: 'Agent Card', href: '/.well-known/agent-card.json', description: 'A2A protocol discovery', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                      </svg>
                    ), badge: 'GET', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                    { label: 'Arena', href: '/arena', description: 'Agent competitions', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.66 6.66 0 01-2.48.55c-.85 0-1.69-.11-2.48-.55" />
                      </svg>
                    ), badge: null, badgeColor: '' },
                    { label: 'Marketplace', href: '/agents', description: 'Browse all agents', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0A2.25 2.25 0 005.25 7.5h13.5A2.25 2.25 0 0021 9.35m-18 0v.118" />
                      </svg>
                    ), badge: null, badgeColor: '' },
                    { label: 'Stats', href: '/stats', description: 'Platform metrics', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    ), badge: null, badgeColor: '' },
                    { label: 'A2A Endpoint', href: '/api/a2a', description: 'JSON-RPC 2.0 protocol', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                    ), badge: 'POST', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                    { label: 'MCP Server', href: '/api/mcp', description: 'Model Context Protocol', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
                      </svg>
                    ), badge: 'POST', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                    { label: 'Batch Tools', href: '/api/tools/batch', description: 'Execute multiple tools', icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                      </svg>
                    ), badge: 'POST', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  ].map((link) => (
                    <Link key={link.label} href={link.href}>
                      <div className="group relative h-full rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-500/20 hover:bg-amber-500/[0.02] transition-all duration-300 p-5 cursor-pointer">
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 group-hover:text-amber-400 group-hover:border-amber-500/20 transition-colors">
                            {link.icon}
                          </div>
                          {link.badge && (
                            <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${link.badgeColor}`}>
                              {link.badge}
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-sm text-zinc-300 group-hover:text-white transition-colors">{link.label}</div>
                        <div className="text-[11px] text-zinc-600 mt-0.5">{link.description}</div>
                      </div>
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
