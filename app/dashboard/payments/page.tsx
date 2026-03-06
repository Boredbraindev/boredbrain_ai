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

// ---------------------------------------------------------------------------
// Types (mirroring server-side)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<PaymentType, string> = {
  tool_call: 'Tool Call',
  agent_invoke: 'Agent Invoke',
  prompt_purchase: 'Prompt Purchase',
  arena_entry: 'Arena Entry',
  staking: 'Staking',
};

const TYPE_COLORS: Record<PaymentType, string> = {
  tool_call: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  agent_invoke: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  prompt_purchase: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  arena_entry: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  staking: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const CHAIN_META: Record<ChainId, { label: string; color: string }> = {
  base: { label: 'Base', color: 'bg-[#0052FF]/20 text-[#5B8DEF] border-[#0052FF]/30' },
  bsc: { label: 'BSC', color: 'bg-[#F0B90B]/20 text-[#F0B90B] border-[#F0B90B]/30' },
  apechain: { label: 'ApeChain', color: 'bg-[#0046FF]/20 text-[#6B8AFF] border-[#0046FF]/30' },
  arbitrum: { label: 'Arbitrum', color: 'bg-[#28A0F0]/20 text-[#28A0F0] border-[#28A0F0]/30' },
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PaymentsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="py-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

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

  // Volume bar chart data
  const chainVolumes = stats?.volumeByChain || { base: 0, bsc: 0, apechain: 0, arbitrum: 0 };
  const maxVolume = Math.max(...Object.values(chainVolumes), 1);

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Payment Pipeline
              </h1>
              <p className="text-muted-foreground mt-1 max-w-lg">
                On-chain BBAI token payments through the PaymentRouter contract with 85/15 split.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="sm">
                  Back to Search
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <PaymentsSkeleton />
        ) : (
          <div className="space-y-8">
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="py-4">
                  <div className="text-2xl font-bold tabular-nums text-emerald-400">
                    {stats?.totalVolume.toLocaleString() || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    Total Volume
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">BBAI tokens</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-2xl font-bold tabular-nums text-orange-400">
                    {stats?.totalFees.toLocaleString() || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    Platform Fees
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">15% of volume</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-2xl font-bold tabular-nums text-blue-400">
                    {stats?.totalTransactions || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    Transactions
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">confirmed on-chain</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-2xl font-bold tabular-nums text-purple-400">
                    {Object.values(chainVolumes).filter((v) => v > 0).length}
                  </div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    Active Chains
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Base, BSC, ApeChain, Arbitrum
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Volume by chain visualization */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Volume by Chain</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(Object.entries(chainVolumes) as [ChainId, number][]).map(
                    ([chain, volume]) => (
                      <div key={chain} className="flex items-center gap-3">
                        <div className="w-20 text-sm font-medium shrink-0">
                          <Badge
                            className={`text-[10px] ${CHAIN_META[chain].color}`}
                          >
                            {CHAIN_META[chain].label}
                          </Badge>
                        </div>
                        <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max((volume / maxVolume) * 100, 2)}%`,
                              backgroundColor:
                                chain === 'base'
                                  ? '#0052FF'
                                  : chain === 'bsc'
                                    ? '#F0B90B'
                                    : chain === 'apechain'
                                      ? '#0046FF'
                                      : '#28A0F0',
                            }}
                          />
                        </div>
                        <div className="w-24 text-right text-sm tabular-nums font-medium">
                          {volume.toLocaleString()} BBAI
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
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
                <SelectTrigger className="w-[160px]">
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

              <div className="text-sm text-muted-foreground ml-auto">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Transactions table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No transactions found matching the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {timeAgo(tx.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${TYPE_COLORS[tx.type]}`}>
                            {TYPE_LABELS[tx.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium capitalize">
                          {truncateAgent(tx.fromAgentId)}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {tx.toAgentId ? truncateAgent(tx.toAgentId) : (
                            <span className="text-muted-foreground text-xs">
                              {tx.toolName || 'platform'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {tx.amount} <span className="text-muted-foreground text-xs">BBAI</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {tx.platformFee > 0 ? `${tx.platformFee}` : '--'}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${CHAIN_META[tx.chain].color}`}>
                            {CHAIN_META[tx.chain].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${STATUS_COLORS[tx.status]}`}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tx.txHash ? (
                            <code className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:text-foreground transition-colors">
                              {truncateHash(tx.txHash)}
                            </code>
                          ) : (
                            <span className="text-muted-foreground text-xs">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
