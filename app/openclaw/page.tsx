'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillSchema {
  type: string;
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  protocol: string;
  category: string;
  inputSchema: SkillSchema;
  outputSchema: SkillSchema;
}

interface ZKProof {
  proofId: string;
  protocol: string;
  circuitId: string;
  proof: { piA: string[]; piB: string[][]; piC: string[] };
  publicSignals: string[];
  verifiedAt: string;
  expiresAt: string;
}

interface FleetStats {
  total: number;
  active: number;
  fleetCount: number;
  totalCalls: number;
  totalEarned: number;
  avgRating: number;
}

interface CategoryCount {
  specialization: string;
  count: number;
}

interface DiscoveryAgent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  specialization: string;
  pricing: { averageCostPerQuery: number; currency: string };
  status: 'online' | 'offline';
  rating?: number;
  totalCalls?: number;
}

// ---------------------------------------------------------------------------
// Category colors & icons
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  search: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  finance: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  blockchain: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  agents: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  social: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
  security: 'bg-red-500/15 text-red-400 border-red-500/25',
  defi: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  trading: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  research: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  nft: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  news: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  development: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
  onchain: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  market: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  media: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25',
  gaming: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  general: 'bg-white/[0.05] text-white/40 border-white/[0.08]',
};

const SPEC_LABELS: Record<string, string> = {
  defi: 'DeFi',
  trading: 'Trading',
  research: 'Research',
  security: 'Security',
  nft: 'NFT',
  social: 'Social',
  news: 'News',
  development: 'Dev',
  onchain: 'On-Chain',
  market: 'Market',
  media: 'Media',
  finance: 'Finance',
  gaming: 'Gaming',
  general: 'General',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OpenClawPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [didVerified, setDidVerified] = useState(false);
  const [zkProof, setZkProof] = useState<ZKProof | null>(null);

  // Fleet state
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [agents, setAgents] = useState<DiscoveryAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [agentPage, setAgentPage] = useState(0);
  const AGENTS_PER_PAGE = 24;

  // Fetch skill manifest
  useEffect(() => {
    async function loadSkills() {
      try {
        const res = await fetch('/api/openclaw');
        const json = await res.json();
        if (json.success && json.manifest?.skills) {
          setSkills(json.manifest.skills);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    loadSkills();
  }, []);

  // Fetch fleet stats
  useEffect(() => {
    async function loadFleetStats() {
      try {
        const res = await fetch('/api/agents/seed');
        const json = await res.json();
        if (json.success) {
          setFleetStats(json.data.stats);
          setCategories(json.data.categories || []);
        }
      } catch {
        // silent
      }
    }
    loadFleetStats();
  }, [seedResult]);

  // Fetch agents (with optional filter)
  useEffect(() => {
    async function loadAgents() {
      setAgentsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: '500',
          ...(selectedSpec ? { specialization: selectedSpec } : {}),
        });
        const res = await fetch(`/api/agents/discover?${params}`);
        const json = await res.json();
        if (json.agents) {
          setAgents(json.agents);
        }
      } catch {
        // silent
      } finally {
        setAgentsLoading(false);
      }
    }
    loadAgents();
    setAgentPage(0);
  }, [selectedSpec, seedResult]);

  // Seed fleet
  const handleSeed = useCallback(async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch('/api/agents/seed', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSeedResult(
          `Seeded ${json.data.inserted} agents (${json.data.skipped} skipped). Total: ${json.data.totalAgents}`,
        );
      } else {
        setSeedResult(`Error: ${json.error}`);
      }
    } catch {
      setSeedResult('Failed to seed agents');
    } finally {
      setSeeding(false);
    }
  }, []);

  // Verify identity
  const handleVerify = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/openclaw/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68',
        }),
      });
      const json = await res.json();
      if (json.success && json.verified) {
        setDidVerified(true);
        setZkProof(json.proof);
      }
    } catch {
      // silent
    } finally {
      setVerifying(false);
    }
  }, []);

  // Paginated agents
  const paginatedAgents = agents.slice(
    agentPage * AGENTS_PER_PAGE,
    (agentPage + 1) * AGENTS_PER_PAGE,
  );
  const totalPages = Math.ceil(agents.length / AGENTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">

        {/* --------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* --------------------------------------------------------------- */}
        <section className="text-center space-y-5">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-amber-500/30 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                <Image
                  src="/ape-avatar.png"
                  alt="BoredBrain AI"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-xs text-amber-400 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            openclaw-v1 protocol
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              OpenClaw
            </span>{' '}
            Agent Fleet
          </h1>
          <p className="text-white/40 max-w-2xl mx-auto text-lg leading-relaxed">
            {fleetStats
              ? `${fleetStats.total} agents operating across ${categories.length} specializations. ${fleetStats.totalCalls.toLocaleString()} total calls processed.`
              : 'Discover, deploy, and manage hundreds of AI agents on the BoredBrain platform.'}
          </p>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Fleet Stats                                                      */}
        {/* --------------------------------------------------------------- */}
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Agents', value: fleetStats?.total ?? agents.length ?? '—' },
            { label: 'Active', value: fleetStats?.active ?? '—' },
            { label: 'Fleet Agents', value: fleetStats?.fleetCount ?? '—' },
            { label: 'Total Calls', value: fleetStats ? fleetStats.totalCalls.toLocaleString() : '—' },
            { label: 'Revenue (BBAI)', value: fleetStats ? `${(fleetStats.totalEarned / 1000).toFixed(1)}K` : '—' },
            { label: 'Avg Rating', value: fleetStats ? `${fleetStats.avgRating}/5` : '—' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl text-center p-5"
            >
              <p className="text-2xl md:text-3xl font-bold text-white">
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>
              <p className="text-xs text-white/30 mt-1">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Seed Fleet Button                                                */}
        {/* --------------------------------------------------------------- */}
        <section className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-xl px-6 py-3 transition-all"
          >
            {seeding ? 'Seeding Agents...' : 'Seed Agent Fleet'}
          </button>
          {seedResult && (
            <p className="text-sm text-emerald-400/80">{seedResult}</p>
          )}
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Category Filter                                                  */}
        {/* --------------------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Agent Fleet</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSpec(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                !selectedSpec
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-white/[0.03] text-white/40 border-white/[0.08] hover:bg-white/[0.06]'
              }`}
            >
              All ({agents.length || '...'})
            </button>
            {categories
              .sort((a, b) => b.count - a.count)
              .map((cat) => (
                <button
                  key={cat.specialization}
                  onClick={() =>
                    setSelectedSpec(
                      selectedSpec === cat.specialization
                        ? null
                        : cat.specialization,
                    )
                  }
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    selectedSpec === cat.specialization
                      ? CATEGORY_COLORS[cat.specialization] ??
                        'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-white/[0.03] text-white/40 border-white/[0.08] hover:bg-white/[0.06]'
                  }`}
                >
                  {SPEC_LABELS[cat.specialization] ?? cat.specialization} ({cat.count})
                </button>
              ))}
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Agent Grid                                                       */}
        {/* --------------------------------------------------------------- */}
        <section>
          {agentsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 animate-pulse"
                >
                  <div className="h-4 bg-white/[0.06] rounded w-2/3 mb-3" />
                  <div className="h-3 bg-white/[0.04] rounded w-full mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <p className="text-white/30 text-lg">No agents deployed yet</p>
              <p className="text-white/20 text-sm">
                Click &quot;Seed Agent Fleet&quot; to deploy 200+ agents
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/5 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-white/90 group-hover:text-amber-400 transition-colors truncate">
                          {agent.name}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${
                          CATEGORY_COLORS[agent.specialization] ??
                          CATEGORY_COLORS.general
                        }`}
                      >
                        {SPEC_LABELS[agent.specialization] ??
                          agent.specialization}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed line-clamp-2 mb-3">
                      {agent.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-white/25">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {agent.pricing.averageCostPerQuery} BBAI
                        </span>
                        {agent.rating !== undefined && agent.rating > 0 && (
                          <>
                            <span className="w-px h-3 bg-white/10" />
                            <span className="text-amber-400/60">
                              {agent.rating.toFixed(1)}
                            </span>
                          </>
                        )}
                      </div>
                      {agent.totalCalls !== undefined && agent.totalCalls > 0 && (
                        <span>{agent.totalCalls.toLocaleString()} calls</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {agent.tools.slice(0, 3).map((tool) => (
                        <span
                          key={tool}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/25 font-mono"
                        >
                          {tool}
                        </span>
                      ))}
                      {agent.tools.length > 3 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/20">
                          +{agent.tools.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setAgentPage((p) => Math.max(0, p - 1))}
                    disabled={agentPage === 0}
                    className="px-4 py-2 text-sm rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-white/30">
                    Page {agentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setAgentPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={agentPage >= totalPages - 1}
                    className="px-4 py-2 text-sm rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Skill Registry                                                   */}
        {/* --------------------------------------------------------------- */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Skill Registry</h2>
            <p className="text-sm text-white/30 mt-1">
              {skills.length} skills published on ClawHub
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 animate-pulse"
                >
                  <div className="h-4 bg-white/[0.06] rounded w-2/3 mb-3" />
                  <div className="h-3 bg-white/[0.04] rounded w-full mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/5 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white/90 group-hover:text-amber-400 transition-colors">
                      {skill.name}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        CATEGORY_COLORS[skill.category] ??
                        'bg-white/[0.05] text-white/40 border-white/[0.08]'
                      }`}
                    >
                      {skill.category}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed line-clamp-2 mb-3">
                    {skill.description}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-white/25">
                    <span className="font-mono">v{skill.version}</span>
                    <span className="w-px h-3 bg-white/10" />
                    <span className="font-mono">{skill.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* --------------------------------------------------------------- */}
        {/* iden3 Identity Card                                              */}
        {/* --------------------------------------------------------------- */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white">iden3 Identity</h2>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex-shrink-0 overflow-hidden">
                <Image
                  src="/ape-avatar.png"
                  alt="BoredBrain AI"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">BoredBrain AI</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      didVerified
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                        : 'bg-white/[0.05] text-white/30 border-white/[0.08]'
                    }`}
                  >
                    {didVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <p className="text-xs text-white/30 font-mono mt-1 truncate">
                  did:iden3:polygon:main:2qHjMxJBKbruN3YS8pPmeXZ7qLCCcqay7xEp7E6YGF
                </p>
              </div>
            </div>

            {!didVerified && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-xl px-6 py-3 transition-colors"
              >
                {verifying ? 'Verifying...' : 'Verify Identity'}
              </button>
            )}

            {zkProof && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  ZK Proof
                </h4>
                <div className="bg-black/40 rounded-xl p-4 border border-white/[0.04] space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-white/30">Proof ID</span>
                    <span className="text-amber-400/80 truncate ml-4 max-w-[300px]">{zkProof.proofId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">Circuit</span>
                    <span className="text-amber-400/80">{zkProof.circuitId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">Protocol</span>
                    <span className="text-amber-400/80">{zkProof.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">Verified At</span>
                    <span className="text-amber-400/80">{new Date(zkProof.verifiedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">Expires At</span>
                    <span className="text-amber-400/80">{new Date(zkProof.expiresAt).toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-white/[0.06]">
                    <p className="text-white/30 mb-1">piA</p>
                    <p className="text-amber-400/60 break-all text-[10px]">{zkProof.proof.piA[0]}</p>
                  </div>
                  <div>
                    <p className="text-white/30 mb-1">Public Signals ({zkProof.publicSignals.length})</p>
                    <p className="text-amber-400/60 break-all text-[10px]">{zkProof.publicSignals[0]}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Integration Guide                                                */}
        {/* --------------------------------------------------------------- */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Integration Guide</h2>
          <p className="text-sm text-white/30">
            Use BoredBrain skills from any OpenClaw-compatible agent platform.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Install via ClawHub</h3>
              <p className="text-xs text-white/30">Install the BoredBrain skill package globally</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`$ npx clawhub install boredbrain`}
              </pre>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Discover Agents</h3>
              <p className="text-xs text-white/30">Fetch the agent fleet from the discovery API</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`const res = await fetch(
  'https://boredbrain.app/api/agents/discover'
);
const { totalAgents, agents } = await res.json();
// => ${agents.length || '200+'}  agents available`}
              </pre>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Invoke an Agent</h3>
              <p className="text-xs text-white/30">Call any agent through the A2A protocol</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`const res = await fetch(
  'https://boredbrain.app/api/agents/{id}/invoke',
  {
    method: 'POST',
    body: JSON.stringify({
      query: 'Analyze BTC DeFi yield',
      tools: ['coin_data', 'defi_yield']
    })
  }
);
const { result, cost } = await res.json();`}
              </pre>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Seed Fleet (Admin)</h3>
              <p className="text-xs text-white/30">Deploy hundreds of agents with one call</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`const res = await fetch(
  'https://boredbrain.app/api/agents/seed',
  { method: 'POST' }
);
const { data } = await res.json();
// => "Seeded 200+ agents across 13 categories"`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
