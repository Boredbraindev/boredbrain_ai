'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  tools: string[];
  pricePerQuery: string;
  nftTokenId: number | null;
  chainId: number | null;
  txHash: string | null;
  totalExecutions: number;
  totalRevenue: string;
  rating: number;
  status: string;
  createdAt: string;
}

// Deterministic hash from string
function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Deterministic gradient colors from name
function getGradient(name: string): [string, string] {
  const gradients: [string, string][] = [
    ['#f59e0b', '#d97706'],
    ['#8b5cf6', '#7c3aed'],
    ['#06b6d4', '#0891b2'],
    ['#ec4899', '#db2777'],
    ['#10b981', '#059669'],
    ['#f97316', '#ea580c'],
    ['#6366f1', '#4f46e5'],
    ['#14b8a6', '#0d9488'],
  ];
  return gradients[hashStr(name) % gradients.length];
}

// Generate deterministic weekly chart data from agent name
function getWeeklyData(name: string): number[] {
  const h = hashStr(name);
  return Array.from({ length: 7 }, (_, i) => {
    const seed = hashStr(name + i.toString() + 'day');
    return 20 + (seed % 80);
  });
}

// Generate deterministic mock reviews from agent ID
function getMockReviews(agentId: string) {
  const reviewers = [
    { name: 'Alex K.', avatar: 'AK' },
    { name: 'Sarah M.', avatar: 'SM' },
    { name: 'David L.', avatar: 'DL' },
    { name: 'Jenny W.', avatar: 'JW' },
  ];
  const comments = [
    'Incredibly fast and accurate. This agent saved me hours of manual work. The response quality is consistently high across different query types.',
    'Great value for the price. I\'ve been using this agent daily for the past month and it handles complex queries with ease. Highly recommended.',
    'Solid performance overall. The tool integration is seamless and results are reliable. Would love to see even more capabilities added.',
    'One of the best agents on the platform. The accuracy is impressive and the response time is blazing fast. Worth every USDT.',
  ];
  const ratings = [5, 4.5, 4, 5];
  const daysAgo = [2, 5, 12, 21];

  return reviewers.map((r, i) => ({
    ...r,
    comment: comments[(hashStr(agentId) + i) % comments.length],
    rating: ratings[(hashStr(agentId) + i) % ratings.length],
    daysAgo: daysAgo[i],
  }));
}

// Similar agents mock data
const similarAgents = [
  { id: 'similar-1', name: 'DataForge AI', description: 'Advanced data analysis and visualization agent', price: '2.5', rating: 4.7, executions: 8420 },
  { id: 'similar-2', name: 'CodePilot Pro', description: 'Expert code review and generation assistant', price: '3.0', rating: 4.9, executions: 12350 },
  { id: 'similar-3', name: 'MarketSense', description: 'Real-time market analysis and trading signals', price: '5.0', rating: 4.5, executions: 6780 },
];

// Star rating component
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'text-lg' : 'text-xs';
  return (
    <div className={`flex items-center gap-0.5 ${sizeClass}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= Math.round(rating) ? 'text-amber-400' : 'text-white/10'}>
          &#9733;
        </span>
      ))}
    </div>
  );
}

// Tool icon mapping
function getToolIcon(tool: string): string {
  const icons: Record<string, string> = {
    'web-search': '\u{1F50D}',
    'code-interpreter': '\u{1F4BB}',
    'file-reader': '\u{1F4C4}',
    'api-caller': '\u{1F517}',
    'data-analysis': '\u{1F4CA}',
    'image-gen': '\u{1F3A8}',
    'calculator': '\u{1F522}',
    'translator': '\u{1F30D}',
  };
  return icons[tool.toLowerCase()] || '\u{2699}\u{FE0F}';
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const router = useRouter();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Redirect known sub-routes that shouldn't be caught by [agentId]
  useEffect(() => {
    const redirects: Record<string, string> = {
      playbooks: '/playbooks',
      prompts: '/prompts',
      integrations: '/integrations',
      marketplace: '/marketplace',
      network: '/network',
    };
    if (redirects[agentId]) {
      router.replace(redirects[agentId]);
    }
  }, [agentId, router]);

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        const data = await res.json();
        setAgent(data.agent);
      } catch (error) {
        console.error('Failed to fetch agent:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAgent();
  }, [agentId]);

  async function handleTest() {
    if (!testQuery.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery }),
      });
      const data = await res.json();
      // Sanitize error messages for user display (Bug 8)
      if (data.error || data.toolResults?.some((r: any) => !r.success)) {
        const sanitized = {
          ...data,
          error: data.error ? 'The agent encountered an issue processing your query. Please try again.' : undefined,
          toolResults: data.toolResults?.map((r: any) => ({
            ...r,
            result: !r.success ? 'Tool execution encountered an issue. Please try a different query.' : r.result,
          })),
        };
        setTestResult(sanitized);
      } else {
        setTestResult(data);
      }
    } catch (error) {
      setTestResult({ error: 'The agent is temporarily unavailable. Please try again later.' });
    } finally {
      setTesting(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          <p className="text-white/40 text-sm">Loading agent details...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto">
            <span className="text-2xl text-white/20">?</span>
          </div>
          <p className="text-white/40">Agent not found</p>
          <Link href="/agents">
            <Button variant="outline" size="sm" className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]">
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const [gradA, gradB] = getGradient(agent.name);
  const weeklyData = getWeeklyData(agent.name);
  const maxData = Math.max(...weeklyData);
  const reviews = getMockReviews(agentId);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chainName = agent.chainId === 8453 ? 'Base' : agent.chainId === 56 ? 'BSC' : agent.chainId ? `Chain ${agent.chainId}` : null;
  const explorerBase = agent.chainId === 8453 ? 'https://basescan.org' : agent.chainId === 56 ? 'https://bscscan.com' : null;

  return (
    <div className="min-h-screen bg-background">
      {/* ===================== HERO SECTION ===================== */}
      <div className="relative overflow-hidden">
        {/* Ambient background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none"
          style={{ background: `radial-gradient(ellipse, ${gradA}, transparent)` }}
        />
        <div
          className="absolute top-20 right-1/4 w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[100px] pointer-events-none"
          style={{ background: gradB }}
        />

        <div className="relative max-w-5xl mx-auto px-4 pt-8 pb-12">
          {/* Navigation */}
          <Link href="/agents">
            <button className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors group">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:-translate-x-0.5">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Marketplace
            </button>
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Agent Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-28 h-28 md:w-32 md:h-32 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-bold text-white shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${gradA}, ${gradB})`,
                  boxShadow: `0 20px 60px ${gradA}33, 0 0 0 1px ${gradA}22`,
                }}
              >
                {agent.name.charAt(0).toUpperCase()}
              </div>
              {/* Status indicator */}
              {agent.status === 'active' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-[#0a0a0b] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              )}
            </div>

            {/* Agent Info */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{agent.name}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  {agent.status === 'active' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.05] text-white/40 border border-white/[0.06]">
                      {agent.status}
                    </span>
                  )}
                  {agent.nftTokenId !== null && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.515L6 8.885L2.91 10.515L3.5 7.07L1 4.635L4.455 4.13L6 1Z" fill="currentColor" />
                      </svg>
                      NFT #{agent.nftTokenId}
                    </span>
                  )}
                  {chainName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {chainName}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-white/50 text-base md:text-lg leading-relaxed max-w-2xl">
                {agent.description || 'A powerful AI agent ready to handle your queries with precision and speed.'}
              </p>

              {/* Rating & meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <StarRating rating={agent.rating} size="lg" />
                  <span className="text-white/60 font-medium">{agent.rating?.toFixed(1) || '0.0'}</span>
                  <span className="text-white/30">({reviews.length} reviews)</span>
                </div>
                <span className="text-white/10">|</span>
                <span className="text-white/40">
                  Created {new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              {/* CTA Buttons - Hero */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  className="px-6 py-3 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Hire This Agent &mdash; {agent.pricePerQuery} USDT/query
                </button>
                <a href="#test-agent">
                  <button className="px-6 py-3 rounded-xl text-sm font-medium text-white/70 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-all">
                    Try Free Query
                  </button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* ===================== MAIN CONTENT ===================== */}
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* =================== PERFORMANCE STATS =================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Price per Query',
              value: `${agent.pricePerQuery}`,
              suffix: 'USDT',
              icon: (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-amber-400">
                  <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 5V13M7 7H10.5C11.3 7 12 7.7 12 8.5C12 9.3 11.3 10 10.5 10H7H11C11.8 10 12.5 10.7 12.5 11.5C12.5 12.3 11.8 13 11 13H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              ),
              accent: 'amber',
            },
            {
              label: 'Total Executions',
              value: agent.totalExecutions.toLocaleString(),
              suffix: '',
              icon: (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-blue-400">
                  <path d="M3 14L7 10L10 13L15 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              accent: 'blue',
            },
            {
              label: 'Total Revenue',
              value: `${parseFloat(agent.totalRevenue).toLocaleString()}`,
              suffix: 'USDT',
              icon: (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-emerald-400">
                  <path d="M9 2V16M5 6L9 2L13 6M5 12L9 16L13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              accent: 'emerald',
            },
            {
              label: 'Avg Rating',
              value: agent.rating?.toFixed(1) || '0.0',
              suffix: '/ 5.0',
              icon: (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-amber-400">
                  <path d="M9 2L11.09 6.26L15.8 6.97L12.4 10.27L13.18 14.97L9 12.77L4.82 14.97L5.6 10.27L2.2 6.97L6.91 6.26L9 2Z" fill="currentColor" />
                </svg>
              ),
              accent: 'amber',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5 transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  {stat.icon}
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl md:text-3xl font-bold text-white tracking-tight">{stat.value}</span>
                {stat.suffix && <span className="text-xs text-white/30 font-medium">{stat.suffix}</span>}
              </div>
              <div className="text-xs text-white/30 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* =================== PERFORMANCE CHART =================== */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white font-semibold text-base">Weekly Performance</h3>
              <p className="text-white/30 text-xs mt-0.5">Executions over the last 7 days</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-white/40">Executions</span>
            </div>
          </div>

          {/* Chart */}
          <div className="flex items-end justify-between gap-2 h-40">
            {weeklyData.map((val, i) => {
              const height = (val / maxData) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar">
                  <span className="text-[10px] text-white/0 group-hover/bar:text-white/50 transition-colors font-medium tabular-nums">
                    {val}
                  </span>
                  <div className="w-full relative" style={{ height: `${height}%` }}>
                    <div
                      className="absolute inset-0 rounded-lg transition-all duration-300 group-hover/bar:opacity-100 opacity-80"
                      style={{
                        background: `linear-gradient(to top, ${gradA}99, ${gradA}33)`,
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity duration-300"
                      style={{
                        boxShadow: `0 0 20px ${gradA}44`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30 font-medium">{dayLabels[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two-column layout for mid sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* =================== CAPABILITIES & TOOLS =================== */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6">
            <h3 className="text-white font-semibold text-base mb-4">Capabilities</h3>
            <div className="space-y-2.5 mb-6">
              {(agent.capabilities || []).map((cap) => (
                <div
                  key={cap}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                >
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-emerald-400">
                      <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm text-white/70">{cap}</span>
                </div>
              ))}
              {(!agent.capabilities || agent.capabilities.length === 0) && (
                <p className="text-white/30 text-sm">No capabilities listed</p>
              )}
            </div>

            <h3 className="text-white font-semibold text-base mb-3">
              Tools <span className="text-white/30 font-normal text-sm">({(agent.tools || []).length})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {(agent.tools as string[]).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-colors"
                >
                  <span className="text-sm">{getToolIcon(t)}</span>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* =================== ON-CHAIN VERIFICATION =================== */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-400">
                  <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-base">On-chain Verification</h3>
              {(agent.chainId || agent.txHash) && (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Verified
                </span>
              )}
            </div>

            <div className="space-y-3">
              {chainName && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-xs text-white/40">Network</span>
                  <span className="text-sm text-white/70 font-medium">{chainName}</span>
                </div>
              )}
              {agent.nftTokenId !== null && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-xs text-white/40">NFT Token ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/70 font-mono">#{agent.nftTokenId}</span>
                    <button
                      onClick={() => copyToClipboard(String(agent.nftTokenId), 'nft')}
                      className="text-white/20 hover:text-white/50 transition-colors"
                      title="Copy"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M10 4V3C10 2.45 9.55 2 9 2H3C2.45 2 2 2.45 2 3V9C2 9.55 2.45 10 3 10H4" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    </button>
                    {copiedField === 'nft' && <span className="text-[10px] text-emerald-400">Copied!</span>}
                  </div>
                </div>
              )}
              {agent.txHash && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-xs text-white/40">Registration TX</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/70 font-mono">{agent.txHash.slice(0, 10)}...{agent.txHash.slice(-6)}</span>
                    <button
                      onClick={() => copyToClipboard(agent.txHash!, 'tx')}
                      className="text-white/20 hover:text-white/50 transition-colors"
                      title="Copy full hash"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M10 4V3C10 2.45 9.55 2 9 2H3C2.45 2 2 2.45 2 3V9C2 9.55 2.45 10 3 10H4" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    </button>
                    {copiedField === 'tx' && <span className="text-[10px] text-emerald-400">Copied!</span>}
                    {explorerBase && (
                      <a
                        href={`${explorerBase}/tx/${agent.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/20 hover:text-blue-400 transition-colors"
                        title="View on Explorer"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M5 2H3C2.45 2 2 2.45 2 3V11C2 11.55 2.45 12 3 12H11C11.55 12 12 11.55 12 11V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          <path d="M8 2H12V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M12 2L6 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
              {!agent.chainId && !agent.txHash && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-white/20">
                      <path d="M10 2L16 5.5V14.5L10 18L4 14.5V5.5L10 2Z" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <p className="text-white/30 text-sm">Not yet verified on-chain</p>
                  <p className="text-white/20 text-xs mt-1">This agent has no on-chain registration</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =================== REVIEWS =================== */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-white font-semibold text-base">User Reviews</h3>
              <p className="text-white/30 text-xs mt-0.5">{reviews.length} reviews from verified users</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{agent.rating?.toFixed(1) || '0.0'}</span>
              <div>
                <StarRating rating={agent.rating} size="sm" />
                <p className="text-[10px] text-white/30 mt-0.5">{reviews.length} reviews</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {reviews.map((review, i) => (
              <div
                key={i}
                className="px-4 py-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white/70"
                      style={{ background: `linear-gradient(135deg, ${getGradient(review.name)[0]}66, ${getGradient(review.name)[1]}66)` }}
                    >
                      {review.avatar}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white/80">{review.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.rating} size="sm" />
                        <span className="text-[10px] text-white/20">{review.daysAgo} days ago</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400/60 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                    Verified User
                  </span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>

        {/* =================== TEST AGENT =================== */}
        <div id="test-agent" className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-400">
                <path d="M13 8L3 2V14L13 8Z" fill="currentColor" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-base">Test Agent</h3>
          </div>
          <p className="text-white/30 text-xs mb-5 ml-11">Send a free test query to see how this agent responds</p>

          <div className="flex gap-3">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Enter a test query..."
              className="flex-1 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <button
              onClick={handleTest}
              disabled={!testQuery.trim() || testing}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/10 shrink-0"
            >
              {testing ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Running...
                </span>
              ) : (
                'Execute'
              )}
            </button>
          </div>

          {testResult && (
            <div className="mt-4 rounded-xl bg-black/30 border border-white/[0.04] p-4 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Response</span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(testResult, null, 2), 'result')}
                  className="text-white/20 hover:text-white/50 transition-colors text-xs flex items-center gap-1"
                >
                  {copiedField === 'result' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono text-white/50 leading-relaxed">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* =================== CTA SECTION =================== */}
        <div className="relative rounded-2xl border border-amber-500/20 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ background: `linear-gradient(135deg, ${gradA}, transparent 60%)` }}
          />
          <div className="relative px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Ready to put this agent to work?</h3>
              <p className="text-white/40 text-sm max-w-md">
                Hire {agent.name} for just {agent.pricePerQuery} USDT per query. Join {agent.totalExecutions.toLocaleString()}+ users who already trust this agent.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button className="px-8 py-3.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]">
                Hire This Agent
              </button>
              <a href="#test-agent">
                <button className="px-6 py-3.5 rounded-xl text-sm font-medium text-white/70 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-all">
                  Try Free
                </button>
              </a>
            </div>
          </div>
        </div>

        {/* =================== SIMILAR AGENTS =================== */}
        <div>
          <h3 className="text-white font-semibold text-base mb-4">Similar Agents</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {similarAgents.map((sa) => {
              const [saGradA, saGradB] = getGradient(sa.name);
              return (
                <Link
                  key={sa.id}
                  href={`/agents/${sa.id}`}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5 transition-all duration-300 hover:border-amber-500/20 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-amber-500/[0.03]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${saGradA}, ${saGradB})` }}
                    >
                      {sa.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white/90 truncate group-hover:text-white transition-colors">{sa.name}</h4>
                      <StarRating rating={sa.rating} size="sm" />
                    </div>
                  </div>
                  <p className="text-xs text-white/40 mb-3 line-clamp-2">{sa.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-400/80 font-medium">{sa.price} USDT/query</span>
                    <span className="text-white/30">{sa.executions.toLocaleString()} runs</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
