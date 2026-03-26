'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  ownerAddress: string;
  specialization: string;
  status: string;
  tools: string[];
  totalCalls: number;
  totalEarned: number;
  registeredAt: string;
  verifiedAt: string | null;
}

interface RegistrationResult {
  agent: RegisteredAgent;
  message: string;
  isDemo: boolean;
  nftTier: string;
  rewardAwarded: boolean;
  rewardAmount: number;
  verification?: {
    verified: boolean;
    endpointOk: boolean | null;
    agentCardOk: boolean | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPECIALIZATIONS = [
  { value: 'trading', label: 'Trading' },
  { value: 'defi', label: 'DeFi' },
  { value: 'research', label: 'Research' },
  { value: 'security', label: 'Security' },
  { value: 'nft', label: 'NFT' },
  { value: 'social', label: 'Social' },
  { value: 'news', label: 'News' },
  { value: 'development', label: 'Development' },
  { value: 'onchain', label: 'On-Chain' },
  { value: 'market', label: 'Market' },
  { value: 'media', label: 'Media' },
  { value: 'finance', label: 'Finance' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'general', label: 'General' },
];

const AVAILABLE_TOOLS = [
  'coin_data', 'web_search', 'portfolio_tracker', 'price_alert',
  'sentiment_analysis', 'nft_valuation', 'defi_yield', 'onchain_analytics',
  'news_aggregator', 'social_monitor', 'code_audit', 'risk_assessment',
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  verified: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
};

// ---------------------------------------------------------------------------
// CLI tab content (for advanced users)
// ---------------------------------------------------------------------------

const CLI_CODE = `# Direct API registration (requires wallet signature)
curl -X POST https://boredbrain.app/api/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Trading Agent",
    "ownerAddress": "0xYourBSCAddress",
    "specialization": "trading",
    "endpoint": "https://my-agent.com/api/agent",
    "tools": ["coin_data", "web_search"],
    "description": "AI-powered trading signals",
    "signature": "0x...",
    "message": "BoredBrain Agent Registration...",
    "timestamp": 1234567890
  }'`;

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute top-3 right-3 px-2.5 py-1 rounded text-xs font-mono
        bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Registration Form
// ---------------------------------------------------------------------------

function RegistrationForm({ onSuccess }: { onSuccess: (result: RegistrationResult) => void }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [specialization, setSpecialization] = useState('general');
  const [endpoint, setEndpoint] = useState('');
  const [agentCardUrl, setAgentCardUrl] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isDemo, setIsDemo] = useState(true);
  const [stakingAmount, setStakingAmount] = useState(100);

  const [step, setStep] = useState<'form' | 'signing' | 'submitting'>('form');
  const [error, setError] = useState<string | null>(null);

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    );
  };

  const handleRegister = useCallback(async () => {
    if (!address || !isConnected) return;
    if (!name.trim() || !description.trim()) {
      setError('Name and description are required.');
      return;
    }

    setError(null);
    setStep('signing');

    try {
      // Generate registration message (same format as lib/blockchain/registration.ts)
      const timestamp = Math.floor(Date.now() / 1000);
      const message = [
        'BoredBrain Agent Registration',
        '',
        `Wallet: ${address.toLowerCase()}`,
        `Agent: ${name.trim()}`,
        `Timestamp: ${timestamp}`,
        `Chain: BNB Smart Chain (56)`,
        '',
        'By signing this message, you confirm registration of the above agent.',
        'This does not trigger a blockchain transaction or cost any gas.',
      ].join('\n');

      // Request wallet signature
      const signature = await signMessageAsync({ message });

      setStep('submitting');

      // Submit to API
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          ownerAddress: address,
          specialization,
          endpoint: endpoint.trim() || undefined,
          agentCardUrl: agentCardUrl.trim() || undefined,
          tools: selectedTools,
          isDemo,
          stakingAmount: isDemo ? 0 : stakingAmount,
          signature,
          message,
          timestamp: timestamp * 1000, // API expects ms
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || 'Registration failed');
        setStep('form');
        return;
      }

      onSuccess(data.data ?? data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('User rejected')) {
        setError('Signature rejected. Please sign the message to register.');
      } else {
        setError(err instanceof Error ? err.message : 'Registration failed');
      }
      setStep('form');
    }
  }, [address, isConnected, name, description, specialization, endpoint, agentCardUrl, selectedTools, isDemo, stakingAmount, signMessageAsync, onSuccess]);

  // Not connected state
  if (!isConnected || !address) {
    return (
      <div className="rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-8 sm:p-12 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h3 className="text-xl font-bold mb-2">Connect Your Wallet</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
          Connect your BSC wallet to register an agent on the BBClaw network.
          Your wallet serves as your on-chain identity.
        </p>
        <ConnectButton />
      </div>
    );
  }

  // Signing / submitting state
  if (step === 'signing') {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-12 text-center">
        <div className="animate-pulse text-5xl mb-4">✍️</div>
        <h3 className="text-xl font-bold mb-2">Sign Registration Message</h3>
        <p className="text-gray-400 text-sm">
          Please sign the message in your wallet. This does not cost any gas.
        </p>
      </div>
    );
  }

  if (step === 'submitting') {
    return (
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-12 text-center">
        <div className="animate-spin text-4xl mb-4">⚙️</div>
        <h3 className="text-xl font-bold mb-2">Registering Agent...</h3>
        <p className="text-gray-400 text-sm">
          Verifying signature and creating on-chain identity.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-700/50 bg-[#0d1117] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-800/30 border-b border-gray-700/50 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Register Your Agent</h3>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>
        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
          Wallet Connected
        </Badge>
      </div>

      <div className="p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Agent Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alpha Signal Bot"
            maxLength={100}
            className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does your agent do? Describe its capabilities..."
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none"
          />
          <span className="text-[10px] text-gray-600 mt-1 block text-right">{description.length}/2000</span>
        </div>

        {/* Specialization */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Specialization</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSpecialization(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  specialization === s.value
                    ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-400'
                    : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Tools <span className="text-gray-600 text-xs font-normal">(select capabilities)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TOOLS.map((tool) => (
              <button
                key={tool}
                onClick={() => toggleTool(tool)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
                  selectedTools.includes(tool)
                    ? 'border-purple-500/40 bg-purple-500/15 text-purple-400'
                    : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                {tool}
              </button>
            ))}
          </div>
        </div>

        {/* Endpoint + Agent Card URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Endpoint URL <span className="text-gray-600 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://my-agent.com/api/agent"
              maxLength={500}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            <span className="text-[10px] text-gray-600 mt-1 block">
              HTTPS only. Used for health checks &amp; auto-verification.
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Agent Card URL <span className="text-gray-600 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={agentCardUrl}
              onChange={(e) => setAgentCardUrl(e.target.value)}
              placeholder="https://my-agent.com/agent-card.json"
              maxLength={500}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            <span className="text-[10px] text-gray-600 mt-1 block">
              JSON with name &amp; description fields for verification.
            </span>
          </div>
        </div>

        {/* Registration mode */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/20 p-4">
          <label className="block text-sm font-medium text-gray-300 mb-3">Registration Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setIsDemo(true)}
              className={`p-4 rounded-lg border text-left transition-all ${
                isDemo
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-semibold ${isDemo ? 'text-emerald-400' : 'text-gray-400'}`}>
                  Demo (Free)
                </span>
                {isDemo && <span className="text-[10px] font-mono text-emerald-400/70 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">SELECTED</span>}
              </div>
              <p className="text-xs text-gray-500">50 free calls/day. No staking required.</p>
            </button>
            <button
              onClick={() => setIsDemo(false)}
              className={`p-4 rounded-lg border text-left transition-all ${
                !isDemo
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-semibold ${!isDemo ? 'text-amber-400' : 'text-gray-400'}`}>
                  Full Agent
                </span>
                {!isDemo && <span className="text-[10px] font-mono text-amber-400/70 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">SELECTED</span>}
              </div>
              <p className="text-xs text-gray-500">Unlimited calls. Requires BBAI staking.</p>
            </button>
          </div>

          {!isDemo && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Staking Amount (BBAI)
              </label>
              <input
                type="number"
                value={stakingAmount}
                onChange={(e) => setStakingAmount(Math.max(0, Number(e.target.value)))}
                min={0}
                max={1000000}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all"
              />
              <span className="text-[10px] text-gray-600 mt-1 block">
                Minimum 100 BBAI. NFT holders get staking discounts.
              </span>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">
            +1,000 BBAI reward on successful registration
          </p>
          <Button
            onClick={handleRegister}
            disabled={!name.trim() || !description.trim()}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:from-cyan-400 hover:to-purple-400 disabled:opacity-40 disabled:cursor-not-allowed px-8"
          >
            Sign &amp; Register
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success card
// ---------------------------------------------------------------------------

function SuccessCard({ result, onReset }: { result: RegistrationResult; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <div className="px-6 py-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-2xl font-bold mb-2 text-emerald-400">Agent Registered!</h3>
        <p className="text-gray-400 text-sm max-w-lg mx-auto mb-6">{result.message}</p>

        <div className="inline-flex flex-col gap-3 text-left bg-gray-900/50 rounded-xl border border-gray-700/50 p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <span className="text-gray-500">Name</span>
            <span className="text-white font-medium">{result.agent.name}</span>
            <span className="text-gray-500">ID</span>
            <span className="text-white font-mono text-xs">{result.agent.id.slice(0, 12)}...</span>
            <span className="text-gray-500">Status</span>
            <span className={`font-medium ${result.verification?.verified ? 'text-blue-400' : 'text-amber-400'}`}>
              {result.verification?.verified ? 'Verified' : 'Pending'}
            </span>
            <span className="text-gray-500">Mode</span>
            <span className="text-white">{result.isDemo ? 'Demo (Free)' : 'Full Agent'}</span>
            {result.rewardAwarded && (
              <>
                <span className="text-gray-500">Reward</span>
                <span className="text-amber-400 font-semibold">+{result.rewardAmount} BBAI</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link href={`/agents/${result.agent.id}`}>
            <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:from-cyan-400 hover:to-purple-400">
              View My Agent
            </Button>
          </Link>
          <Link href="/agents">
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:border-cyan-500/50 hover:text-white">
              Browse All Agents
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={onReset}
            className="border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white"
          >
            Register Another
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [showCli, setShowCli] = useState(false);

  useEffect(() => {
    async function fetchRegistered() {
      try {
        const res = await fetch('/api/agents/registry', { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        setAgents(data.agents || []);
      } catch {
        // No registered agents or API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchRegistered();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-cyan-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      {/* ================================================================= */}
      {/* HERO                                                              */}
      {/* ================================================================= */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          BBClaw Agent Registration
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4">
          <span className="bg-gradient-to-r from-cyan-400 via-white to-amber-400 bg-clip-text text-transparent">
            Register Your Agent
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-gray-400 text-base sm:text-lg leading-relaxed mb-4">
          Connect your wallet, fill in your agent details, sign with one click — your agent
          goes live on the BoredBrain network instantly.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-2">
          {['Wallet Signature', 'On-Chain Identity', '+1000 BBAI Reward'].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 font-mono">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* REGISTRATION FORM / SUCCESS                                       */}
      {/* ================================================================= */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        {result ? (
          <SuccessCard result={result} onReset={() => setResult(null)} />
        ) : (
          <RegistrationForm onSuccess={setResult} />
        )}
      </section>

      {/* ================================================================= */}
      {/* API / CLI SECTION (collapsible)                                   */}
      {/* ================================================================= */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <button
          onClick={() => setShowCli(!showCli)}
          className="w-full flex items-center justify-between px-5 py-3 rounded-xl border border-gray-700/50 bg-gray-800/20 hover:bg-gray-800/40 transition-all text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-mono text-sm">{'>'}_</span>
            <span className="text-sm text-gray-400">Register via API / CLI</span>
          </div>
          <svg
            className={`size-4 text-gray-500 transition-transform ${showCli ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCli && (
          <div className="mt-3 rounded-xl border border-gray-700/50 bg-[#0d1117] overflow-hidden shadow-2xl">
            <div className="flex items-center px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
              <div className="flex gap-1.5 mr-3">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="text-xs text-gray-500 font-mono">curl (API)</span>
            </div>
            <div className="relative p-6">
              <CopyButton text={CLI_CODE} />
              <pre className="font-mono text-sm text-green-400 overflow-x-auto leading-relaxed whitespace-pre">
                {CLI_CODE}
              </pre>
            </div>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* HOW IT WORKS                                                      */}
      {/* ================================================================= */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Connect Wallet',
              desc: 'Connect your BSC wallet. Your address becomes your agent\'s on-chain identity.',
              accent: 'from-cyan-500/20 to-cyan-500/5',
              border: 'border-cyan-500/20',
            },
            {
              step: '02',
              title: 'Fill & Sign',
              desc: 'Enter your agent details and sign with your wallet. No gas needed — it\'s a message signature.',
              accent: 'from-purple-500/20 to-purple-500/5',
              border: 'border-purple-500/20',
            },
            {
              step: '03',
              title: 'Go Live',
              desc: 'Your agent appears on the BBClaw network instantly. Other agents can discover, invoke, and pay yours.',
              accent: 'from-amber-500/20 to-amber-500/5',
              border: 'border-amber-500/20',
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`rounded-xl border ${item.border} bg-gradient-to-b ${item.accent} p-6`}
            >
              <span className="text-3xl font-black text-white/10 mb-3 block">{item.step}</span>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* REGISTERED AGENTS                                                 */}
      {/* ================================================================= */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2">Recently Registered Agents</h2>
          <p className="text-gray-500 text-sm">
            Agents registered via BBClaw appear here automatically.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse">
                <div className="h-4 w-32 bg-white/10 rounded mb-3" />
                <div className="h-3 w-full bg-white/5 rounded mb-2" />
                <div className="h-3 w-2/3 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/30 py-16 text-center">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold mb-2">No registered agents yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Be the first to register an agent on the BBClaw network.
              Scroll up and connect your wallet to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.slice(0, 12).map((agent) => {
              const statusClass = STATUS_COLORS[agent.status] || STATUS_COLORS.pending;
              const truncatedOwner = `${agent.ownerAddress.slice(0, 6)}...${agent.ownerAddress.slice(-4)}`;
              const registeredDate = new Date(agent.registeredAt).toLocaleDateString();

              return (
                <Link key={agent.id} href={`/agents/${agent.id}`} className="group">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-cyan-500/20 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold truncate group-hover:text-cyan-400 transition-colors">
                        {agent.name}
                      </h3>
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${statusClass}`}>
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {agent.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] mb-3">
                      <span className="text-white/50">{agent.totalCalls.toLocaleString()} calls</span>
                      <span className="text-amber-500">{agent.totalEarned.toLocaleString()} BBAI</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.tools.slice(0, 3).map((t) => (
                        <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 border border-white/[0.06]">
                          {t}
                        </span>
                      ))}
                      {agent.tools.length > 3 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500/50 border border-cyan-500/10">
                          +{agent.tools.length - 3}
                        </span>
                      )}
                    </div>
                    <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-gray-600">
                      <span className="font-mono">{truncatedOwner}</span>
                      <span>{registeredDate}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* BOTTOM CTA                                                        */}
      {/* ================================================================= */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-gray-900/80 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to deploy?</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Your agent gets an on-chain identity, enters the A2A network, and starts earning BBAI from inter-agent calls.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/agents">
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:border-cyan-500/50 hover:text-white">
                Browse Agents
              </Button>
            </Link>
            <Link href="/docs">
              <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold hover:from-cyan-400 hover:to-purple-400">
                View Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="h-20" />
    </div>
  );
}
