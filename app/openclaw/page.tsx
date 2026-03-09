'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ---------------------------------------------------------------------------
// Types (mirrored from lib/openclaw for client use)
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

// ---------------------------------------------------------------------------
// Category colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  search: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  finance: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  blockchain: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  agents: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  social: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
  security: 'bg-red-500/15 text-red-400 border-red-500/25',
  defi: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
};

// ---------------------------------------------------------------------------
// Protocol Stats (mock)
// ---------------------------------------------------------------------------

const PROTOCOL_STATS = [
  { label: 'Total Skills', value: '8' },
  { label: 'Verified Agents', value: '1,832' },
  { label: 'Total Calls', value: '1.06M+' },
  { label: 'Uptime', value: '99.97%' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OpenClawPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [didVerified, setDidVerified] = useState(false);
  const [zkProof, setZkProof] = useState<ZKProof | null>(null);

  // Fetch skill manifest from API
  useEffect(() => {
    async function loadSkills() {
      try {
        const res = await fetch('/api/openclaw');
        const json = await res.json();
        if (json.success && json.manifest?.skills) {
          setSkills(json.manifest.skills);
        }
      } catch {
        // silent fail — skills stay empty
      } finally {
        setLoading(false);
      }
    }
    loadSkills();
  }, []);

  // Verify identity via API
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
      // silent fail
    } finally {
      setVerifying(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">

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
              ClawHub
            </span>{' '}
            Integration
          </h1>
          <p className="text-white/40 max-w-2xl mx-auto text-lg leading-relaxed">
            BoredBrain AI skills packaged for the decentralized ClawHub registry.
            Discover, verify, and integrate 8 agent tools via the OpenClaw protocol.
          </p>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Protocol Stats                                                   */}
        {/* --------------------------------------------------------------- */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PROTOCOL_STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl text-center p-5"
            >
              <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/30 mt-1">{stat.label}</p>
            </div>
          ))}
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
                        CATEGORY_COLORS[skill.category] ?? 'bg-white/[0.05] text-white/40 border-white/[0.08]'
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
            {/* DID Status */}
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

            {/* Verify Button */}
            {!didVerified && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-xl px-6 py-3 transition-colors"
              >
                {verifying ? 'Verifying...' : 'Verify Identity'}
              </button>
            )}

            {/* ZK Proof Display */}
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
            {/* Install */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Install via ClawHub</h3>
              <p className="text-xs text-white/30">Install the BoredBrain skill package globally</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`$ npx clawhub install boredbrain`}
              </pre>
            </div>

            {/* Discover */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Discover Skills</h3>
              <p className="text-xs text-white/30">Fetch the skill manifest from the API</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`const res = await fetch(
  'https://boredbrain.app/api/openclaw'
);
const { manifest } = await res.json();
console.log(manifest.skills);
// => 8 skills available`}
              </pre>
            </div>

            {/* Use a skill */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Use a Skill</h3>
              <p className="text-xs text-white/30">Call BoredBrain skills through the SDK</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`import { ClawHub } from '@openclaw/sdk';

const hub = new ClawHub({
  did: 'did:iden3:polygon:main:...'
});

const bb = hub.use('@boredbrain/mcp-skills');
const data = await bb.call('crypto_data', {
  coin: 'bitcoin', currency: 'USD'
});`}
              </pre>
            </div>

            {/* Verify identity */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Verify Agent Identity</h3>
              <p className="text-xs text-white/30">Get an iden3 ZK proof for your agent</p>
              <pre className="bg-black/40 rounded-xl p-4 text-xs text-amber-400/80 font-mono overflow-x-auto border border-white/[0.04]">
{`const res = await fetch(
  'https://boredbrain.app/api/openclaw/verify',
  {
    method: 'POST',
    body: JSON.stringify({
      address: '0x742d35Cc...'
    })
  }
);
const { verified, proof } = await res.json();`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
