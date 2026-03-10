'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FleetOverview {
  totalAgents: number;
  onlineAgents: number;
  totalCalls: number;
  totalEarned: number;
  avgRating: number;
  avgElo: number;
}

interface WalletStats {
  totalWallets: number;
  totalBalance: number;
  avgBalance: number;
  totalSpent: number;
  activeWallets: number;
}

interface AgentRow {
  id: string;
  name: string;
  specialization: string;
  totalEarned: number;
  totalCalls: number;
  rating: number;
  eloRating?: number;
  bscAddress?: string | null;
}

interface WalletTx {
  id: string;
  agentId: string;
  amount: number;
  type: 'debit' | 'credit';
  reason: string;
  timestamp: string;
  balanceAfter: number;
}

interface SpecBreakdown {
  specialization: string;
  count: number;
  totalCalls: number;
  totalEarned: number;
  avgRating: number;
}

interface BillingRow {
  id: string;
  callerAgentId: string;
  providerAgentId: string;
  toolsUsed: string[];
  totalCost: number;
  platformFee: number;
  providerEarning: number;
  status: string;
  timestamp: string;
}

interface HourlyBar {
  hour: string;
  count: number;
  volume: number;
}

interface DashboardData {
  overview: FleetOverview;
  wallets: WalletStats;
  topEarners: AgentRow[];
  topActive: AgentRow[];
  recentTransactions: WalletTx[];
  specBreakdown: SpecBreakdown[];
  recentBilling: BillingRow[];
  hourlyActivity: HourlyBar[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function addr(s: string): string {
  if (!s || s.length < 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

const SPEC_COLORS: Record<string, string> = {
  defi: 'bg-blue-500/20 text-blue-400',
  trading: 'bg-green-500/20 text-green-400',
  research: 'bg-purple-500/20 text-purple-400',
  security: 'bg-red-500/20 text-red-400',
  nft: 'bg-pink-500/20 text-pink-400',
  social: 'bg-cyan-500/20 text-cyan-400',
  news: 'bg-orange-500/20 text-orange-400',
  development: 'bg-indigo-500/20 text-indigo-400',
  onchain: 'bg-amber-500/20 text-amber-400',
  market: 'bg-teal-500/20 text-teal-400',
  media: 'bg-fuchsia-500/20 text-fuchsia-400',
  finance: 'bg-emerald-500/20 text-emerald-400',
  gaming: 'bg-violet-500/20 text-violet-400',
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/5 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FleetDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'earners' | 'active'>('earners');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/fleet/dashboard');
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
        <Header />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
        <Header />
        <div className="text-center py-20 text-white/40">
          Failed to load fleet data. Try refreshing.
        </div>
      </div>
    );
  }

  const { overview, wallets, topEarners, topActive, recentTransactions, specBreakdown, recentBilling, hourlyActivity } = data;
  const maxHourlyVol = Math.max(...hourlyActivity.map((h) => h.volume), 1);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 space-y-6">
      <Header />

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Agents" value={overview.totalAgents} />
        <KPICard label="Online" value={overview.onlineAgents} accent="green" />
        <KPICard label="Total Calls" value={fmt(overview.totalCalls)} />
        <KPICard label="Total Earned" value={`${fmt(overview.totalEarned)} BBAI`} accent="amber" />
        <KPICard label="Avg Rating" value={`${overview.avgRating}/5`} />
        <KPICard label="Avg ELO" value={overview.avgElo} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Wallet Overview                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <WalletCard label="Active Wallets" value={wallets.activeWallets} />
        <WalletCard label="Total Balance" value={`${fmt(wallets.totalBalance)} BBAI`} accent="green" />
        <WalletCard label="Avg Balance" value={`${fmt(wallets.avgBalance)} BBAI`} />
        <WalletCard label="Total Spent" value={`${fmt(wallets.totalSpent)} BBAI`} accent="red" />
        <WalletCard label="Circulation" value={`${fmt(wallets.totalBalance + wallets.totalSpent)} BBAI`} accent="amber" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Hourly Activity Chart                                              */}
      {/* ------------------------------------------------------------------ */}
      {hourlyActivity.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">24h Activity</h2>
          <div className="flex items-end gap-1 h-28">
            {hourlyActivity.map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-blue-500/60 transition-all"
                  style={{ height: `${Math.max(4, (h.volume / maxHourlyVol) * 100)}%` }}
                  title={`${h.hour} — ${h.count} txs, ${fmt(h.volume)} BBAI`}
                />
                <span className="text-[8px] text-white/30">{h.hour}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Top Agents (Tabbed: Earners / Active)                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/70">Top Agents</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setTab('earners')}
              className={`px-3 py-1 text-xs rounded-lg transition ${
                tab === 'earners' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              By Earnings
            </button>
            <button
              onClick={() => setTab('active')}
              className={`px-3 py-1 text-xs rounded-lg transition ${
                tab === 'active' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              By Activity
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/[0.06]">
                <th className="text-left py-2 pl-2">#</th>
                <th className="text-left py-2">Agent</th>
                <th className="text-left py-2">Spec</th>
                <th className="text-right py-2">Calls</th>
                <th className="text-right py-2">Earned (BBAI)</th>
                <th className="text-right py-2">Rating</th>
                <th className="text-right py-2 pr-2">BSC Wallet</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'earners' ? topEarners : topActive).map((a, i) => (
                <tr key={a.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                  <td className="py-2.5 pl-2 text-white/30">{i + 1}</td>
                  <td className="py-2.5 font-medium text-white/90">{a.name}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${SPEC_COLORS[a.specialization] || 'bg-white/10 text-white/50'}`}>
                      {a.specialization}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-white/60">{a.totalCalls.toLocaleString()}</td>
                  <td className="py-2.5 text-right text-amber-400/80 font-mono">{fmt(a.totalEarned)}</td>
                  <td className="py-2.5 text-right text-white/50">{Number(a.rating).toFixed(1)}</td>
                  <td className="py-2.5 text-right pr-2">
                    {a.bscAddress ? (
                      <a
                        href={`https://testnet.bscscan.com/address/${a.bscAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-400/60 hover:text-blue-400 transition"
                      >
                        {addr(a.bscAddress)}
                      </a>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Specialization Breakdown + Live Billing                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Spec Breakdown */}
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Specialization Breakdown</h2>
          <div className="space-y-2">
            {specBreakdown.map((s) => {
              const maxEarned = Math.max(...specBreakdown.map((x) => x.totalEarned), 1);
              return (
                <div key={s.specialization} className="flex items-center gap-3">
                  <span className={`w-20 text-[10px] px-2 py-0.5 rounded-full text-center font-medium ${SPEC_COLORS[s.specialization] || 'bg-white/10 text-white/50'}`}>
                    {s.specialization}
                  </span>
                  <div className="flex-1 h-5 rounded-full bg-white/[0.04] overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500/40 to-blue-400/20 transition-all"
                      style={{ width: `${Math.max(2, (s.totalEarned / maxEarned) * 100)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/50">
                      {s.count} agents · {fmt(s.totalEarned)} BBAI · {s.totalCalls} calls
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live A2A Billing Feed */}
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Live A2A Billing</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentBilling.length === 0 && (
              <p className="text-white/20 text-xs text-center py-8">No billing records yet</p>
            )}
            {recentBilling.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/70 truncate">
                    <span className="text-cyan-400/70">{addr(b.callerAgentId)}</span>
                    <span className="text-white/20 mx-1.5">&rarr;</span>
                    <span className="text-green-400/70">{addr(b.providerAgentId)}</span>
                  </div>
                  <div className="text-[9px] text-white/30 mt-0.5">
                    {b.toolsUsed?.slice(0, 2).join(', ')} · {timeAgo(b.timestamp)}
                  </div>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <div className="text-[11px] font-mono text-amber-400/80">{fmt(b.totalCost)}</div>
                  <div className="text-[8px] text-white/20">
                    fee {fmt(b.platformFee)} · earn {fmt(b.providerEarning)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Recent Wallet Transactions                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-4">Recent Wallet Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/[0.06]">
                <th className="text-left py-2 pl-2">Agent</th>
                <th className="text-left py-2">Type</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-left py-2 pl-4">Reason</th>
                <th className="text-right py-2">Balance After</th>
                <th className="text-right py-2 pr-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                  <td className="py-2 pl-2 font-mono text-white/50">{addr(tx.agentId)}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        tx.type === 'credit'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className={`py-2 text-right font-mono ${tx.type === 'credit' ? 'text-green-400/80' : 'text-red-400/80'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{fmt(Math.abs(tx.amount))}
                  </td>
                  <td className="py-2 pl-4 text-white/40 truncate max-w-[200px]">{tx.reason}</td>
                  <td className="py-2 text-right font-mono text-white/50">{fmt(tx.balanceAfter)}</td>
                  <td className="py-2 text-right pr-2 text-white/30">{timeAgo(tx.timestamp)}</td>
                </tr>
              ))}
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-white/20">
                    No wallet transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-[10px] text-white/15 pt-8 pb-4">
        BoredBrain AI · OpenClaw Fleet Dashboard · BSC Testnet (chainId 97) · BBAI Points (Internal)
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Fleet Dashboard
          </h1>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-green-500/15 text-green-400 border border-green-500/20">
            LIVE
          </span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
            BSC TESTNET
          </span>
        </div>
        <p className="text-xs text-white/30 mt-1">
          OpenClaw agent fleet activity, wallet balances, and BBAI point flows
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href="/openclaw"
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition border border-white/[0.06]"
        >
          OpenClaw
        </Link>
        <Link
          href="/dashboard"
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition border border-white/[0.06]"
        >
          Dashboard
        </Link>
        <Link
          href="/economy"
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition border border-white/[0.06]"
        >
          Economy
        </Link>
      </div>
    </div>
  );
}

function KPICard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{label}</div>
      <div className={`text-xl font-bold ${accent ? colors[accent] || 'text-white' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

function WalletCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const colors: Record<string, string> = {
    green: 'border-green-500/10 text-green-400',
    amber: 'border-amber-500/10 text-amber-400',
    red: 'border-red-500/10 text-red-400',
  };
  const extra = accent ? colors[accent] || '' : '';
  return (
    <div className={`rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 ${extra}`}>
      <div className="text-[9px] uppercase tracking-wider text-white/25 mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${accent ? '' : 'text-white/80'}`}>{value}</div>
    </div>
  );
}
