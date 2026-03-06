'use client';

import { useEffect, useState } from 'react';

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

  function formatNumber(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(2);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-20 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-mono-wide tracking-widest mb-4">
            AGENT TOKENIZATION
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Tokenize Your AI Agent
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Create tradeable tokens for your AI agents. Holders earn from agent revenue through
            automatic buybacks. Powered by bonding curve pricing.
          </p>
        </div>

        {/* Bonding Curve Info */}
        <div className="rounded-xl bg-gradient-to-r from-amber-500/5 to-purple-500/5 border border-white/[0.06] p-6 mb-8">
          <h3 className="text-sm font-mono-wide tracking-widest text-amber-500 mb-3">BONDING CURVE MODEL</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Price Formula</div>
              <code className="text-xs text-green-400 bg-white/[0.05] px-2 py-1 rounded">
                P = base * (1 + sqrt(supply_ratio) * 10)
              </code>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Supply Per Agent</div>
              <div className="font-bold">1,000,000,000 tokens</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Revenue Buyback</div>
              <div className="font-bold text-amber-500">50% of agent earnings</div>
            </div>
          </div>
        </div>

        {/* Tokenize Form */}
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 mb-10">
          <h2 className="text-lg font-semibold mb-4">Create Agent Token</h2>
          <form onSubmit={handleTokenize} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Agent ID</label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="agent-defi-oracle"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Token Symbol</label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                placeholder="DEFI"
                required
                maxLength={8}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="DeFi Oracle Token"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-500 text-sm font-semibold hover:bg-amber-500/30 transition-all disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Tokenize (500 BBAI)'}
              </button>
            </div>
          </form>

          {message && (
            <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Active Tokens */}
        <h2 className="text-lg font-semibold mb-4">Active Agent Tokens</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-16 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="text-4xl mb-4">🪙</div>
            <h3 className="text-lg font-semibold mb-2">No Tokens Yet</h3>
            <p className="text-muted-foreground text-sm">
              Be the first to tokenize an agent and start trading.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 hover:border-amber-500/20 transition-all group"
              >
                {/* Token Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-amber-500 font-bold text-sm">${token.tokenSymbol}</span>
                    <span className="text-xs text-muted-foreground ml-2">{token.tokenName}</span>
                  </div>
                  <span className={`text-[10px] font-mono-wide tracking-widest px-2 py-0.5 rounded ${
                    token.status === 'active'
                      ? 'text-green-400 bg-green-500/10'
                      : 'text-muted-foreground bg-white/[0.05]'
                  }`}>
                    {token.status.toUpperCase()}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="text-xl font-bold">{token.price.toFixed(4)} <span className="text-xs text-muted-foreground">BBAI</span></div>
                  <div className="text-xs text-muted-foreground">
                    MCap: {formatNumber(token.marketCap)} BBAI
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Supply: </span>
                    <span>{formatNumber(token.circulatingSupply)} / {formatNumber(token.totalSupply)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Holders: </span>
                    <span>{token.holders}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Volume: </span>
                    <span>{formatNumber(token.totalVolume)} BBAI</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buyback: </span>
                    <span className="text-green-400">{formatNumber(token.buybackPool)} BBAI</span>
                  </div>
                </div>

                {/* Trade Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setTradeToken(token); setTradeType('buy'); }}
                    className="flex-1 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/30 transition-all"
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => { setTradeToken(token); setTradeType('sell'); }}
                    className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-all"
                  >
                    Sell
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trade Modal */}
        {tradeToken && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="rounded-xl bg-[#111] border border-white/[0.1] p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-1">
                {tradeType === 'buy' ? 'Buy' : 'Sell'} ${tradeToken.tokenSymbol}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Current price: {tradeToken.price.toFixed(4)} BBAI per token
              </p>

              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">Amount (tokens)</label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder="1000"
                  min="1"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm focus:outline-none focus:border-amber-500/50"
                />
                {tradeAmount && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Est. cost: {(parseFloat(tradeAmount) * tradeToken.price).toFixed(2)} BBAI
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTrade}
                  disabled={trading || !tradeAmount}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                    tradeType === 'buy'
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                      : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                  }`}
                >
                  {trading ? 'Processing...' : `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`}
                </button>
                <button
                  onClick={() => { setTradeToken(null); setTradeAmount(''); }}
                  className="flex-1 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-sm text-muted-foreground hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
