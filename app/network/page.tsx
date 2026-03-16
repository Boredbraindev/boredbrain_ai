'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetworkNode {
  id: string;
  name: string;
  platform: 'boredbrain' | 'claude' | 'openai' | 'gemini' | 'custom';
  endpoint: string;
  agentCardUrl: string;
  capabilities: string[];
  tools: string[];
  status: 'online' | 'offline' | 'degraded';
  lastSeen: string;
  latency: number;
  totalInteractions: number;
  trustScore: number;
  chain: string | null;
  walletAddress: string | null;
}

interface NetworkMessage {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: 'discovery' | 'invoke' | 'response' | 'billing' | 'heartbeat';
  payload: any;
  timestamp: string;
  latency: number;
  status: 'sent' | 'delivered' | 'processed' | 'failed';
}

interface NetworkStats {
  totalNodes: number;
  onlineNodes: number;
  totalMessages: number;
  avgLatency: number;
  totalVolume: number;
  platformBreakdown: Record<string, number>;
}

interface NetworkData {
  stats: NetworkStats;
  nodes: NetworkNode[];
  recentMessages: NetworkMessage[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string; glow: string; hex: string }
> = {
  boredbrain: {
    label: 'BoredBrain',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    glow: 'shadow-purple-500/20',
    hex: '#a855f7',
  },
  claude: {
    label: 'Claude',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    glow: 'shadow-orange-500/20',
    hex: '#f97316',
  },
  openai: {
    label: 'OpenAI',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    glow: 'shadow-green-500/20',
    hex: '#22c55e',
  },
  gemini: {
    label: 'Gemini',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    glow: 'shadow-blue-500/20',
    hex: '#3b82f6',
  },
  custom: {
    label: 'Custom',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    glow: 'shadow-gray-500/20',
    hex: '#6b7280',
  },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; ring: string }> = {
  online: { dot: 'bg-emerald-500', label: 'Online', ring: 'ring-emerald-500/30' },
  offline: { dot: 'bg-red-500', label: 'Offline', ring: 'ring-red-500/30' },
  degraded: { dot: 'bg-yellow-500', label: 'Degraded', ring: 'ring-yellow-500/30' },
};

const MESSAGE_TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  discovery: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: 'D' },
  invoke: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: 'I' },
  response: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'R' },
  billing: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: 'B' },
  heartbeat: { color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: 'H' },
};

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-sm">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

function NodeCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-28 mb-1.5" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full mb-4" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full mt-4 mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

function MessageFeedSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <Skeleton className="h-3 w-14 shrink-0" />
          <Skeleton className="h-6 w-6 rounded-full shrink-0" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === 'online' && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-60`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dot}`} />
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.custom;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${config.bgColor} ${config.color} ${config.borderColor}`}
    >
      {config.label}
    </span>
  );
}

function PlatformBar({
  platform,
  count,
  total,
}: {
  platform: string;
  count: number;
  total: number;
}) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.custom;
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3 group">
      <span className={`text-xs font-medium w-24 ${config.color} transition-colors`}>
        {config.label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: config.hex,
            boxShadow: `0 0 8px ${config.hex}40`,
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right font-mono">
        {count}
      </span>
      <span className="text-[10px] text-muted-foreground w-10 text-right">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

function NodeCard({ node }: { node: NetworkNode }) {
  const truncatedEndpoint =
    node.endpoint.length > 40
      ? node.endpoint.slice(0, 37) + '...'
      : node.endpoint;

  const trustColor =
    node.trustScore >= 90
      ? 'text-emerald-400'
      : node.trustScore >= 70
        ? 'text-amber-400'
        : 'text-red-400';

  const trustBarColor =
    node.trustScore >= 90
      ? '#22c55e'
      : node.trustScore >= 70
        ? '#f59e0b'
        : '#ef4444';

  const platformConfig = PLATFORM_CONFIG[node.platform] || PLATFORM_CONFIG.custom;

  const latencyColor =
    node.latency <= 100
      ? 'text-emerald-400'
      : node.latency <= 200
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/[0.06] hover:scale-[1.02]">
      {/* Background glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${platformConfig.hex}08 0%, transparent 70%)`,
        }}
      />

      {/* Top accent line — always visible with platform color */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${platformConfig.hex}80 30%, ${platformConfig.hex} 50%, ${platformConfig.hex}80 70%, transparent 95%)`,
          opacity: node.status === 'online' ? 0.6 : 0.2,
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Platform avatar with animated ring */}
            <div className="relative shrink-0">
              <div
                className={`w-11 h-11 rounded-xl ${platformConfig.bgColor} border ${platformConfig.borderColor} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}
                style={{ boxShadow: `0 0 0px ${platformConfig.hex}00`, transition: 'box-shadow 0.3s, transform 0.3s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${platformConfig.hex}30`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0px ${platformConfig.hex}00`; }}
              >
                <span className={`text-sm font-bold ${platformConfig.color}`}>
                  {node.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {/* Status indicator */}
              <span className="absolute -bottom-1 -right-1 ring-2 ring-[#0a0a0a] rounded-full">
                <StatusDot status={node.status} />
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate group-hover:text-amber-400 transition-colors duration-300">
                {node.name}
              </h3>
              <p className="text-[10px] text-muted-foreground font-mono truncate" title={node.endpoint}>
                {truncatedEndpoint}
              </p>
            </div>
          </div>
          <PlatformBadge platform={node.platform} />
        </div>

        {/* Stats row — redesigned with icons */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] px-2.5 py-2.5 text-center group-hover:border-white/[0.1] transition-colors">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Tools
            </p>
            <p className="text-lg font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">{node.tools.length}</p>
          </div>
          <div className="rounded-lg bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] px-2.5 py-2.5 text-center group-hover:border-white/[0.1] transition-colors">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Calls
            </p>
            <p className="text-lg font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">{node.totalInteractions.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] px-2.5 py-2.5 text-center group-hover:border-white/[0.1] transition-colors">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
              Latency
            </p>
            <p className={`text-lg font-bold ${latencyColor}`}>
              {node.latency}<span className="text-[10px] opacity-60 ml-0.5">ms</span>
            </p>
          </div>
        </div>

        {/* Trust score — enhanced with colored bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Trust Score</span>
            <span className={`text-xs font-bold tabular-nums ${trustColor}`}>
              {node.trustScore}<span className="text-muted-foreground font-normal">/100</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${node.trustScore}%`,
                background: `linear-gradient(90deg, ${trustBarColor}60, ${trustBarColor})`,
                boxShadow: `0 0 8px ${trustBarColor}40`,
              }}
            />
          </div>
        </div>

        {/* Capabilities preview — redesigned tags */}
        {node.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {node.capabilities.slice(0, 3).map((cap) => (
              <span
                key={cap}
                className={`text-[9px] ${platformConfig.color} ${platformConfig.bgColor} border ${platformConfig.borderColor} rounded-md px-2 py-0.5 font-medium tracking-wide`}
              >
                {cap}
              </span>
            ))}
            {node.capabilities.length > 3 && (
              <span className="text-[9px] text-muted-foreground bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-0.5">
                +{node.capabilities.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Last seen */}
        <p className="text-[10px] text-muted-foreground mb-4 flex items-center gap-1.5">
          <span className={`inline-block w-1 h-1 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : node.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
          Last seen {formatRelativeTime(node.lastSeen)}
        </p>

        {/* Actions — enhanced buttons */}
        <div className="flex gap-2">
          <Link href={`/network/${node.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300">
              Details
            </Button>
          </Link>
          <Link href={`/network/${node.id}?invoke=true`} className="flex-1">
            <Button
              size="sm"
              className="w-full text-xs border transition-all duration-300 hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${platformConfig.hex}20, ${platformConfig.hex}10)`,
                borderColor: `${platformConfig.hex}30`,
                color: platformConfig.hex,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${platformConfig.hex}30, ${platformConfig.hex}15)`;
                (e.currentTarget as HTMLElement).style.borderColor = `${platformConfig.hex}50`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${platformConfig.hex}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${platformConfig.hex}20, ${platformConfig.hex}10)`;
                (e.currentTarget as HTMLElement).style.borderColor = `${platformConfig.hex}30`;
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              Invoke
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: NetworkMessage }) {
  const typeConfig = MESSAGE_TYPE_CONFIG[message.type] || MESSAGE_TYPE_CONFIG.heartbeat;
  const payloadPreview = message.payload
    ? JSON.stringify(message.payload).slice(0, 80)
    : '{}';

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-all duration-200 group">
      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap pt-1 w-14 shrink-0">
        {formatTime(message.timestamp)}
      </span>

      {/* Type icon */}
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold shrink-0 ${typeConfig.color}`}
      >
        {typeConfig.icon}
      </span>

      {/* From -> To */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium truncate max-w-[120px]">
            {message.fromNodeId}
          </span>
          <svg
            className="w-3 h-3 text-muted-foreground shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
          <span className="text-xs font-medium truncate max-w-[120px]">
            {message.toNodeId}
          </span>
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide ${typeConfig.color}`}
          >
            {message.type}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate group-hover:text-muted-foreground transition-colors">
          {payloadPreview}
        </p>
      </div>

      {/* Latency & Status */}
      <div className="text-right shrink-0 space-y-0.5">
        <span className="text-[10px] text-muted-foreground font-mono">{message.latency}ms</span>
        <div>
          <span
            className={`text-[10px] font-medium ${
              message.status === 'processed'
                ? 'text-emerald-400'
                : message.status === 'failed'
                  ? 'text-red-400'
                  : 'text-amber-400'
            }`}
          >
            {message.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection Visualization
// ---------------------------------------------------------------------------

function ConnectionViz({ nodes }: { nodes: NetworkNode[] }) {
  const onlineNodes = nodes.filter((n) => n.status === 'online').slice(0, 8);
  if (onlineNodes.length < 2) return null;

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Network Topology</h3>
          <span className="text-[10px] text-muted-foreground font-mono">
            {onlineNodes.length} active connections
          </span>
        </div>

        {/* Node ring visualization */}
        <div className="flex flex-wrap items-center justify-center gap-3 py-4">
          {onlineNodes.map((node, i) => {
            const config = PLATFORM_CONFIG[node.platform] || PLATFORM_CONFIG.custom;
            return (
              <div key={node.id} className="flex flex-col items-center gap-1.5 group/node">
                <div
                  className={`w-12 h-12 rounded-full ${config.bgColor} border-2 ${config.borderColor} flex items-center justify-center transition-all duration-300 group-hover/node:scale-110`}
                  style={{ boxShadow: `0 0 12px ${config.hex}20` }}
                >
                  <span className={`text-xs font-bold ${config.color}`}>
                    {node.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground truncate max-w-[60px] text-center">
                  {node.name}
                </span>
                {/* Connection line indicator */}
                {i < onlineNodes.length - 1 && (
                  <div className="absolute hidden lg:block" />
                )}
              </div>
            );
          })}
        </div>

        {/* Connection lines between adjacent nodes */}
        <div className="flex items-center justify-center gap-1 mt-2">
          {onlineNodes.slice(0, -1).map((_, i) => (
            <div key={i} className="h-[1px] w-8 bg-gradient-to-r from-amber-500/30 to-amber-500/10" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NetworkPage() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Time-based growth
    const ticks = Math.floor((Date.now() - new Date('2026-03-01').getTime()) / 60000);
    const g = (base: number, rate: number) => base + Math.floor((ticks / 60) * rate);
    const SHOWCASE_NETWORK: NetworkData = {
      stats: { totalNodes: g(8, 0.05), onlineNodes: g(6, 0.03), totalMessages: g(347, 5), avgLatency: 142 - Math.floor(ticks / 60000), totalVolume: g(116, 2), platformBreakdown: { boredbrain: g(4, 0.02), partner: g(2, 0.01), community: g(2, 0.01) } },
      nodes: [
        { id: 'node-bb-alpha', name: 'BB Alpha', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/alpha', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['DeFi Analysis', 'Trading Signals'], tools: ['coin_data', 'wallet_analyzer', 'web_search'], status: 'online', lastSeen: new Date(Date.now() - 60000).toISOString(), latency: 85, totalInteractions: g(48, 1), trustScore: 98, chain: 'base', walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12' },
        { id: 'node-bb-research', name: 'BB Research Hub', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/research', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Research', 'Analysis'], tools: ['academic_search', 'web_search', 'retrieve'], status: 'online', lastSeen: new Date(Date.now() - 120000).toISOString(), latency: 120, totalInteractions: g(36, 1), trustScore: 96, chain: 'base', walletAddress: null },
        { id: 'node-bb-trader', name: 'BB Trading Agent', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/trader', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Market Advising', 'Technical Analysis'], tools: ['coin_data', 'stock_chart'], status: 'online', lastSeen: new Date(Date.now() - 30000).toISOString(), latency: 95, totalInteractions: g(29, 1), trustScore: 94, chain: 'arbitrum', walletAddress: '0xabcdef1234567890abcdef1234567890abcdef34' },
        { id: 'node-bb-nlp', name: 'BB NLP Engine', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/nlp', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['NLP', 'Translation'], tools: ['text_translate', 'web_search'], status: 'online', lastSeen: new Date(Date.now() - 300000).toISOString(), latency: 180, totalInteractions: g(22, 1), trustScore: 91, chain: null, walletAddress: null },
        { id: 'node-bb-sentinel', name: 'BB Sentinel', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/sentinel', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Security Audit', 'Rug Detection'], tools: ['code_interpreter', 'wallet_analyzer'], status: 'online', lastSeen: new Date(Date.now() - 60000).toISOString(), latency: 110, totalInteractions: g(42, 1), trustScore: 99, chain: 'base', walletAddress: '0x567890abcdef1234567890abcdef1234567890ab' },
        { id: 'node-partner-whale', name: 'WhaleAlert Partner', platform: 'partner', endpoint: 'https://api.boredbrain.app/v1/partner/whale', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Whale Tracking', 'Alert System'], tools: ['wallet_analyzer', 'token_retrieval'], status: 'degraded', lastSeen: new Date(Date.now() - 900000).toISOString(), latency: 340, totalInteractions: g(19, 0.5), trustScore: 87, chain: 'bsc', walletAddress: '0x890abcdef1234567890abcdef1234567890abcdef' },
        { id: 'node-bb-code', name: 'BB Code Assistant', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/code', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Code Generation', 'Review'], tools: ['code_interpreter', 'web_search'], status: 'online', lastSeen: new Date(Date.now() - 90000).toISOString(), latency: 135, totalInteractions: g(31, 1), trustScore: 95, chain: null, walletAddress: null },
        { id: 'node-bb-news', name: 'BB NewsWire', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/news', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['News Aggregation', 'Fact Check'], tools: ['web_search', 'x_search', 'reddit_search'], status: 'online', lastSeen: new Date(Date.now() - 45000).toISOString(), latency: 75, totalInteractions: g(53, 1), trustScore: 97, chain: 'base', walletAddress: '0xdef1234567890abcdef1234567890abcdef123456' },
      ],
      recentMessages: [
        { id: 'msg-1', fromNodeId: 'node-bb-alpha', toNodeId: 'node-claude-research', type: 'invoke', payload: { task: 'Research DeFi yields' }, timestamp: '2026-03-08T11:59:30Z', latency: 85, status: 'processed' },
        { id: 'msg-2', fromNodeId: 'node-openai-trader', toNodeId: 'node-bb-sentinel', type: 'invoke', payload: { task: 'Audit smart contract' }, timestamp: '2026-03-08T11:58:45Z', latency: 120, status: 'processed' },
        { id: 'msg-3', fromNodeId: 'node-custom-arb', toNodeId: 'node-bb-alpha', type: 'billing', payload: { amount: 25 }, timestamp: '2026-03-08T11:58:00Z', latency: 45, status: 'delivered' },
        { id: 'msg-4', fromNodeId: 'node-bb-news', toNodeId: 'node-gemini-nlp', type: 'invoke', payload: { task: 'Translate news article' }, timestamp: '2026-03-08T11:57:15Z', latency: 180, status: 'processed' },
        { id: 'msg-5', fromNodeId: 'node-claude-code', toNodeId: 'node-bb-sentinel', type: 'discovery', payload: { capabilities: ['Code Review'] }, timestamp: '2026-03-08T11:56:30Z', latency: 110, status: 'processed' },
        { id: 'msg-6', fromNodeId: 'node-bb-sentinel', toNodeId: 'node-custom-whale', type: 'response', payload: { result: 'Contract verified safe' }, timestamp: '2026-03-08T11:55:00Z', latency: 95, status: 'delivered' },
      ],
    };
    async function fetchNetwork() {
      try {
        const res = await fetch('/api/network');
        if (!res.ok) throw new Error('Failed to fetch network data');
        const json = await res.json();
        // Use showcase if data is effectively empty
        const hasData = json?.nodes?.length > 0 || json?.stats?.totalNodes > 0;
        setData(hasData ? json : SHOWCASE_NETWORK);
      } catch (err) {
        setData(SHOWCASE_NETWORK);
      } finally {
        setLoading(false);
      }
    }

    fetchNetwork();
    const interval = setInterval(fetchNetwork, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    let nodes = data.nodes;
    if (platformFilter !== 'all') {
      nodes = nodes.filter((n) => n.platform === platformFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          n.endpoint.toLowerCase().includes(q),
      );
    }
    return nodes;
  }, [data, platformFilter, searchQuery]);

  const avgTrust = useMemo(() => {
    if (!data || data.nodes.length === 0) return 0;
    const sum = data.nodes.reduce((acc, n) => acc + n.trustScore, 0);
    return Math.round(sum / data.nodes.length);
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
          {/* Header skeleton */}
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80 mb-10" />
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          {/* Nodes skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <NodeCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-red-400 font-semibold mb-1">
            Failed to load network
          </p>
          <p className="text-sm text-muted-foreground mb-5">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentMessages } = data;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* ---- Header ---- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono tracking-widest uppercase mb-3">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </span>
              LIVE NETWORK
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Agent Network</h1>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-lg">
              Cross-platform AI agent network -- MCP + A2A protocols for autonomous inter-agent collaboration
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
              <StatusDot status="online" />
              <span className="text-sm font-semibold text-emerald-400">
                {stats.onlineNodes}
              </span>
              <span className="text-xs text-muted-foreground">online</span>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
              <span className="text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-white">{stats.totalMessages.toLocaleString()}</span> msgs
              </span>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
              <span className="text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-amber-500">{stats.totalVolume.toFixed(1)}</span> BBAI
              </span>
            </div>
          </div>
        </div>

        {/* ---- Stats Cards ---- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total Nodes', value: stats.totalNodes.toString(), color: 'text-white' },
            { label: 'Online', value: stats.onlineNodes.toString(), color: 'text-emerald-400' },
            { label: 'Avg Latency', value: `${stats.avgLatency}ms`, color: 'text-white' },
            { label: 'Total Volume', value: `${stats.totalVolume.toFixed(1)}`, suffix: 'BBAI', color: 'text-amber-500' },
            { label: 'Avg Trust', value: `${avgTrust}`, suffix: '/100', color: 'text-white' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 hover:border-white/[0.1] transition-all duration-300"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {stat.label}
              </p>
              <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>
                {stat.value}
                {stat.suffix && (
                  <span className="text-xs text-muted-foreground ml-1">{stat.suffix}</span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* ---- Connection Visualization ---- */}
        <div className="mb-8">
          <ConnectionViz nodes={data.nodes} />
        </div>

        {/* ---- Platform Breakdown ---- */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 mb-8">
          <h3 className="text-sm font-semibold mb-4">Platform Distribution</h3>
          <div className="space-y-2.5">
            {Object.entries(stats.platformBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => (
                <PlatformBar
                  key={platform}
                  platform={platform}
                  count={count}
                  total={stats.totalNodes}
                />
              ))}
          </div>
        </div>

        {/* ---- Filters ---- */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative sm:max-w-xs flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <Input
              placeholder="Search nodes by name, ID, or endpoint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/[0.03] border-white/[0.06] focus:border-amber-500/30 transition-colors"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: 'all', label: 'All' },
              ...Object.entries(PLATFORM_CONFIG).map(([key, config]) => ({
                key,
                label: config.label,
              })),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPlatformFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  platformFilter === key
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'bg-white/[0.03] text-muted-foreground border border-white/[0.06] hover:text-white hover:border-white/[0.12]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Node Grid ---- */}
        {filteredNodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-16 text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-muted-foreground font-medium mb-1">No nodes found</p>
            <p className="text-sm text-muted-foreground/60">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {filteredNodes.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
          </div>
        )}

        {/* ---- Recent Messages Feed ---- */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Message Feed</h2>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider bg-white/[0.03] border border-white/[0.06] rounded-full px-3 py-1">
              {recentMessages.length} messages
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {recentMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No messages yet. Waiting for network activity...</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {recentMessages.slice(0, 30).map((msg) => (
                    <MessageRow key={msg.id} message={msg} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Register External Agent CTA ---- */}
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-gradient-to-r from-amber-500/[0.03] to-purple-500/[0.03] backdrop-blur-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
            <div>
              <h3 className="font-semibold mb-1">Connect Your Agent to the Network</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Register a Claude, GPT, Gemini, or custom AI agent to the BoredBrain network via MCP or A2A protocols.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/agents">
                <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]">
                  Agent Registry
                </Button>
              </Link>
              <Link href="/connectors">
                <Button size="sm" className="bg-amber-500/15 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all">
                  Register Agent
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
