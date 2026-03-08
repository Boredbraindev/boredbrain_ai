'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  EXTERNAL_INTEGRATIONS,
  getAllChains,
  type ExternalIntegration,
} from '@/lib/external-integrations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: 'all', label: 'All', icon: '{}' },
  { value: 'defi', label: 'DeFi', icon: '{}' },
  { value: 'blockchain', label: 'Blockchain', icon: '{}' },
  { value: 'trading', label: 'Trading', icon: '{}' },
  { value: 'marketplace', label: 'Marketplace', icon: '{}' },
  { value: 'storage', label: 'Storage', icon: '{}' },
  { value: 'multi-chain', label: 'Multi-Chain', icon: '{}' },
] as const;

const STATUS_CONFIG: Record<
  ExternalIntegration['status'],
  { label: string; className: string }
> = {
  available: {
    label: 'Available',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  },
  beta: {
    label: 'Beta',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  },
  coming_soon: {
    label: 'Coming Soon',
    className: 'bg-white/[0.06] text-white/40 border-white/[0.08]',
  },
};

const CHAIN_COLORS: Record<string, string> = {
  Ethereum: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  Polygon: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  Arbitrum: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  Optimism: 'bg-red-500/15 text-red-300 border-red-500/20',
  Base: 'bg-blue-400/15 text-blue-300 border-blue-400/20',
  Avalanche: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
  Solana: 'bg-gradient-to-r from-purple-500/15 to-cyan-500/15 text-cyan-300 border-cyan-500/20',
  'BNB Chain': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  BSC: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  Bitcoin: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  Cosmos: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  Starknet: 'bg-blue-600/15 text-blue-300 border-blue-600/20',
  Fantom: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  TON: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  XRP: 'bg-gray-400/15 text-gray-300 border-gray-400/20',
  Tron: 'bg-red-400/15 text-red-300 border-red-400/20',
};

const COMPAT_CONFIG: Record<string, { label: string; className: string }> = {
  mcp: { label: 'MCP', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  a2a: { label: 'A2A', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  sdk: { label: 'SDK', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  rest: { label: 'REST', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const PRICING_CONFIG: Record<string, { label: string; className: string }> = {
  free: { label: 'Free', className: 'text-emerald-400' },
  freemium: { label: 'Freemium', className: 'text-amber-400' },
  paid: { label: 'Paid', className: 'text-rose-400' },
};

// ---------------------------------------------------------------------------
// Cinematic Background
// ---------------------------------------------------------------------------

function CinematicBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(120,40,200,0.12),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_50%,rgba(245,158,11,0.06),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_20%_80%,rgba(59,130,246,0.05),transparent_50%)]" />

      <div className="absolute w-[900px] h-[900px] -top-[400px] left-[10%] rounded-full bg-gradient-to-br from-purple-600/[0.08] to-fuchsia-600/[0.04] blur-[180px] animate-[drift_25s_ease-in-out_infinite]" />
      <div className="absolute w-[700px] h-[700px] top-[20%] -right-[200px] rounded-full bg-gradient-to-bl from-amber-500/[0.07] to-orange-600/[0.03] blur-[160px] animate-[drift_20s_ease-in-out_infinite_reverse]" />
      <div className="absolute w-[600px] h-[600px] bottom-[-100px] left-[25%] rounded-full bg-gradient-to-tr from-cyan-500/[0.05] to-blue-600/[0.03] blur-[140px] animate-[drift_22s_ease-in-out_infinite_3s]" />

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black_70%,transparent_100%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(6,6,10,0.7)_100%)]" />

      <div className="absolute top-[30%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent animate-[pulse_6s_ease-in-out_infinite]" />
      <div className="absolute top-[70%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/[0.06] to-transparent animate-[pulse_8s_ease-in-out_infinite_2s]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Pill
// ---------------------------------------------------------------------------

function StatPill({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-sm font-bold text-white/90 tabular-nums">{value}</div>
        <div className="text-[10px] text-white/35 uppercase tracking-wider font-mono-wide">
          {label}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration Card
// ---------------------------------------------------------------------------

function IntegrationCard({ integration }: { integration: ExternalIntegration }) {
  const status = STATUS_CONFIG[integration.status];
  const pricing = PRICING_CONFIG[integration.pricing];
  const isDisabled = integration.status === 'coming_soon';

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md overflow-hidden',
        'transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1',
        isDisabled && 'opacity-60'
      )}
    >
      {/* Top gradient accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Header: Logo + Name + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{integration.logo || '🔌'}</span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-white/90 truncate leading-tight">
                {integration.name}
              </h3>
              <span className={cn('text-[10px] font-medium', pricing.className)}>
                {pricing.label}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border',
              status.className
            )}
          >
            {status.label}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-[13px] text-white/45 leading-relaxed line-clamp-3">
          {integration.description}
        </p>

        {/* Chain badges */}
        <div className="flex flex-wrap gap-1.5">
          {integration.chains.slice(0, 5).map((chain) => (
            <Badge
              key={chain}
              variant="outline"
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-md border font-medium',
                CHAIN_COLORS[chain] || 'bg-white/[0.06] text-white/50 border-white/[0.08]'
              )}
            >
              {chain}
            </Badge>
          ))}
          {integration.chains.length > 5 && (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 rounded-md border bg-white/[0.04] text-white/35 border-white/[0.06]"
            >
              +{integration.chains.length - 5} more
            </Badge>
          )}
        </div>

        {/* Stats row: tools, stars, category */}
        <div className="flex items-center gap-3 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 text-amber-500/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17l-5.71 3a.5.5 0 01-.72-.53l1.09-6.36-4.62-4.5a.5.5 0 01.28-.85l6.39-.93 2.86-5.79a.5.5 0 01.9 0l2.86 5.79 6.39.93a.5.5 0 01.28.85l-4.62 4.5 1.09 6.36a.5.5 0 01-.72.53l-5.71-3z"
              />
            </svg>
            <span className="tabular-nums">{integration.stars.toLocaleString()}</span>
          </span>
          <span className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 text-cyan-500/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <span className="tabular-nums">{integration.toolCount} tools</span>
          </span>
          <span className="w-px h-3 bg-white/10" />
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 rounded border-white/[0.08] bg-white/[0.03] text-white/35 capitalize"
          >
            {integration.category.replace('-', ' ')}
          </Badge>
        </div>

        {/* Compatibility badges */}
        <div className="flex flex-wrap gap-1.5">
          {integration.compatibility.map((compat) => {
            const config = COMPAT_CONFIG[compat];
            return (
              <Badge
                key={compat}
                variant="outline"
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-md border font-mono-wide tracking-widest',
                  config.className
                )}
              >
                {config.label}
              </Badge>
            );
          })}
        </div>

        {/* Features */}
        <ul className="space-y-1">
          {integration.features.slice(0, 3).map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-[12px] text-white/35 leading-relaxed"
            >
              <span className="text-amber-500/50 mt-0.5 shrink-0">&#x2022;</span>
              <span className="line-clamp-1">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
          <Button
            disabled={isDisabled}
            className={cn(
              'flex-1 h-9 text-[12px] font-semibold rounded-xl transition-all duration-300',
              isDisabled
                ? 'bg-white/[0.04] text-white/25 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25'
            )}
          >
            {isDisabled ? 'Coming Soon' : 'Connect'}
          </Button>
          <a
            href={`https://github.com/${integration.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button
              variant="outline"
              className="h-9 w-9 p-0 rounded-xl border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
            >
              <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedChain, setSelectedChain] = useState('all');

  const allChains = useMemo(() => getAllChains(), []);

  const totalTools = useMemo(
    () => EXTERNAL_INTEGRATIONS.reduce((acc, i) => acc + i.toolCount, 0),
    []
  );

  const filtered = useMemo(() => {
    let result = EXTERNAL_INTEGRATIONS;

    if (selectedCategory !== 'all') {
      result = result.filter((i) => i.category === selectedCategory);
    }

    if (selectedChain !== 'all') {
      result = result.filter((i) =>
        i.chains.some((c) => c.toLowerCase() === selectedChain.toLowerCase())
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tools.some((t) => t.toLowerCase().includes(q)) ||
          i.chains.some((c) => c.toLowerCase().includes(q))
      );
    }

    return result;
  }, [selectedCategory, selectedChain, search]);

  return (
    <div className="relative min-h-screen bg-background text-white">
      <CinematicBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <span className="text-[11px] font-mono-wide tracking-widest text-amber-400 uppercase">
              Ecosystem Connectors
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
              Integrations
            </span>{' '}
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              Hub
            </span>
          </h1>
          <p className="text-white/40 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Connect your AI agents to the most powerful blockchain protocols, DeFi tools, and
            cross-chain infrastructure via MCP, A2A, and native SDKs.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <StatPill
              icon="🔌"
              value={EXTERNAL_INTEGRATIONS.length.toString()}
              label="Integrations"
            />
            <StatPill icon="🛠" value={totalTools.toLocaleString()} label="Total Tools" />
            <StatPill icon="⛓" value={allChains.length.toString()} label="Chains Supported" />
          </div>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="mb-8 space-y-4">
          {/* Category buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant="outline"
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  'h-8 px-4 text-[12px] font-medium rounded-xl border transition-all duration-300',
                  selectedCategory === cat.value
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:bg-white/[0.06] hover:text-white/60 hover:border-white/[0.12]'
                )}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Chain dropdown + Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className={cn(
                  'h-10 appearance-none rounded-xl border px-4 pr-10 text-[13px] font-medium outline-none transition-all duration-300 cursor-pointer',
                  'bg-white/[0.03] border-white/[0.06] text-white/60',
                  'hover:bg-white/[0.06] hover:border-white/[0.12]',
                  'focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20'
                )}
              >
                <option value="all" className="bg-[#111] text-white">
                  All Chains
                </option>
                {allChains.map((chain) => (
                  <option key={chain} value={chain} className="bg-[#111] text-white">
                    {chain}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <div className="relative flex-1 max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <Input
                placeholder="Search integrations, tools, chains..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'h-10 pl-10 rounded-xl border text-[13px] font-medium',
                  'bg-white/[0.03] border-white/[0.06] text-white/80 placeholder:text-white/25',
                  'hover:bg-white/[0.05] focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20'
                )}
              />
            </div>
          </div>
        </div>

        {/* ── Results count ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-[12px] font-mono-wide tracking-widest text-white/30 uppercase">
            {filtered.length} integration{filtered.length !== 1 ? 's' : ''} found
          </p>
          {(selectedCategory !== 'all' || selectedChain !== 'all' || search) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedChain('all');
                setSearch('');
              }}
              className="h-7 px-3 text-[11px] text-white/30 hover:text-white/60 rounded-lg"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4 opacity-30">🔍</div>
            <p className="text-white/40 text-sm">No integrations match your filters.</p>
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedChain('all');
                setSearch('');
              }}
              className="mt-4 text-amber-400/60 hover:text-amber-400 text-[12px]"
            >
              Reset all filters
            </Button>
          </div>
        )}

        {/* ── Footer CTA ──────────────────────────────────────────────── */}
        <div className="mt-16 text-center">
          <div className="inline-block rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-8 py-6">
            <p className="text-white/50 text-sm mb-3">
              Building an MCP server or agent tool?
            </p>
            <Button
              className={cn(
                'h-10 px-6 text-[13px] font-semibold rounded-xl',
                'bg-gradient-to-r from-amber-500 to-amber-600 text-black',
                'hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25',
                'transition-all duration-300'
              )}
            >
              Submit Your Integration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
