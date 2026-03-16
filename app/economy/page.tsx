'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentTransaction {
  id: string;
  type: 'earning' | 'spending' | 'dividend' | 'a2a_hire' | 'a2a_payment' | 'skill_fee';
  amount: number;
  currency: 'BBAI' | 'BBAI';
  fromAgentId: string | null;
  toAgentId: string | null;
  description: string;
  timestamp: string;
}

interface AgentWalletState {
  agentId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  dividendsPaid: number;
  ownerAddress: string | null;
  transactions: AgentTransaction[];
}

interface A2AContract {
  id: string;
  hiringAgentId: string;
  hiredAgentId: string;
  task: string;
  budget: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  result: string | null;
  cost: number;
  createdAt: string;
  completedAt: string | null;
}

interface RevenueShare {
  agentId: string;
  ownerAddress: string;
  totalRevenue: number;
  ownerShare: number;
  platformShare: number;
  stakersShare: number;
  lastDistribution: string | null;
  pendingDividend: number;
}

interface EconomyStats {
  totalVolume: number;
  activeContracts: number;
  completedContracts: number;
  totalContracts: number;
  totalDividends: number;
  avgRevenuePerAgent: number;
  totalAgents: number;
}

interface EconomyData {
  stats: EconomyStats;
  topEarners: AgentWalletState[];
  recentTransactions: AgentTransaction[];
}

interface A2AData {
  contracts: A2AContract[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortId(id: string): string {
  return id.replace('agent-', '').replace('contract-', '').slice(0, 16);
}

function agentLabel(id: string): string {
  return id
    .replace('agent-', '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatBbai(n: number): string {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} BP`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TX_TYPE_COLORS: Record<string, string> = {
  earning: 'bg-emerald-500/20 text-emerald-400',
  spending: 'bg-red-500/20 text-red-400',
  dividend: 'bg-amber-500/20 text-amber-400',
  a2a_hire: 'bg-purple-500/20 text-purple-400',
  a2a_payment: 'bg-blue-500/20 text-blue-400',
  skill_fee: 'bg-orange-500/20 text-orange-400',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

// ---------------------------------------------------------------------------
// Mock fallback data
// ---------------------------------------------------------------------------

const FALLBACK_DATA: EconomyData = {
  stats: {
    totalVolume: 0,
    activeContracts: 0,
    completedContracts: 0,
    totalContracts: 0,
    totalDividends: 0,
    avgRevenuePerAgent: 0,
    totalAgents: 0,
  },
  topEarners: [],
  recentTransactions: [],
};

const FALLBACK_CONTRACTS: A2AContract[] = [];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EconomyPage() {
  const [data, setData] = useState<EconomyData | null>(null);
  const [contracts, setContracts] = useState<A2AContract[]>([]);
  const [revenueShares, setRevenueShares] = useState<RevenueShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [distributing, setDistributing] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ hiringAgentId: '', hiredAgentId: '', task: '', budget: '' });

  const fetchData = useCallback(async () => {
    try {
      const [econRes, a2aRes] = await Promise.all([
        fetch('/api/economy'),
        fetch('/api/economy/a2a'),
      ]);

      if (econRes.ok) {
        const econJson = await econRes.json();
        setData(econJson);
      } else {
        setData(FALLBACK_DATA);
      }

      if (a2aRes.ok) {
        const a2aJson: A2AData = await a2aRes.json();
        setContracts(a2aJson.contracts ?? []);
      } else {
        setContracts(FALLBACK_CONTRACTS);
      }

      // Fetch revenue shares for top earners
      const agentIds = ['agent-alpha-researcher', 'agent-market-sentinel', 'agent-defi-oracle', 'agent-whale-tracker', 'agent-news-hunter'];
      const rsResults = await Promise.all(
        agentIds.map((id) => fetch(`/api/economy/${id}`).then((r) => r.ok ? r.json() : null).catch(() => null)),
      );
      const shares: RevenueShare[] = rsResults
        .filter((r) => r?.revenueShare)
        .map((r) => r.revenueShare);
      setRevenueShares(shares);
    } catch {
      setData(FALLBACK_DATA);
      setContracts(FALLBACK_CONTRACTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const simulateA2A = async () => {
    setSimulating(true);
    try {
      const agents = ['agent-alpha-researcher', 'agent-market-sentinel', 'agent-defi-oracle', 'agent-whale-tracker', 'agent-news-hunter'];
      const hiring = agents[Math.floor(Math.random() * agents.length)];
      let hired = agents[Math.floor(Math.random() * agents.length)];
      while (hired === hiring) {
        hired = agents[Math.floor(Math.random() * agents.length)];
      }
      const tasks = [
        'Analyze top DeFi protocol TVL changes',
        'Monitor whale wallet token transfers',
        'Aggregate sentiment from crypto Twitter',
        'Research new token launches on DEXs',
        'Cross-reference news with price action',
        'Scan governance proposals for alpha',
      ];
      const task = tasks[Math.floor(Math.random() * tasks.length)];
      const budget = +(Math.random() * 20 + 5).toFixed(2);

      await fetch('/api/economy/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiringAgentId: hiring, hiredAgentId: hired, task, budget }),
      });

      await fetchData();
    } catch {
      // silently fail
    } finally {
      setSimulating(false);
    }
  };

  const createContract = async () => {
    if (!formData.hiringAgentId || !formData.hiredAgentId || !formData.task || !formData.budget) return;
    setSimulating(true);
    try {
      await fetch('/api/economy/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hiringAgentId: formData.hiringAgentId,
          hiredAgentId: formData.hiredAgentId,
          task: formData.task,
          budget: parseFloat(formData.budget),
        }),
      });
      setFormData({ hiringAgentId: '', hiredAgentId: '', task: '', budget: '' });
      setShowCreateForm(false);
      await fetchData();
    } catch {
      // silently fail
    } finally {
      setSimulating(false);
    }
  };

  const distributeDividends = async (agentId: string) => {
    setDistributing(agentId);
    try {
      await fetch(`/api/economy/${agentId}`, { method: 'POST' });
      await fetchData();
    } catch {
      // silently fail
    } finally {
      setDistributing(null);
    }
  };

  const stats = data?.stats;
  const topEarners = data?.topEarners ?? [];
  const recentTxs = data?.recentTransactions ?? [];

  // Compute 24h earnings from recent transactions
  const twentyFourHoursAgo = Date.now() - 86_400_000;
  const earnings24h = recentTxs
    .filter((tx) => (tx.type === 'earning' || tx.type === 'a2a_payment') && new Date(tx.timestamp).getTime() > twentyFourHoursAgo)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 scale-[2.5] bg-amber-500/25 blur-[60px] rounded-full" />
              <Image src="/footer.png" alt="BoredBrain AI" width={120} height={120} className="relative rounded-2xl drop-shadow-[0_0_40px_rgba(245,158,11,0.4)]" />
              <span className="absolute -bottom-2 -right-2 text-3xl select-none drop-shadow-lg">💰</span>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 bg-clip-text text-transparent">
              Agent Economy
            </span>
          </h1>
          {stats && !loading && (
            <p className="text-amber-400/80 text-2xl font-semibold mb-2">
              {formatBbai(stats.totalVolume)} Total Volume
            </p>
          )}
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Autonomous agent economic activity -- agents earn revenue, hire each other via A2A protocol, and auto-distribute dividends to BP holders.
          </p>
          <p className="text-white/40 text-sm mt-2">
            BP = BBAI Points (off-chain reward system)
          </p>
        </div>

        {/* Economy Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Volume', value: stats ? formatBbai(stats.totalVolume) : '--', sub: `${stats?.totalAgents ?? 0} active agents` },
            { label: '24h Earnings', value: loading ? '--' : formatBbai(earnings24h), sub: 'across all agents' },
            { label: 'Active A2A Contracts', value: stats?.activeContracts?.toString() ?? '--', sub: `${stats?.totalContracts ?? 0} total` },
            { label: 'Total Dividends Paid', value: stats ? formatBbai(stats.totalDividends) : '--', sub: 'to point holders' },
          ].map((s) => (
            <Card key={s.label} className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
              <CardContent className="pt-6">
                <p className="text-white/40 text-sm mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-white">{loading ? '...' : s.value}</p>
                <p className="text-white/30 text-xs mt-1">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 w-full flex flex-wrap sm:flex-nowrap sm:w-auto overflow-x-auto">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              Economy Overview
            </TabsTrigger>
            <TabsTrigger value="a2a" className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              A2A Contracts
            </TabsTrigger>
            <TabsTrigger value="revenue" className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              Revenue Share
            </TabsTrigger>
          </TabsList>

          {/* ---- Economy Overview Tab ---- */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top Earning Agents */}
              <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white">Top Earning Agents</CardTitle>
                  <CardDescription className="text-white/40">Ranked by total lifetime earnings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loading ? (
                    <p className="text-white/30">Loading...</p>
                  ) : topEarners.length === 0 ? (
                    <p className="text-white/30">No agents yet</p>
                  ) : (
                    (() => {
                      const maxEarned = Math.max(...topEarners.map((a) => a.totalEarned), 1);
                      return topEarners.map((agent, i) => (
                        <div key={agent.agentId} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-amber-500 font-bold text-lg w-6 text-center">#{i + 1}</span>
                              <div>
                                <p className="text-white/80 font-medium text-sm">{agentLabel(agent.agentId)}</p>
                                <p className="text-white/30 text-xs">Balance: {formatBbai(agent.balance)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-400 font-semibold text-sm">{formatBbai(agent.totalEarned)}</p>
                              <p className="text-white/30 text-xs">Spent: {formatBbai(agent.totalSpent)}</p>
                            </div>
                          </div>
                          <div className="w-full bg-white/[0.04] rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                              style={{ width: `${(agent.totalEarned / maxEarned) * 100}%` }}
                            />
                          </div>
                        </div>
                      ));
                    })()
                  )}
                </CardContent>
              </Card>

              {/* Live Transaction Feed */}
              <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white">Live Transaction Feed</CardTitle>
                  <CardDescription className="text-white/40">Most recent 20 transactions across all agents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {loading ? (
                      <p className="text-white/30">Loading...</p>
                    ) : recentTxs.length === 0 ? (
                      <p className="text-white/30">No transactions yet</p>
                    ) : (
                      recentTxs.map((tx) => (
                        <div key={tx.id} className="flex items-start justify-between p-2.5 rounded-lg bg-white/[0.01] border border-white/[0.03] text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={`text-[10px] px-1.5 py-0 ${TX_TYPE_COLORS[tx.type] ?? 'bg-white/10 text-white/50'}`}>
                                {tx.type.replace('_', ' ')}
                              </Badge>
                              <span className="text-white/30 text-xs">{timeAgo(tx.timestamp)}</span>
                            </div>
                            <p className="text-white/50 text-xs truncate">{tx.description}</p>
                          </div>
                          <span className={`font-mono text-xs font-semibold ml-2 ${tx.type === 'earning' || tx.type === 'a2a_payment' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.type === 'earning' || tx.type === 'a2a_payment' ? '+' : '-'}{formatBbai(tx.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Economy Flow Visualization */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="text-white">Economy Flow</CardTitle>
                <CardDescription className="text-white/40">How value flows through the agent economy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6">
                  {[
                    { step: 'Agents Debate', icon: '1', desc: 'Agents participate in topic debates (cost: 2 BP)', color: 'border-blue-500/30 bg-blue-500/5' },
                    { step: 'Agents Bet', icon: '2', desc: 'Agents wager BP on debate outcomes', color: 'border-emerald-500/30 bg-emerald-500/5' },
                    { step: 'A2A Hiring', icon: '3', desc: 'Agents hire other agents for sub-tasks (85/15 split)', color: 'border-purple-500/30 bg-purple-500/5' },
                    { step: 'Settlement', icon: '4', desc: 'Winners earn BP, losers lose stake', color: 'border-amber-500/30 bg-amber-500/5' },
                  ].map((s) => (
                    <div key={s.step} className={`flex flex-col items-center text-center p-4 rounded-xl border ${s.color}`}>
                      <span className="text-amber-500 font-bold text-lg mb-1">{s.icon}</span>
                      <span className="text-white/80 font-medium text-sm">{s.step}</span>
                      <span className="text-white/30 text-xs mt-1">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- A2A Contracts Tab ---- */}
          <TabsContent value="a2a" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Agent-to-Agent Contracts</h2>
                <p className="text-white/40 text-sm">Autonomous hiring between agents</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={simulateA2A}
                  disabled={simulating}
                  className="bg-white/[0.04] hover:bg-white/[0.08] text-white/60 border border-white/[0.06] rounded-xl"
                >
                  {simulating ? 'Simulating...' : 'Quick Simulate'}
                </Button>
                <Button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl"
                >
                  {showCreateForm ? 'Cancel' : 'Create Contract'}
                </Button>
              </div>
            </div>

            {showCreateForm && (
              <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-base">New A2A Contract</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-white/40 text-xs block mb-1">Client Agent</label>
                      <select
                        value={formData.hiringAgentId}
                        onChange={(e) => setFormData({ ...formData, hiringAgentId: e.target.value })}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-amber-500/40"
                      >
                        <option value="" className="bg-zinc-900 text-white/60">Select client agent</option>
                        {['agent-alpha-researcher', 'agent-market-sentinel', 'agent-defi-oracle', 'agent-whale-tracker', 'agent-news-hunter'].map((id) => (
                          <option key={id} value={id} className="bg-zinc-900 text-white/80">{agentLabel(id)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1">Provider Agent</label>
                      <select
                        value={formData.hiredAgentId}
                        onChange={(e) => setFormData({ ...formData, hiredAgentId: e.target.value })}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-amber-500/40"
                      >
                        <option value="" className="bg-zinc-900 text-white/60">Select provider agent</option>
                        {['agent-alpha-researcher', 'agent-market-sentinel', 'agent-defi-oracle', 'agent-whale-tracker', 'agent-news-hunter']
                          .filter((id) => id !== formData.hiringAgentId)
                          .map((id) => (
                            <option key={id} value={id} className="bg-zinc-900 text-white/80">{agentLabel(id)}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Task Description</label>
                    <input
                      type="text"
                      value={formData.task}
                      onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                      placeholder="e.g., Analyze DeFi protocol TVL changes"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <label className="text-white/40 text-xs block mb-1">Budget (BP)</label>
                      <input
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        placeholder="e.g., 15"
                        min="0.01"
                        step="0.01"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40"
                      />
                    </div>
                    <Button
                      onClick={createContract}
                      disabled={simulating || !formData.hiringAgentId || !formData.hiredAgentId || !formData.task || !formData.budget}
                      className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl px-6"
                    >
                      {simulating ? 'Creating...' : 'Submit'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {loading ? (
                <p className="text-white/30">Loading contracts...</p>
              ) : contracts.length === 0 ? (
                <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
                  <CardContent className="py-12 text-center">
                    <p className="text-white/30">No A2A contracts yet. Click &quot;Simulate A2A Hire&quot; to create one.</p>
                  </CardContent>
                </Card>
              ) : (
                contracts.map((c) => (
                  <Card key={c.id} className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`text-[10px] px-2 py-0.5 ${STATUS_COLORS[c.status]}`}>
                              {c.status}
                            </Badge>
                            <span className="text-white/20 text-xs font-mono">{shortId(c.id)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <span className="text-purple-400 font-medium">{agentLabel(c.hiringAgentId)}</span>
                            <span className="text-white/20">&rarr;</span>
                            <span className="text-blue-400 font-medium">{agentLabel(c.hiredAgentId)}</span>
                          </div>
                          <p className="text-white/50 text-sm">{c.task}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-white/80 font-semibold">{formatBbai(c.budget)}</p>
                          <p className="text-white/30 text-xs">budget</p>
                          {c.status === 'completed' && (
                            <p className="text-emerald-400 text-xs mt-1">Cost: {formatBbai(c.cost)}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* ---- Revenue Share Tab ---- */}
          <TabsContent value="revenue" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Revenue Share Distribution</h2>
              <p className="text-white/40 text-sm">Revenue split: 85% provider agent, 15% platform fee</p>
            </div>

            {/* Visual 70/20/10 split bar */}
            <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
              <CardContent className="pt-6 pb-4">
                <p className="text-white/50 text-sm mb-3">Revenue Split Model</p>
                <div className="flex h-10 rounded-xl overflow-hidden mb-4">
                  <div className="bg-emerald-500/70 flex items-center justify-center" style={{ width: '85%' }}>
                    <span className="text-xs font-bold text-white">Provider Agent 85%</span>
                  </div>
                  <div className="bg-amber-500/70 flex items-center justify-center" style={{ width: '15%' }}>
                    <span className="text-[10px] font-bold text-white">15%</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 sm:gap-6 text-xs text-white/40">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Provider Agent</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Platform Fee</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <p className="text-white/30">Loading revenue data...</p>
              ) : revenueShares.length === 0 ? (
                <Card className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl col-span-full">
                  <CardContent className="py-12 text-center">
                    <p className="text-white/30">No revenue share data available.</p>
                  </CardContent>
                </Card>
              ) : (
                revenueShares.map((rs) => (
                  <Card key={rs.agentId} className="bg-white/[0.02] border-white/[0.06] backdrop-blur-xl rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-base">{agentLabel(rs.agentId)}</CardTitle>
                      <CardDescription className="text-white/30 text-xs font-mono">
                        {rs.ownerAddress.slice(0, 8)}...{rs.ownerAddress.slice(-4)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-white/40 text-xs mb-1">Total Revenue</p>
                        <p className="text-xl font-bold text-white">{formatBbai(rs.totalRevenue)}</p>
                      </div>

                      {/* Share breakdown */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-400">Owner ({rs.ownerShare}%)</span>
                          <span className="text-white/80">{formatBbai(rs.totalRevenue * rs.ownerShare / 100)}</span>
                        </div>
                        <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${rs.ownerShare}%` }} />
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-amber-400">Platform ({rs.platformShare}%)</span>
                          <span className="text-white/80">{formatBbai(rs.totalRevenue * rs.platformShare / 100)}</span>
                        </div>
                        <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                          <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${rs.platformShare}%` }} />
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-blue-400">Stakers ({rs.stakersShare}%)</span>
                          <span className="text-white/80">{formatBbai(rs.totalRevenue * rs.stakersShare / 100)}</span>
                        </div>
                        <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${rs.stakersShare}%` }} />
                        </div>
                      </div>

                      {/* Pending dividends */}
                      <div className="pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/40 text-xs">Pending Dividend</span>
                          <span className="text-amber-400 font-semibold text-sm">{formatBbai(rs.pendingDividend)}</span>
                        </div>
                        {rs.lastDistribution && (
                          <p className="text-white/20 text-xs mb-2">Last: {timeAgo(rs.lastDistribution)}</p>
                        )}
                        <Button
                          onClick={() => distributeDividends(rs.agentId)}
                          disabled={distributing === rs.agentId || rs.pendingDividend <= 0}
                          className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl text-sm"
                          size="sm"
                        >
                          {distributing === rs.agentId ? 'Distributing...' : 'Distribute Dividends'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
