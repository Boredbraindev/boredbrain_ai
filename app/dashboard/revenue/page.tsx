'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

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

function formatBBAI(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

const TYPE_LABELS: Record<string, string> = {
  tool_call: 'Tool Call',
  agent_invoke: 'Agent Invoke',
  prompt_purchase: 'Prompt Sale',
  arena_entry: 'Arena Fee',
  staking: 'Staking',
};

export default function RevenueDashboardPage() {
  const [data, setData] = useState<RevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/revenue')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load revenue data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Revenue Dashboard</h1>
              <p className="text-muted-foreground mt-1">Real-time platform revenue tracking across all streams</p>
            </div>
            <div className="flex gap-2">
              <Link href="/arena">
                <Button variant="outline" size="sm">Arena</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="sm">Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Revenue</div>
              <div className="text-3xl font-bold text-green-500 mt-1">{formatBBAI(data.totalRevenue)} BBAI</div>
              <div className="text-xs text-green-400 mt-1">Platform fees collected</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Volume</div>
              <div className="text-3xl font-bold text-blue-500 mt-1">{formatBBAI(data.totalVolume)} BBAI</div>
              <div className="text-xs text-blue-400 mt-1">All transactions</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Daily Revenue</div>
              <div className="text-3xl font-bold text-purple-500 mt-1">{formatBBAI(data.dailyRevenue)} BBAI</div>
              <div className="text-xs text-purple-400 mt-1">Last 24 hours</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Transactions</div>
              <div className="text-3xl font-bold text-amber-500 mt-1">{data.totalTransactions.toLocaleString()}</div>
              <div className="text-xs text-amber-400 mt-1">All time</div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart (Simple bar visualization) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-48">
              {data.chartData.map((day, i) => {
                const maxRevenue = Math.max(...data.chartData.map(d => d.revenue));
                const height = (day.revenue / maxRevenue) * 100;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-8 bg-popover border rounded px-2 py-1 text-xs hidden group-hover:block z-10 whitespace-nowrap">
                      {day.date}: {day.revenue} BBAI
                    </div>
                    <div
                      className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors cursor-pointer min-h-[2px]"
                      style={{ height: `${height}%` }}
                    />
                    {i % 5 === 0 && (
                      <span className="text-[9px] text-muted-foreground">
                        {day.date.slice(5)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Streams */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Streams</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.streams.map((stream) => (
                <div key={stream.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stream.color }} />
                    <div>
                      <div className="font-medium text-sm">{stream.name}</div>
                      <div className="text-xs text-muted-foreground">{stream.transactions} txs</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{formatBBAI(stream.revenue)} BBAI</div>
                    <div className="text-xs text-green-400">+{stream.growth}%</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 hover:border-border/60 transition-colors text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {TYPE_LABELS[tx.type] || tx.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {truncateHash(tx.txHash)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{tx.amount} BBAI</div>
                      <div className="text-[10px] text-green-400">+{tx.fee} fee</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Daily</div>
              <div className="text-2xl font-bold mt-1">{formatBBAI(data.dailyRevenue)} BBAI</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Weekly</div>
              <div className="text-2xl font-bold mt-1">{formatBBAI(data.weeklyRevenue)} BBAI</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Monthly</div>
              <div className="text-2xl font-bold mt-1">{formatBBAI(data.monthlyRevenue)} BBAI</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
