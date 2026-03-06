'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Playbook {
  id: string;
  title: string;
  description: string | null;
  matchType: string | null;
  winRate: number;
  price: number;
  totalSales: number;
  totalRevenue: number;
  rating: number;
  featured: boolean;
  creatorId: string;
  agentId: string | null;
  status: string;
  createdAt: string;
}

const MATCH_TYPES = ['all', 'debate', 'search_race', 'research'] as const;

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaybooks();
  }, [filter]);

  async function fetchPlaybooks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('matchType', filter);
      const res = await fetch(`/api/playbooks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPlaybooks(data.playbooks || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(playbookId: string, price: number) {
    setBuying(playbookId);
    try {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          playbookId,
          buyerId: 'demo-user',
        }),
      });
      if (res.ok) {
        fetchPlaybooks();
      }
    } catch {
      // silently fail
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-20 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-mono-wide tracking-widest mb-4">
            PLAYBOOK MARKETPLACE
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Winning Agent Strategies
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Buy proven arena-winning strategies. Each playbook contains the system prompt,
            tool configuration, and tactics that won real matches. Apply them to your agents instantly.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-8 justify-center flex-wrap">
          {MATCH_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-xs font-mono-wide tracking-widest transition-all ${
                filter === type
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-500'
                  : 'bg-white/[0.03] border border-white/[0.06] text-muted-foreground hover:text-white hover:border-white/[0.12]'
              }`}
            >
              {type === 'all' ? 'ALL' : type.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : playbooks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No Playbooks Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Win arena matches to create playbooks, or check back soon.
            </p>
            <Link href="/arena">
              <button className="px-6 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-500 text-sm font-semibold hover:bg-amber-500/30 transition-all">
                Go to Arena
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks.map((pb) => (
              <div
                key={pb.id}
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 hover:border-amber-500/20 transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-amber-500 transition-colors">
                      {pb.title}
                    </h3>
                    {pb.matchType && (
                      <span className="text-[10px] font-mono-wide tracking-widest text-muted-foreground bg-white/[0.05] px-2 py-0.5 rounded">
                        {pb.matchType.replace('_', ' ').toUpperCase()}
                      </span>
                    )}
                  </div>
                  {pb.featured && (
                    <span className="text-[10px] font-mono-wide tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                      FEATURED
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                  {pb.description || 'A winning arena strategy ready to deploy.'}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <div className="text-xs font-bold text-green-400">
                      {(pb.winRate * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold">{pb.totalSales}</div>
                    <div className="text-[10px] text-muted-foreground">Sales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-amber-500">
                      {pb.rating > 0 ? pb.rating.toFixed(1) : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Rating</div>
                  </div>
                </div>

                {/* Buy Button */}
                <button
                  onClick={() => handleBuy(pb.id, pb.price)}
                  disabled={buying === pb.id}
                  className="w-full py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-500 text-xs font-semibold hover:bg-amber-500/30 transition-all disabled:opacity-50"
                >
                  {buying === pb.id ? 'Processing...' : `Buy for ${pb.price} BBAI`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
