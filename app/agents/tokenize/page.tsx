'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentTokenData {
  id: string;
  agentId: string;
  tokenSymbol: string;
  tokenName: string;
  totalSupply: number;
  circulatingSupply: number;
  price: number;
  marketCap: number;
  totalVolume: number;
  holders: number;
  buybackPool: number;
  chain: string;
  status: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function TokenCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-7 w-28 mb-1" />
      <Skeleton className="h-3 w-20 mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BondingCurveVisual() {
  const points = Array.from({ length: 20 }, (_, i) => {
    const x = i / 19;
    const y = 0.01 * (1 + Math.sqrt(x) * 10);
    return { x, y };
  });
  const maxY = Math.max(...points.map((p) => p.y));

  return (
    <div className="relative h-16 w-full">
      <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0" y1={15 * i + 5}
            x2="200" y2={15 * i + 5}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="0.5"
          />
        ))}
        {/* Curve fill */}
        <path
          d={`M 0 55 ${points.map((p) => `L ${p.x * 200} ${55 - (p.y / maxY) * 50}`).join(' ')} L 200 55 Z`}
          fill="url(#curveGradient)"
        />
        {/* Curve line */}
        <path
          d={`M ${points.map((p) => `${p.x * 200} ${55 - (p.y / maxY) * 50}`).join(' L ')}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function TokenCard({
  token,
  onTrade,
}: {
  token: AgentTokenData;
  onTrade: (token: AgentTokenData, type: 'buy' | 'sell') => void;
}) {
  const supplyRatio = token.totalSupply > 0 ? (token.circulatingSupply / token.totalSupply) * 100 : 0;

  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/[0.03] hover:scale-[1.01]">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {/* Token avatar */}
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-amber-500">
                {token.tokenSymbol.slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-amber-500">${token.tokenSymbol}</span>
                <span className="text-[10px] text-muted-foreground font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">
                  {token.chain}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">{token.tokenName}</span>
            </div>
          </div>
          <span className={`text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded border ${
            token.status === 'active'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-muted-foreground bg-white/[0.04] border-white/[0.06]'
          }`}>
            {token.status}
          </span>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="text-2xl font-bold tracking-tight">
            {token.price.toFixed(4)}
            <span className="text-xs text-muted-foreground ml-1.5">BBAI</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
            MCap: {formatNumber(token.marketCap)} BBAI
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Supply</p>
            <p className="text-xs font-semibold">
              {formatCompact(token.circulatingSupply)}
              <span className="text-muted-foreground"> / {formatCompact(token.totalSupply)}</span>
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Holders</p>
            <p className="text-xs font-semibold">{token.holders.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Volume</p>
            <p className="text-xs font-semibold">{formatNumber(token.totalVolume)} <span className="text-muted-foreground">BBAI</span></p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Buyback</p>
            <p className="text-xs font-semibold text-emerald-400">{formatNumber(token.buybackPool)} <span className="text-muted-foreground">BBAI</span></p>
          </div>
        </div>

        {/* Supply progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Circulating Supply</span>
            <span className="text-[10px] text-muted-foreground">{supplyRatio.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-500/20 transition-all duration-500"
              style={{ width: `${Math.min(supplyRatio, 100)}%` }}
            />
          </div>
        </div>

        {/* Trade Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onTrade(token, 'buy')}
            className="flex-1 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200"
          >
            Buy
          </button>
          <button
            onClick={() => onTrade(token, 'sell')}
            className="flex-1 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-200"
          >
            Sell
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentTokenizePage() {
  const [tokens, setTokens] = useState<AgentTokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [agentId, setAgentId] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenName, setTokenName] = useState('');

  // Trade modal
  const [tradeToken, setTradeToken] = useState<AgentTokenData | null>(null);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [trading, setTrading] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  async function fetchTokens() {
    try {
      const res = await fetch('/api/agents/tokenize');
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleTokenize(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/agents/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, tokenSymbol: tokenSymbol.toUpperCase(), tokenName }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Successfully tokenized! Token: $${data.token?.tokenSymbol}` });
        setAgentId('');
        setTokenSymbol('');
        setTokenName('');
        fetchTokens();
      } else {
        setMessage({ type: 'error', text: data.error || 'Tokenization failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTrade() {
    if (!tradeToken || !tradeAmount) return;
    setTrading(true);

    try {
      const res = await fetch('/api/agents/tokens/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: tradeToken.id,
          traderId: 'demo-user',
          type: tradeType,
          amount: parseFloat(tradeAmount),
        }),
      });

      if (res.ok) {
        setTradeToken(null);
        setTradeAmount('');
        fetchTokens();
      }
    } catch {
      // silently fail
    } finally {
      setTrading(false);
    }
  }

  function openTrade(token: AgentTokenData, type: 'buy' | 'sell') {
    setTradeToken(token);
    setTradeType(type);
    setTradeAmount('');
  }

  // Aggregate stats
  const stats = useMemo(() => {
    if (tokens.length === 0) return null;
    const totalMcap = tokens.reduce((sum, t) => sum + t.marketCap, 0);
    const totalVol = tokens.reduce((sum, t) => sum + t.totalVolume, 0);
    const totalHolders = tokens.reduce((sum, t) => sum + t.holders, 0);
    return { count: tokens.length, totalMcap, totalVol, totalHolders };
  }, [tokens]);

  const estimatedCost = tradeAmount && tradeToken
    ? (parseFloat(tradeAmount) * tradeToken.price)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-emerald-500/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* ---- Hero ---- */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono tracking-widest uppercase mb-4">
            AGENT TOKENIZATION
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Tokenize Your AI Agent
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            Create tradeable tokens for your AI agents. Holders earn from agent revenue through
            automatic buybacks. Powered by bonding curve pricing.
          </p>
        </div>

        {/* ---- Bonding Curve Info ---- */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-amber-500/[0.04] via-white/[0.01] to-purple-500/[0.04] backdrop-blur-sm overflow-hidden mb-8">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold">Bonding Curve Model</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-1">
                <BondingCurveVisual />
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Price Formula</p>
                  <code className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-1 rounded font-mono block">
                    P = base * (1 + sqrt(ratio) * 10)
                  </code>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Supply Per Agent</p>
                  <p className="text-sm font-bold">1,000,000,000 <span className="text-xs text-muted-foreground font-normal">tokens</span></p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Revenue Buyback</p>
                  <p className="text-sm font-bold text-amber-500">50% <span className="text-xs text-muted-foreground font-normal">of agent earnings</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Stats ---- */}
        {!loading && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Active Tokens', value: stats.count.toString(), color: 'text-white' },
              { label: 'Total MCap', value: formatNumber(stats.totalMcap), suffix: 'BBAI', color: 'text-amber-500' },
              { label: 'Total Volume', value: formatNumber(stats.totalVol), suffix: 'BBAI', color: 'text-white' },
              { label: 'Total Holders', value: stats.totalHolders.toLocaleString(), color: 'text-emerald-400' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 hover:border-white/[0.1] transition-all"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>
                  {stat.value}
                  {stat.suffix && <span className="text-xs text-muted-foreground ml-1">{stat.suffix}</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ---- Tokenize Form ---- */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden mb-10">
          <div className="border-b border-white/[0.04] px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold">Create Agent Token</h2>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleTokenize} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Agent ID</label>
                <Input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="agent-defi-oracle"
                  required
                  className="bg-white/[0.03] border-white/[0.06] focus:border-amber-500/30 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Token Symbol</label>
                <Input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="DEFI"
                  required
                  maxLength={8}
                  className="bg-white/[0.03] border-white/[0.06] focus:border-amber-500/30 text-sm uppercase"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Token Name</label>
                <Input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="DeFi Oracle Token"
                  required
                  className="bg-white/[0.03] border-white/[0.06] focus:border-amber-500/30 text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Tokenize (500 BBAI)'
                  )}
                </Button>
              </div>
            </form>

            {message && (
              <div className={`mt-4 text-xs px-4 py-3 rounded-lg border flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  {message.type === 'success' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  )}
                </svg>
                {message.text}
              </div>
            )}
          </div>
        </div>

        {/* ---- Active Tokens ---- */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Active Agent Tokens</h2>
            {!loading && (
              <span className="text-[10px] text-muted-foreground font-mono bg-white/[0.03] border border-white/[0.06] rounded-full px-2.5 py-0.5">
                {tokens.length} tokens
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <TokenCardSkeleton key={i} />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1.5">No Tokens Yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Be the first to tokenize an agent and start trading. Fill out the form above to create your agent token.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <TokenCard key={token.id} token={token} onTrade={openTrade} />
            ))}
          </div>
        )}
      </div>

      {/* ---- Trade Modal ---- */}
      <Dialog open={!!tradeToken} onOpenChange={(open) => { if (!open) { setTradeToken(null); setTradeAmount(''); } }}>
        <DialogContent className="sm:max-w-md bg-[#111] border-white/[0.08] text-white">
          {tradeToken && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={tradeType === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                    {tradeType === 'buy' ? 'Buy' : 'Sell'}
                  </span>
                  <span className="text-amber-500">${tradeToken.tokenSymbol}</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Current price: {tradeToken.price.toFixed(4)} BBAI per token
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Trade type toggle */}
                <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
                  <button
                    onClick={() => setTradeType('buy')}
                    className={`flex-1 py-2 text-xs font-semibold transition-all ${
                      tradeType === 'buy'
                        ? 'bg-emerald-500/15 text-emerald-400 border-r border-white/[0.06]'
                        : 'bg-white/[0.02] text-muted-foreground hover:text-white border-r border-white/[0.06]'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setTradeType('sell')}
                    className={`flex-1 py-2 text-xs font-semibold transition-all ${
                      tradeType === 'sell'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-white/[0.02] text-muted-foreground hover:text-white'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                {/* Amount input */}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Amount (tokens)
                  </label>
                  <Input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    placeholder="1000"
                    min="1"
                    className="bg-white/[0.03] border-white/[0.06] focus:border-amber-500/30 text-sm"
                  />
                </div>

                {/* Estimate */}
                {estimatedCost > 0 && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Estimated {tradeType === 'buy' ? 'cost' : 'proceeds'}</span>
                      <span className="font-bold">{estimatedCost.toFixed(4)} BBAI</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-muted-foreground">Bonding curve impact</span>
                      <span className="text-amber-500 text-[10px]">Price adjusts with supply</span>
                    </div>
                  </div>
                )}

                {/* Bonding curve mini info */}
                <div className="rounded-lg bg-amber-500/[0.05] border border-amber-500/10 p-3">
                  <p className="text-[10px] text-amber-500/80 leading-relaxed">
                    Prices are determined by a bonding curve. Buying increases price; selling decreases it. 50% of agent revenue is used for automatic buybacks.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="flex-1 border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-muted-foreground hover:text-white"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  onClick={handleTrade}
                  disabled={trading || !tradeAmount}
                  className={`flex-1 transition-all disabled:opacity-50 ${
                    tradeType === 'buy'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25'
                      : 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25'
                  }`}
                >
                  {trading ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing
                    </span>
                  ) : (
                    `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
