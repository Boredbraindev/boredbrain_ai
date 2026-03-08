'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type PaymentType =
  | 'tool_call'
  | 'agent_invoke'
  | 'prompt_purchase'
  | 'arena_entry'
  | 'staking';

type ChainId = 'base' | 'bsc' | 'apechain' | 'arbitrum';

interface PaymentTransaction {
  id: string;
  type: PaymentType;
  fromAgentId: string;
  toAgentId?: string;
  amount: number;
  platformFee: number;
  providerShare: number;
  chain: ChainId;
  txHash: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  toolName?: string;
  timestamp: string;
  blockNumber?: number;
}

interface PaymentStats {
  totalVolume: number;
  totalFees: number;
  totalTransactions: number;
  volumeByChain: Record<ChainId, number>;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const TYPE_LABELS: Record<PaymentType, string> = {
  tool_call: 'Tool Call',
  agent_invoke: 'Agent Invoke',
  prompt_purchase: 'Prompt Purchase',
  arena_entry: 'Arena Entry',
  staking: 'Staking',
};

const TYPE_COLORS: Record<PaymentType, { bg: string; text: string; border: string; dot: string }> = {
  tool_call: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  agent_invoke: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400' },
  prompt_purchase: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  arena_entry: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-400' },
  staking: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
};

const CHAIN_META: Record<ChainId, { label: string; color: string; hex: string }> = {
  base: { label: 'Base', color: 'bg-[#0052FF]/10 text-[#5B8DEF] border-[#0052FF]/20', hex: '#0052FF' },
  bsc: { label: 'BSC', color: 'bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20', hex: '#F0B90B' },
  apechain: { label: 'ApeChain', color: 'bg-[#0046FF]/10 text-[#6B8AFF] border-[#0046FF]/20', hex: '#0046FF' },
  arbitrum: { label: 'Arbitrum', color: 'bg-[#28A0F0]/10 text-[#28A0F0] border-[#28A0F0]/20', hex: '#28A0F0' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function truncateHash(hash: string | null): string {
  if (!hash) return '--';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function truncateAgent(agentId: string): string {
  return agentId.replace('agent-', '').replace(/-/g, ' ');
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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

function PaymentsSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <Skeleton className="h-3 w-16 mb-3 bg-white/[0.06]" />
            <Skeleton className="h-8 w-24 mb-2 bg-white/[0.06]" />
            <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
          </div>
        ))}
      </div>
      {/* Chain volumes */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <Skeleton className="h-5 w-40 mb-6 bg-white/[0.06]" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 mb-4">
            <Skeleton className="h-6 w-16 rounded-full bg-white/[0.06]" />
            <Skeleton className="h-8 flex-1 rounded-lg bg-white/[0.04]" />
            <Skeleton className="h-4 w-24 bg-white/[0.06]" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-white/[0.04] last:border-0">
            <Skeleton className="h-4 w-16 bg-white/[0.06]" />
            <Skeleton className="h-4 w-20 bg-white/[0.06]" />
            <Skeleton className="h-4 w-24 bg-white/[0.06]" />
            <Skeleton className="h-4 w-16 bg-white/[0.06]" />
            <Skeleton className="h-4 w-20 bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function PaymentDashboardPage() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [chainFilter, setChainFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (chainFilter !== 'all') params.set('chain', chainFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/payments?${params.toString()}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch payment data:', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, chainFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chainVolumes = stats?.volumeByChain || { base: 0, bsc: 0, apechain: 0, arbitrum: 0 };
  const maxVolume = Math.max(...Object.values(chainVolumes), 1);
  const totalChainVolume = Object.values(chainVolumes).reduce((a, b) => a + b, 0);

  const kpiCards = [
    {
      label: 'Total Volume',
      value: formatNumber(stats?.totalVolume || 0),
      sub: 'BBAI tokens',
      gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      icon: (
        <svg className="w-4 h-4 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Platform Fees',
      value: formatNumber(stats?.totalFees || 0),
      sub: '15% of volume',
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
      label: 'Transactions',
      value: formatNumber(stats?.totalTransactions || 0),
      sub: 'confirmed on-chain',
      gradient: 'from-blue-500/15 via-blue-500/5 to-transparent',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      icon: (
        <svg className="w-4 h-4 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
    {
      label: 'Active Chains',
      value: Object.values(chainVolumes).filter((v) => v > 0).length,
      sub: 'Base, BSC, Ape, Arb',
      gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      icon: (
        <svg className="w-4 h-4 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.561a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.69 8.56" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  Payment Pipeline
                </h1>
              </div>
              <p className="text-zinc-500 mt-2 max-w-lg text-sm">
                On-chain BBAI token payments through the PaymentRouter contract with 85/15 split.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]">
                  Dashboard
                </Button>
              </Link>
              <Link href="/dashboard/revenue">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12]">
                  Revenue
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
          <PaymentsSkeleton />
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

            {/* Volume by Chain */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">Volume by Chain</h3>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Distribution of BBAI token flow across supported networks</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white tabular-nums">{formatNumber(totalChainVolume)}</div>
                    <div className="text-[10px] text-zinc-600">total BBAI</div>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {(Object.entries(chainVolumes) as [ChainId, number][]).map(
                  ([chain, volume]) => {
                    const pct = totalChainVolume > 0 ? ((volume / totalChainVolume) * 100).toFixed(1) : '0';
                    return (
                      <div key={chain} className="group/bar">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${CHAIN_META[chain].hex}15` }}>
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHAIN_META[chain].hex }} />
                            </div>
                            <span className="text-sm font-medium text-zinc-300">{CHAIN_META[chain].label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-zinc-600 tabular-nums">{pct}%</span>
                            <span className="text-sm font-semibold text-zinc-300 tabular-nums w-28 text-right">
                              {volume.toLocaleString()} <span className="text-zinc-600 text-[10px]">BBAI</span>
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.max((volume / maxVolume) * 100, 1)}%`,
                              background: `linear-gradient(90deg, ${CHAIN_META[chain].hex}60, ${CHAIN_META[chain].hex}30)`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
                <span className="text-sm text-zinc-500 font-medium">Filters</span>
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] h-9 border-white/[0.08] bg-white/[0.02] text-zinc-400 text-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tool_call">Tool Call</SelectItem>
                  <SelectItem value="agent_invoke">Agent Invoke</SelectItem>
                  <SelectItem value="prompt_purchase">Prompt Purchase</SelectItem>
                  <SelectItem value="arena_entry">Arena Entry</SelectItem>
                  <SelectItem value="staking">Staking</SelectItem>
                </SelectContent>
              </Select>

              <Select value={chainFilter} onValueChange={setChainFilter}>
                <SelectTrigger className="w-[160px] h-9 border-white/[0.08] bg-white/[0.02] text-zinc-400 text-sm">
                  <SelectValue placeholder="All Chains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chains</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="bsc">BSC</SelectItem>
                  <SelectItem value="apechain">ApeChain</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                </SelectContent>
              </Select>

              <div className="ml-auto flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-zinc-500">
                  {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden backdrop-blur-sm">
              <div className="px-6 py-4 border-b border-white/[0.04]">
                <h3 className="text-base font-semibold text-white">Transaction History</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Time</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Type</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">From</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">To</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium text-right">Amount</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium text-right">Fee</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Chain</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Status</TableHead>
                    <TableHead className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="text-center py-16">
                        <div className="flex flex-col items-center">
                          <div className="h-12 w-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3-3H9.75m1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          </div>
                          <p className="text-zinc-500 text-sm">No transactions found matching the current filters.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => {
                      const typeStyle = TYPE_COLORS[tx.type];
                      const statusStyle = STATUS_STYLES[tx.status] || STATUS_STYLES.pending;
                      return (
                        <TableRow key={tx.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <TableCell className="text-[11px] text-zinc-600 tabular-nums">
                            {timeAgo(tx.timestamp)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                              <span className={`w-1 h-1 rounded-full ${typeStyle.dot}`} />
                              {TYPE_LABELS[tx.type]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-medium capitalize text-zinc-300">
                            {truncateAgent(tx.fromAgentId)}
                          </TableCell>
                          <TableCell className="text-sm capitalize text-zinc-400">
                            {tx.toAgentId ? truncateAgent(tx.toAgentId) : (
                              <span className="text-zinc-600 text-xs">
                                {tx.toolName || 'platform'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-zinc-200">
                            {tx.amount} <span className="text-zinc-600 text-[10px]">BBAI</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-[11px] text-zinc-600">
                            {tx.platformFee > 0 ? `${tx.platformFee}` : '--'}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${CHAIN_META[tx.chain].color}`}>
                              {CHAIN_META[tx.chain].label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                              <span className={`w-1 h-1 rounded-full ${statusStyle.dot}`} />
                              {tx.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {tx.txHash ? (
                              <code className="text-[11px] font-mono text-zinc-600 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded-md cursor-pointer hover:text-zinc-300 hover:border-white/[0.1] transition-colors">
                                {truncateHash(tx.txHash)}
                              </code>
                            ) : (
                              <span className="text-zinc-700 text-xs">--</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
