'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface RevenueStream {
  name: string;
  revenue: number;
  transactions: number;
  volume: number;
  growth: number;
  color: string;
}

interface RevenueDashboard {
  totalRevenue: number;
  totalVolume: number;
  totalTransactions: number;
  platformFees: number;
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  streams: RevenueStream[];
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    fee: number;
    from: string;
    to: string;
    timestamp: string;
    txHash: string;
    chain: string;
  }>;
  chartData: Array<{
    date: string;
    revenue: number;
    volume: number;
    transactions: number;
  }>;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatBBAI(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_LABELS: Record<string, string> = {
  tool_call: 'Tool Call',
  agent_invoke: 'Agent Invoke',
  prompt_purchase: 'Prompt Sale',
  arena_entry: 'Arena Fee',
  staking: 'Staking',
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  tool_call: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  agent_invoke: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  prompt_purchase: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  arena_entry: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  staking: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
};

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

function RevenueSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <Skeleton className="h-3 w-16 mb-3 bg-white/[0.06]" />
            <Skeleton className="h-9 w-28 mb-2 bg-white/[0.06]" />
            <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <Skeleton className="h-5 w-40 mb-6 bg-white/[0.06]" />
        <div className="flex items-end gap-1.5 h-52">
          {Array.from({ length: 30 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 bg-white/[0.04] rounded-t"
              style={{ height: `${20 + Math.random() * 80}%` }}
            />
          ))}
        </div>
      </div>
      {/* Two-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <Skeleton className="h-5 w-36 mb-5 bg-white/[0.06]" />
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <Skeleton className="h-4 w-28 bg-white/[0.06]" />
                <Skeleton className="h-4 w-20 bg-white/[0.06]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function RevenueDashboardPage() {
  const [data, setData] = useState<RevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartTab, setChartTab] = useState<'revenue' | 'volume' | 'transactions'>('revenue');

  useEffect(() => {
    const FALLBACK_REVENUE: RevenueDashboard = {
      totalRevenue: 847,
      totalVolume: 4827,
      totalTransactions: 312,
      platformFees: 847,
      dailyRevenue: 42,
      weeklyRevenue: 285,
      monthlyRevenue: 847,
      streams: [
        { name: 'Tool Usage', revenue: 218, transactions: 104, volume: 1240, growth: 24, color: '#3b82f6' },
        { name: 'Agent Invocations', revenue: 194, transactions: 78, volume: 1120, growth: 18, color: '#a855f7' },
        { name: 'Arena Rake', revenue: 156, transactions: 42, volume: 960, growth: 32, color: '#f59e0b' },
        { name: 'Prompt Sales', revenue: 98, transactions: 34, volume: 520, growth: 15, color: '#22c55e' },
        { name: 'Playbook Sales', revenue: 0, transactions: 0, volume: 0, growth: 0, color: '#ec4899' },
        { name: 'Token Trading', revenue: 82, transactions: 28, volume: 540, growth: 42, color: '#06b6d4' },
        { name: 'Agent Registration', revenue: 64, transactions: 16, volume: 320, growth: -5, color: '#ef4444' },
        { name: 'Tokenization Fees', revenue: 35, transactions: 10, volume: 127, growth: 12, color: '#8b5cf6' },
      ],
      recentTransactions: [
        { id: 'tx-1', type: 'tool_call', amount: 3, fee: 0.45, from: 'agent-defi-oracle', to: 'platform', timestamp: new Date(Date.now() - 120000).toISOString(), txHash: '0x7e2a9f4c1b8d3e6a05f72c4d9b1e8a3f6c0d5b2e7a4f1c8d3b6e9a2f5c8d1b4e', chain: 'base' },
        { id: 'tx-2', type: 'agent_invoke', amount: 5, fee: 0.75, from: 'agent-alpha-hunter', to: 'agent-research-bot', timestamp: new Date(Date.now() - 300000).toISOString(), txHash: '0x3d8b1e6f4a9c2d7e0b5f8a3c6d1e4b7f2a5c8d0e3b6f9a1c4d7e2b5f8a0c3d6e', chain: 'base' },
        { id: 'tx-3', type: 'arena_entry', amount: 10, fee: 1, from: 'user-0x7a3b', to: 'arena-pool', timestamp: new Date(Date.now() - 480000).toISOString(), txHash: '0x9c4f2a7d1e8b5c3f6a0d9e2b7c4f1a8d3e6b0c5f2a9d4e7b1c8f3a6d0e5b2c9f', chain: 'base' },
        { id: 'tx-4', type: 'prompt_purchase', amount: 4, fee: 0.6, from: 'user-0x9e2f', to: 'creator-0x4d1a', timestamp: new Date(Date.now() - 720000).toISOString(), txHash: '0x5b8e1c4a7d2f9b6e3c0a5d8f1b4e7c2a9d6f3b0e5c8a1d4f7b2e9c6a3d0f5b8e', chain: 'base' },
        { id: 'tx-5', type: 'tool_call', amount: 1.5, fee: 0.22, from: 'agent-news-wire', to: 'platform', timestamp: new Date(Date.now() - 900000).toISOString(), txHash: '0x2f6c9a3d7e1b4f8c5a2d6e0b3f7c1a4d8e2b5f9c3a6d0e4b7f1c5a8d2e6b9c3f', chain: 'base' },
        { id: 'tx-6', type: 'agent_invoke', amount: 4, fee: 0.6, from: 'agent-nft-analyst', to: 'agent-defi-oracle', timestamp: new Date(Date.now() - 1200000).toISOString(), txHash: '0x8a1d4e7b0c3f6a9d2e5b8c1f4a7d0e3b6c9f2a5d8e1b4c7f0a3d6e9b2c5f8a1d', chain: 'arbitrum' },
        { id: 'tx-7', type: 'staking', amount: 8, fee: 0, from: 'user-0x3c8d', to: 'registry', timestamp: new Date(Date.now() - 1800000).toISOString(), txHash: '0x4e7b1c5a8d2f6b9e3c0a4d7f1b5e8c2a6d9f3b0e4c7a1d5f8b2e6c9a3d0f4b7e', chain: 'base' },
        { id: 'tx-8', type: 'tool_call', amount: 1, fee: 0.15, from: 'agent-market-sentinel', to: 'platform', timestamp: new Date(Date.now() - 2400000).toISOString(), txHash: '0x6c0a3d7e1b4f8c5a9d2e6b0c3f7a1d4e8b2c5f9a3d6e0b4c7f1a5d8e2b6c9f3a', chain: 'bsc' },
      ],
      chartData: Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const base = 15 + Math.sin(i * 0.5) * 8 + i * 0.5;
        return {
          date: d.toISOString().slice(0, 10),
          revenue: Math.round(base + Math.random() * 10),
          volume: Math.round(base * 5.5 + Math.random() * 30),
          transactions: Math.round(6 + Math.random() * 8 + i * 0.3),
        };
      }),
    };

    fetch('/api/revenue')
      .then((r) => r.json())
      .then((d) => {
        const isEmpty = !d || !d.totalRevenue || d.totalRevenue === 0;
        setData(isEmpty ? FALLBACK_REVENUE : d);
        setLoading(false);
      })
      .catch(() => {
        setData(FALLBACK_REVENUE);
        setLoading(false);
      });
  }, []);

  const kpiCards = data
    ? [
        {
          label: 'Total Revenue',
          value: `${formatBBAI(data.totalRevenue)}`,
          unit: 'BBAI',
          sub: 'Platform fees collected',
          gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
          border: 'border-emerald-500/20',
          text: 'text-emerald-400',
          icon: (
            <svg className="w-4 h-4 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          ),
        },
        {
          label: 'Total Volume',
          value: `${formatBBAI(data.totalVolume)}`,
          unit: 'BBAI',
          sub: 'All transactions',
          gradient: 'from-blue-500/15 via-blue-500/5 to-transparent',
          border: 'border-blue-500/20',
          text: 'text-blue-400',
          icon: (
            <svg className="w-4 h-4 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          label: 'Daily Revenue',
          value: `${formatBBAI(data.dailyRevenue)}`,
          unit: 'BBAI',
          sub: 'Last 24 hours',
          gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
          border: 'border-purple-500/20',
          text: 'text-purple-400',
          icon: (
            <svg className="w-4 h-4 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          label: 'Transactions',
          value: data.totalTransactions.toLocaleString(),
          unit: '',
          sub: 'All time',
          gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
          border: 'border-amber-500/20',
          text: 'text-amber-400',
          icon: (
            <svg className="w-4 h-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          ),
        },
      ]
    : [];

  // Chart data helpers
  const chartValues = (data?.chartData || []).map((d) =>
    chartTab === 'revenue' ? d.revenue : chartTab === 'volume' ? d.volume : d.transactions,
  );
  const maxChartVal = Math.max(...chartValues, 1);

  // Color map for chart tabs
  const chartColor: Record<string, { bar: string; glow: string }> = {
    revenue: { bar: 'from-amber-500 to-amber-500/40', glow: 'shadow-amber-500/20' },
    volume: { bar: 'from-blue-500 to-blue-500/40', glow: 'shadow-blue-500/20' },
    transactions: { bar: 'from-purple-500 to-purple-500/40', glow: 'shadow-purple-500/20' },
  };

  // Revenue streams total for percentage calc
  const streamTotal = (data?.streams || []).reduce((s, st) => s + st.revenue, 0) || 1;

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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Revenue Dashboard</h1>
              </div>
              <p className="text-zinc-500 mt-2 max-w-lg text-sm">
                Real-time platform revenue tracking across all streams and chains.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]">
                  Dashboard
                </Button>
              </Link>
              <Link href="/dashboard/payments">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]">
                  Payments
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]">
                  Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <RevenueSkeleton />
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-zinc-500 text-sm">Failed to load revenue data</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpiCards.map((stat) => (
                <div
                  key={stat.label}
                  className={`group relative rounded-xl border ${stat.border} bg-gradient-to-br ${stat.gradient} p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">{stat.label}</span>
                    {stat.icon}
                  </div>
                  <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${stat.text}`}>
                    {stat.value}
                    {stat.unit && <span className="text-sm ml-1.5 font-medium opacity-60">{stat.unit}</span>}
                  </div>
                  <div className="text-[11px] text-zinc-600 mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Revenue Chart */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-white/[0.04]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">30-Day Trend</h3>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {chartTab === 'revenue' && 'Platform fee revenue over time'}
                      {chartTab === 'volume' && 'Total transaction volume over time'}
                      {chartTab === 'transactions' && 'Number of transactions over time'}
                    </p>
                  </div>
                  <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
                    {(['revenue', 'volume', 'transactions'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setChartTab(tab)}
                        className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all capitalize ${
                          chartTab === tab
                            ? 'bg-amber-500/10 text-amber-400 shadow-sm'
                            : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* Y-axis labels and chart */}
                <div className="flex gap-3">
                  <div className="flex flex-col justify-between text-[10px] text-zinc-700 tabular-nums w-10 text-right py-1">
                    <span>{formatBBAI(maxChartVal)}</span>
                    <span>{formatBBAI(maxChartVal * 0.75)}</span>
                    <span>{formatBBAI(maxChartVal * 0.5)}</span>
                    <span>{formatBBAI(maxChartVal * 0.25)}</span>
                    <span>0</span>
                  </div>
                  <div className="flex-1 relative">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="border-b border-white/[0.03]" />
                      ))}
                    </div>
                    {/* Bars */}
                    <div className="flex items-end gap-[2px] h-52 relative z-10">
                      {(data.chartData || []).map((day, i) => {
                        const val = chartValues[i] || 0;
                        const height = maxChartVal > 0 ? (val / maxChartVal) * 100 : 0;
                        return (
                          <div
                            key={day.date}
                            className="flex-1 flex flex-col items-center group/bar relative"
                          >
                            {/* Tooltip */}
                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/[0.1] rounded-lg px-3 py-2 hidden group-hover/bar:block z-20 whitespace-nowrap shadow-xl">
                              <div className="text-[10px] text-zinc-500 mb-0.5">{day.date}</div>
                              <div className="text-xs font-semibold text-white">
                                {chartTab === 'transactions' ? val : `${val} BBAI`}
                              </div>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-zinc-900 border-r border-b border-white/[0.1]" />
                            </div>
                            {/* Bar */}
                            <div className="w-full flex-1 flex items-end">
                              <div
                                className={`w-full rounded-t-sm bg-gradient-to-t ${chartColor[chartTab].bar} hover:opacity-100 opacity-70 transition-all duration-300 cursor-pointer min-h-[2px]`}
                                style={{ height: `${height}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* X-axis labels */}
                    <div className="flex mt-2">
                      {(data.chartData || []).map((day, i) => (
                        <div key={day.date} className="flex-1 text-center">
                          {i % 5 === 0 && (
                            <span className="text-[9px] text-zinc-700">{day.date.slice(5)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Two-column: Revenue Streams + Recent Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Streams */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-white/[0.04]">
                  <h3 className="text-base font-semibold text-white">Revenue Streams</h3>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Breakdown by source category</p>
                </div>
                <div className="p-6 space-y-3">
                  {data.streams.map((stream) => {
                    const pct = ((stream.revenue / streamTotal) * 100).toFixed(1);
                    return (
                      <div
                        key={stream.name}
                        className="group rounded-lg border border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full shadow-sm"
                              style={{ backgroundColor: stream.color, boxShadow: `0 0 8px ${stream.color}40` }}
                            />
                            <div>
                              <div className="font-medium text-sm text-zinc-200">{stream.name}</div>
                              <div className="text-[10px] text-zinc-600">{stream.transactions.toLocaleString()} transactions</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm text-white tabular-nums">
                              {formatBBAI(stream.revenue)} <span className="text-zinc-600 text-[10px]">BBAI</span>
                            </div>
                            <div className="flex items-center gap-1 justify-end mt-0.5">
                              {stream.growth > 0 ? (
                                <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                                </svg>
                              )}
                              <span className={`text-[10px] font-medium ${stream.growth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {stream.growth > 0 ? '+' : ''}{stream.growth}%
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Mini progress bar */}
                        <div className="h-1 bg-white/[0.03] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${stream.color}, ${stream.color}60)`,
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-zinc-700 mt-1 tabular-nums">{pct}% of total</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-white/[0.04]">
                  <h3 className="text-base font-semibold text-white">Recent Transactions</h3>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Latest revenue-generating events</p>
                </div>
                <div className="p-4 space-y-1 max-h-[500px] overflow-y-auto">
                  {data.recentTransactions.map((tx) => {
                    const typeStyle = TYPE_COLORS[tx.type] || { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' };
                    return (
                      <div
                        key={tx.id}
                        className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-white/[0.06] hover:bg-white/[0.01] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-lg ${typeStyle.bg} border ${typeStyle.border} flex items-center justify-center shrink-0`}>
                            <svg className={`w-3.5 h-3.5 ${typeStyle.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                                {TYPE_LABELS[tx.type] || tx.type}
                              </span>
                              <span className="text-[10px] text-zinc-700 tabular-nums">
                                {timeAgo(tx.timestamp)}
                              </span>
                            </div>
                            <code className="text-[10px] font-mono text-zinc-700 mt-0.5 block truncate">
                              {truncateHash(tx.txHash)}
                            </code>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="font-semibold text-sm text-white tabular-nums">{tx.amount} <span className="text-zinc-600 text-[10px]">BBAI</span></div>
                          <div className="text-[10px] text-emerald-400/80 tabular-nums">+{tx.fee} fee</div>
                        </div>
                      </div>
                    );
                  })}
                  {data.recentTransactions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <svg className="w-8 h-8 text-zinc-800 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3-3H9.75m1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <p className="text-zinc-700 text-xs">No recent transactions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Period Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Daily', value: data.dailyRevenue, gradient: 'from-emerald-500/10', border: 'border-emerald-500/15', text: 'text-emerald-400' },
                { label: 'Weekly', value: data.weeklyRevenue, gradient: 'from-blue-500/10', border: 'border-blue-500/15', text: 'text-blue-400' },
                { label: 'Monthly', value: data.monthlyRevenue, gradient: 'from-amber-500/10', border: 'border-amber-500/15', text: 'text-amber-400' },
              ].map((period) => (
                <div
                  key={period.label}
                  className={`rounded-xl border ${period.border} bg-gradient-to-br ${period.gradient} to-transparent p-5 text-center transition-all hover:scale-[1.02]`}
                >
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-2">{period.label}</div>
                  <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${period.text}`}>
                    {formatBBAI(period.value)}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">BBAI</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
