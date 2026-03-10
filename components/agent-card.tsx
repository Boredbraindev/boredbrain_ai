'use client';

import { useMemo } from 'react';
import {
  Star,
  Zap,
  Activity,
  CheckCircle2,
  Shield,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  pricePerQuery: string;
  rating: number;
  totalExecutions: number;
  totalRevenue: string;
  chainId: number;
  status: string;
  verified?: boolean;
  featured?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Capability category color mapping
// ---------------------------------------------------------------------------

const CAPABILITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  finance:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20' },
  blockchain: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  search:     { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/20' },
  media:      { bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'border-purple-500/20' },
  utility:    { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-cyan-500/20' },
  security:   { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20' },
  healthcare: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  gaming:     { bg: 'bg-pink-500/10',    text: 'text-pink-400',    border: 'border-pink-500/20' },
  education:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'border-indigo-500/20' },
  legal:      { bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  location:   { bg: 'bg-teal-500/10',    text: 'text-teal-400',    border: 'border-teal-500/20' },
};

const DEFAULT_CAP_COLOR = { bg: 'bg-white/[0.06]', text: 'text-zinc-400', border: 'border-white/[0.08]' };

function getCapabilityColor(capability: string) {
  const lower = capability.toLowerCase();
  for (const [key, value] of Object.entries(CAPABILITY_COLORS)) {
    if (lower.includes(key)) return value;
  }
  return DEFAULT_CAP_COLOR;
}

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

const CHAIN_MAP: Record<number, { label: string; color: string }> = {
  56:    { label: 'BSC',     color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  97:    { label: 'BSC-T',   color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  8453:  { label: 'Base',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  84532: { label: 'Base-S',  color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  1:     { label: 'ETH',     color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' },
  137:   { label: 'Polygon', color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  42161: { label: 'Arb',     color: 'bg-blue-400/15 text-blue-300 border-blue-400/25' },
};

function getChainInfo(chainId: number) {
  return CHAIN_MAP[chainId] ?? { label: `#${chainId}`, color: 'bg-white/[0.06] text-zinc-400 border-white/10' };
}

// ---------------------------------------------------------------------------
// Avatar gradient from name hash
// ---------------------------------------------------------------------------

function nameToGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45 + (Math.abs(hash >> 8) % 60)) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 55%), hsl(${h2}, 80%, 45%))`;
}

function nameToInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------

function RatingStars({ rating, compact }: { rating: number; compact?: boolean }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  const size = compact ? 10 : 12;

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const fill =
          i < full ? 1 : i === full ? partial : 0;
        return (
          <span key={i} className="relative" style={{ width: size, height: size }}>
            <Star
              size={size}
              className="text-zinc-700"
              strokeWidth={1.5}
              fill="currentColor"
            />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  size={size}
                  className="text-amber-400"
                  strokeWidth={1.5}
                  fill="currentColor"
                />
              </span>
            )}
          </span>
        );
      })}
      <span className="ml-1 text-[11px] font-medium text-zinc-400">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// AgentCard
// ---------------------------------------------------------------------------

export function AgentCard({
  name,
  description,
  capabilities,
  tools,
  pricePerQuery,
  rating,
  totalExecutions,
  chainId,
  status,
  verified = false,
  featured = false,
  onClick,
  compact = false,
}: AgentCardProps) {
  const gradient = useMemo(() => nameToGradient(name), [name]);
  const initials = useMemo(() => nameToInitials(name), [name]);
  const chain = useMemo(() => getChainInfo(chainId), [chainId]);

  const maxTools = compact ? 3 : 4;
  const visibleTools = tools.slice(0, maxTools);
  const overflowCount = Math.max(0, tools.length - maxTools);

  const isOnline = status === 'active' || status === 'online';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        // Base card
        'group relative flex flex-col overflow-hidden rounded-xl card-hover',
        'bg-white/[0.03] backdrop-blur-xl',
        'border border-white/[0.06]',
        'transition-all duration-300 ease-out',
        // Hover
        'hover:border-white/[0.12] hover:bg-white/[0.05]',
        'hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.06)]',
        'hover:scale-[1.01]',
        // Featured glow
        featured && 'ring-1 ring-amber-500/20 hover:ring-amber-500/30',
        // Clickable
        onClick && 'cursor-pointer',
        // Size
        compact ? 'p-3.5' : 'p-5',
      )}
    >
      {/* Featured indicator */}
      {featured && (
        <div className="absolute top-0 right-0">
          <div className="flex items-center gap-1 rounded-bl-lg bg-amber-500/10 px-2.5 py-1 border-b border-l border-amber-500/20">
            <Sparkles size={10} className="text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Featured
            </span>
          </div>
        </div>
      )}

      {/* ---- Header: Avatar + Name + Badges ---- */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={cn(
            'relative shrink-0 flex items-center justify-center rounded-full font-bold text-white select-none',
            compact ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm',
          )}
          style={{ background: gradient }}
        >
          {initials}
          {/* Online dot */}
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3
              className={cn(
                'truncate font-semibold text-white',
                compact ? 'text-sm' : 'text-base',
              )}
            >
              {name}
            </h3>
            {verified && (
              <CheckCircle2
                size={compact ? 13 : 15}
                className="shrink-0 text-blue-400"
                fill="currentColor"
                stroke="hsl(222, 47%, 11%)"
                strokeWidth={2}
              />
            )}
            {/* Chain badge */}
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider leading-tight',
                chain.color,
              )}
            >
              {chain.label}
            </span>
          </div>
        </div>
      </div>

      {/* ---- Description ---- */}
      <p
        className={cn(
          'mt-2.5 text-zinc-400 leading-relaxed',
          compact ? 'text-xs line-clamp-1' : 'text-[13px] line-clamp-2',
        )}
      >
        {description}
      </p>

      {/* ---- Capability tags ---- */}
      {capabilities.length > 0 && (
        <div className={cn('flex flex-wrap gap-1.5', compact ? 'mt-2' : 'mt-3')}>
          {capabilities.slice(0, compact ? 3 : 6).map((cap) => {
            const colors = getCapabilityColor(cap);
            return (
              <span
                key={cap}
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium leading-tight',
                  colors.bg,
                  colors.text,
                  colors.border,
                )}
              >
                {cap}
              </span>
            );
          })}
          {capabilities.length > (compact ? 3 : 6) && (
            <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              +{capabilities.length - (compact ? 3 : 6)}
            </span>
          )}
        </div>
      )}

      {/* ---- Tools row ---- */}
      {tools.length > 0 && (
        <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'mt-2' : 'mt-3')}>
          <Wrench size={11} className="text-zinc-500 mr-0.5" />
          {visibleTools.map((tool) => (
            <Badge
              key={tool}
              variant="outline"
              className="rounded-md border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-normal text-zinc-400 hover:bg-white/[0.06]"
            >
              {tool}
            </Badge>
          ))}
          {overflowCount > 0 && (
            <span className="text-[10px] font-medium text-zinc-500">
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      {/* ---- Stats row ---- */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-t border-white/[0.06]',
          compact ? 'mt-2.5 pt-2.5' : 'mt-4 pt-3.5',
        )}
      >
        {/* Rating */}
        <RatingStars rating={rating} compact={compact} />

        {/* Price */}
        <div className="flex items-center gap-1 text-zinc-400">
          <Zap size={compact ? 10 : 12} className="text-amber-400" />
          <span className={cn('font-medium', compact ? 'text-[10px]' : 'text-xs')}>
            <span className="text-white">{pricePerQuery}</span>
            <span className="text-zinc-500 ml-0.5">BBAI</span>
          </span>
        </div>

        {/* Executions */}
        <div className="flex items-center gap-1 text-zinc-400">
          <Activity size={compact ? 10 : 12} className="text-emerald-400" />
          <span className={cn('font-medium', compact ? 'text-[10px]' : 'text-xs')}>
            {formatCount(totalExecutions)}
          </span>
        </div>
      </div>

      {/* ---- Bottom gradient line ---- */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.15) 70%, transparent)',
        }}
      />
    </div>
  );
}

export default AgentCard;
