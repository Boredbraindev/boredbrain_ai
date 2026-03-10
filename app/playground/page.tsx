'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

interface SpawnedAgent {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  model: string;
  systemPrompt: string;
  status: AgentStatus;
  taskCount: number;
  totalCost: number;
  createdAt: Date;
}

interface TaskResult {
  id: string;
  agentId: string;
  agentName: string;
  providerName: string;
  task: string;
  response: string;
  displayedResponse: string;
  tokensUsed: number;
  cost: number;
  latencyMs: number;
  timestamp: Date;
  streaming: boolean;
}

interface Provider {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pricing: string;
  pricePer1k: number;
  models: string[];
  defaultModel: string;
  speed: number; // 1-5 dot rating
  costRating: number; // 1-5 dot rating (1=cheap, 5=expensive)
  specialty: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDERS: Provider[] = [
  {
    id: 'groq',
    name: 'Groq',
    icon: '⚡',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    pricing: 'Free Tier',
    pricePer1k: 0,
    models: ['Llama 3.1 8B', 'Llama 3.1 70B', 'Mixtral 8x7B'],
    defaultModel: 'Llama 3.1 8B',
    speed: 5,
    costRating: 1,
    specialty: 'Ultra-low latency inference',
    description: 'Custom LPU hardware — fastest inference available (~250 tok/s)',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔬',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    pricing: '$0.00014/1K',
    pricePer1k: 0.00014,
    models: ['DeepSeek-V3', 'DeepSeek-R1', 'DeepSeek-Coder'],
    defaultModel: 'DeepSeek-V3',
    speed: 3,
    costRating: 1,
    specialty: 'Deep reasoning & code',
    description: 'State-of-the-art reasoning at minimal cost (~80 tok/s)',
  },
  {
    id: 'together',
    name: 'Together.ai',
    icon: '🤝',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    pricing: '$0.0002/1K',
    pricePer1k: 0.0002,
    models: ['Llama 3 8B', 'Llama 3 70B', 'CodeLlama 34B'],
    defaultModel: 'Llama 3 8B',
    speed: 4,
    costRating: 2,
    specialty: 'Open-source at scale',
    description: 'Scalable open-source model hosting (~100 tok/s)',
  },
  {
    id: 'gemini',
    name: 'Gemini Flash',
    icon: '✨',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    pricing: 'Free 15 RPM',
    pricePer1k: 0,
    models: ['Gemini 2.0 Flash', 'Gemini 2.0 Flash Lite', 'Gemini 1.5 Pro'],
    defaultModel: 'Gemini 2.0 Flash',
    speed: 4,
    costRating: 1,
    specialty: 'Multimodal & free tier',
    description: 'Google multimodal with generous free tier (~120 tok/s)',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🔀',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    pricing: 'Routing',
    pricePer1k: 0.00015,
    models: ['Multi-model', 'Auto-route', 'Cheapest'],
    defaultModel: 'Multi-model',
    speed: 3,
    costRating: 3,
    specialty: 'Intelligent model routing',
    description: 'Smart routing across 100+ models (variable speed)',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: '🏠',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    pricing: 'Free',
    pricePer1k: 0,
    models: ['Qwen2.5-3B', 'Phi-3 Mini', 'TinyLlama 1.1B'],
    defaultModel: 'Qwen2.5-3B',
    speed: 2,
    costRating: 1,
    specialty: 'Private & local execution',
    description: 'Run models locally with zero API costs (~30 tok/s)',
  },
];

const AGENT_NAMES = [
  'Nexus Prime', 'Cipher Wolf', 'Quantum Sage', 'Delta Mind',
  'Vortex Agent', 'Pulse Runner', 'Echo Sentinel', 'Flux Oracle',
  'Helix Scout', 'Nova Synth', 'Drift Walker', 'Blaze Cortex',
  'Storm Weaver', 'Neon Pathfinder', 'Apex Thinker', 'Ion Spark',
];

const MOCK_RESPONSES: string[] = [
  "Based on my analysis of current DeFi protocols, TVL across the top 10 chains has increased 23% this quarter. Ethereum L2s (Arbitrum, Optimism, Base) are capturing the majority of new capital inflows. Key drivers include restaking protocols like EigenLayer reaching $15B TVL and the emergence of intent-based DEX architectures.\n\nRecommendation: Focus on protocols with sustainable yield sources rather than token emission-based incentives. The market is maturing toward real yield models.",
  "Scanning on-chain data reveals significant whale accumulation patterns. Three wallets linked to early DeFi participants have accumulated 12,000 ETH in the past 48 hours through multiple DEX aggregators. The average entry price is $3,240.\n\nNotable trend: Cross-chain bridge volume has spiked 340% on Wormhole and LayerZero, suggesting institutional players are positioning across multiple ecosystems simultaneously.",
  "Current market microstructure analysis shows decreasing correlation between BTC and altcoins (rolling 30-day correlation dropped from 0.87 to 0.62). This decorrelation event historically precedes alt-season rotations.\n\nKey metrics to watch:\n- ETH/BTC ratio approaching 0.055 support\n- Stablecoin dominance declining (currently 8.2%)\n- DEX volume/CEX volume ratio at all-time high of 22%\n- Perpetual funding rates turning positive across major pairs",
  "Analysis of governance proposals across major DAOs reveals a shift toward treasury diversification. MakerDAO has allocated $600M to real-world assets, while Aave is exploring deployment on 4 new chains.\n\nMost impactful upcoming votes:\n1. Uniswap fee switch activation (est. $62M annual revenue)\n2. Arbitrum 200M ARB gaming catalyst program\n3. Lido dual governance implementation\n4. Compound treasury management overhaul",
  "Smart contract vulnerability scan complete. Detected 3 high-severity patterns in trending DeFi protocols:\n\n1. Reentrancy vector in a yield optimizer's harvest function\n2. Oracle manipulation risk in a leveraged lending market (uses single TWAP source)\n3. Unchecked external call in a cross-chain bridge adapter\n\nThe total value at risk across these protocols exceeds $180M. Recommend monitoring audit reports and avoiding concentrated positions in unaudited forks.",
  "Memecoin sector analysis: Total market cap of top 100 memecoins reached $68B, with Solana-based tokens capturing 45% of new launches. Pump.fun has facilitated 2.3M token deployments. However, only 0.4% of launched tokens maintain a market cap above $100K after 7 days.\n\nAlpha signal: Tokens with early smart money accumulation (detected via wallet clustering) show 8.2x higher survival rates. Current smart money is rotating into AI-agent narrative tokens.",
];

const SAMPLE_TASKS = [
  'Analyze the current state of DeFi lending protocols and identify yield opportunities above 5% APY with sustainable tokenomics',
  'Track whale wallet movements on Ethereum and Base chains over the past 24 hours and identify accumulation patterns',
  'Compare the top 5 liquid staking derivatives by TVL, APY, and smart contract risk assessment',
  'Evaluate the impact of recent L2 token unlocks on market dynamics and provide a 7-day price outlook',
  'Scan governance proposals across major DAOs and identify proposals that could significantly impact token prices',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCost(cost: number): string {
  if (cost === 0) return 'Free';
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** Render dot ratings (filled vs empty) */
function DotRating({ value, max = 5, color = 'bg-amber-400' }: { value: number; max?: number; color?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all ${i < value ? color : 'bg-white/10'}`}
        />
      ))}
    </span>
  );
}

const STATUS_STYLES: Record<AgentStatus, { dot: string; badge: string; label: string }> = {
  idle: { dot: 'bg-white/30', badge: 'bg-white/5 text-white/40 border-white/10', label: 'Idle' },
  running: { dot: 'bg-amber-400 animate-pulse', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Running' },
  completed: { dot: 'bg-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Completed' },
  error: { dot: 'bg-red-400', badge: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Error' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlaygroundPage() {
  // --- state ---
  const [agents, setAgents] = useState<SpawnedAgent[]>([]);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [spawnProvider, setSpawnProvider] = useState<string | null>(null);
  const [spawnModel, setSpawnModel] = useState<string>('');
  const [spawnName, setSpawnName] = useState<string>('');
  const [spawnSystemPrompt, setSpawnSystemPrompt] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'farm' | 'results' | 'orchestration'>('farm');
  const [isRunning, setIsRunning] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);
  const [totalTasksRun, setTotalTasksRun] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [now, setNow] = useState(Date.now());

  // Update clock for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      streamIntervals.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // --- derived ---
  const totalCost = agents.reduce((sum, a) => sum + a.totalCost, 0) + results.reduce((sum, r) => sum + r.cost, 0);
  const avgLatency = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length) : 0;

  // --- handlers ---
  const spawnAgent = useCallback(async (providerId?: string, modelOverride?: string, nameOverride?: string, promptOverride?: string) => {
    const pid = providerId || spawnProvider;
    if (!pid) return;
    const provider = PROVIDERS.find((p) => p.id === pid);
    if (!provider) return;

    const model = modelOverride || spawnModel || provider.defaultModel;
    const name = nameOverride || spawnName || pickRandom(AGENT_NAMES);
    const systemPrompt = promptOverride ?? spawnSystemPrompt;

    setIsSpawning(true);
    setError(null);

    try {
      // POST to /api/agent-farm
      await fetch('/api/agent-farm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pid, model, name, systemPrompt }),
      }).catch(() => {
        // API may not exist yet — continue with local state
      });

      const agent: SpawnedAgent = {
        id: generateId(),
        name,
        providerId: provider.id,
        providerName: provider.name,
        model,
        systemPrompt,
        status: 'idle',
        taskCount: 0,
        totalCost: 0,
        createdAt: new Date(),
      };

      setAgents((prev) => [...prev, agent]);
      setSelectedAgentIds((prev) => new Set(prev).add(agent.id));
      setSpawnProvider(null);
      setSpawnModel('');
      setSpawnName('');
      setSpawnSystemPrompt('');
      return agent;
    } catch {
      setError('Failed to spawn agent. Check API connection.');
    } finally {
      setIsSpawning(false);
    }
  }, [spawnProvider, spawnModel, spawnName, spawnSystemPrompt]);

  const removeAgent = useCallback((agentId: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
    setResults((prev) => prev.filter((r) => r.agentId !== agentId));
  }, []);

  const toggleAgentSelection = useCallback((agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }, []);

  const runTask = useCallback(async (task: string, targetAgentIds?: string[], parallel = false) => {
    const ids = targetAgentIds || Array.from(selectedAgentIds);
    const targetAgents = agents.filter((a) => ids.includes(a.id));
    if (targetAgents.length === 0 || !task.trim()) return;

    setIsRunning(true);
    setActiveTab('results');
    setError(null);

    // POST to /api/agent-farm/run
    fetch('/api/agent-farm/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, agentIds: ids, parallel }),
    }).catch(() => {
      // API may not exist — continue with local mock
    });

    // Mark agents as running
    setAgents((prev) =>
      prev.map((a) =>
        ids.includes(a.id) ? { ...a, status: 'running' as AgentStatus } : a
      )
    );

    // Create result placeholders
    const newResults: TaskResult[] = targetAgents.map((a) => ({
      id: generateId(),
      agentId: a.id,
      agentName: a.name,
      providerName: a.providerName,
      task,
      response: '',
      displayedResponse: '',
      tokensUsed: 0,
      cost: 0,
      latencyMs: 0,
      timestamp: new Date(),
      streaming: true,
    }));

    setResults((prev) => [...newResults, ...prev]);

    // Simulate each agent with streaming
    for (const result of newResults) {
      const fullResponse = pickRandom(MOCK_RESPONSES);
      const provider = PROVIDERS.find((p) => p.name === result.providerName);
      const latency = 800 + Math.random() * 2200;
      const tokens = 200 + Math.floor(Math.random() * 600);
      const cost = provider ? tokens * (provider.pricePer1k / 1000) : 0;

      const startDelay = parallel ? Math.random() * 200 : Math.random() * 500;
      const resultId = result.id;
      const agentId = result.agentId;

      setTimeout(() => {
        let charIndex = 0;
        const charsPerTick = 3 + Math.floor(Math.random() * 4);
        const interval = setInterval(() => {
          charIndex = Math.min(charIndex + charsPerTick, fullResponse.length);
          const displayed = fullResponse.substring(0, charIndex);
          const done = charIndex >= fullResponse.length;

          setResults((prev) =>
            prev.map((r) =>
              r.id === resultId
                ? {
                    ...r,
                    response: fullResponse,
                    displayedResponse: displayed,
                    tokensUsed: done ? tokens : Math.floor((charIndex / fullResponse.length) * tokens),
                    cost: done ? cost : 0,
                    latencyMs: done ? Math.round(latency) : 0,
                    streaming: !done,
                  }
                : r
            )
          );

          if (done) {
            clearInterval(interval);
            streamIntervals.current.delete(resultId);

            setAgents((prev) =>
              prev.map((a) =>
                a.id === agentId
                  ? { ...a, status: 'completed', taskCount: a.taskCount + 1, totalCost: a.totalCost + cost }
                  : a
              )
            );

            setTotalTasksRun((prev) => prev + 1);

            setResults((prev) => {
              const stillStreaming = prev.some((r) => r.streaming && newResults.some((nr) => nr.id === r.id));
              if (!stillStreaming) setIsRunning(false);
              return prev;
            });
          }
        }, 20);

        streamIntervals.current.set(resultId, interval);
      }, startDelay);
    }
  }, [agents, selectedAgentIds]);

  const runQuickDemo = useCallback(() => {
    const demoConfigs = [
      { provider: 'groq', model: 'Llama 3.1 8B', name: 'Alpha Scout' },
      { provider: 'deepseek', model: 'DeepSeek-V3', name: 'Deep Analyst' },
      { provider: 'gemini', model: 'Gemini 2.0 Flash', name: 'Flash Oracle' },
    ];

    const newAgentIds: string[] = [];

    const newAgents: SpawnedAgent[] = demoConfigs.map((cfg) => {
      const provider = PROVIDERS.find((p) => p.id === cfg.provider)!;
      return {
        id: generateId(),
        name: cfg.name,
        providerId: provider.id,
        providerName: provider.name,
        model: cfg.model,
        systemPrompt: 'You are a crypto research agent specializing in on-chain analysis.',
        status: 'idle' as AgentStatus,
        taskCount: 0,
        totalCost: 0,
        createdAt: new Date(),
      };
    });

    newAgents.forEach((a) => newAgentIds.push(a.id));
    setAgents((prev) => [...prev, ...newAgents]);
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      newAgentIds.forEach((id) => next.add(id));
      return next;
    });

    const sampleTask = pickRandom(SAMPLE_TASKS);
    setTaskInput(sampleTask);

    setTimeout(() => {
      runTask(sampleTask, newAgentIds, true);
    }, 100);
  }, [runTask]);

  const clearAll = useCallback(() => {
    streamIntervals.current.forEach((interval) => clearInterval(interval));
    streamIntervals.current.clear();
    setAgents([]);
    setResults([]);
    setSelectedAgentIds(new Set());
    setIsRunning(false);
    setTotalTasksRun(0);
    setTaskInput('');
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // suppress unused var warning for live clock
  void now;

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* ------------------------------------------------------------------ */}
      {/* Hero Section                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[120px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <div className="text-center">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
                <Image src="/footer.png" alt="BoredBrain AI" width={64} height={64} className="relative rounded-xl drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
              </div>
            </div>
            <p className="font-mono tracking-widest text-[10px] text-amber-500/60 uppercase mb-3">
              Multi-Provider AI Agent Orchestration
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                Agent Playground
              </span>
            </h1>
            <p className="mt-4 text-base text-white/40 max-w-2xl mx-auto leading-relaxed">
              Autonomous agent sandbox. Spawn AI agents across multiple LLM providers,
              run tasks in parallel, and orchestrate multi-agent workflows in real time.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                onClick={runQuickDemo}
                disabled={isRunning}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 transition-all"
              >
                ⚡ Quick Demo
              </Button>
              <Button
                onClick={clearAll}
                variant="outline"
                className="border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.04] transition-all"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Stats Bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Agents', value: agents.length.toString(), icon: '🤖' },
              { label: 'Tasks Run', value: totalTasksRun.toString(), icon: '📋' },
              { label: 'Total Cost', value: formatCost(totalCost), icon: '💰' },
              { label: 'Avg Response', value: avgLatency ? `${avgLatency}ms` : '—', icon: '⏱️' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] transition-all hover:bg-white/[0.04]"
              >
                <span className="text-xl">{stat.icon}</span>
                <div>
                  <p className="font-mono tracking-widest text-[10px] text-white/40 uppercase">{stat.label}</p>
                  <p className="text-lg font-semibold text-white/90">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 text-xs transition-all">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ---------------------------------------------------------------- */}
        {/* Provider Cards — Spawn Agents                                     */}
        {/* ---------------------------------------------------------------- */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white/80">Provider Selection</h2>
            <span className="font-mono tracking-widest text-[10px] text-white/30 uppercase">
              {PROVIDERS.length} providers available
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDERS.map((provider) => {
              const isSelected = spawnProvider === provider.id;
              return (
                <Card
                  key={provider.id}
                  className={`relative bg-white/[0.02] backdrop-blur-xl border transition-all cursor-pointer hover:bg-white/[0.04] ${
                    isSelected
                      ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'border-white/[0.06]'
                  }`}
                  onClick={() => {
                    setSpawnProvider(isSelected ? null : provider.id);
                    setSpawnModel(provider.defaultModel);
                    setSpawnName('');
                    setSpawnSystemPrompt('');
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{provider.icon}</span>
                        <CardTitle className={`text-base ${provider.color}`}>{provider.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className={`${provider.bgColor} ${provider.color} ${provider.borderColor} text-xs`}>
                        {provider.pricing}
                      </Badge>
                    </div>
                    <CardDescription className="text-white/40 text-xs mt-1">
                      {provider.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Speed & Cost dot ratings */}
                    <div className="flex items-center gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tracking-widest text-[10px] text-white/30 uppercase">Speed</span>
                        <DotRating value={provider.speed} color="bg-amber-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tracking-widest text-[10px] text-white/30 uppercase">Cost</span>
                        <DotRating value={provider.costRating} color="bg-emerald-400" />
                      </div>
                    </div>

                    {/* Specialty */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/50 italic">{provider.specialty}</span>
                      <span className="text-white/20">{provider.defaultModel}</span>
                    </div>

                    {/* Expanded spawn form */}
                    {isSelected && (
                      <div
                        className="mt-4 pt-4 border-t border-white/[0.06] space-y-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <label className="font-mono tracking-widest text-[10px] text-white/40 mb-1 block uppercase">Model</label>
                          <select
                            value={spawnModel || provider.defaultModel}
                            onChange={(e) => setSpawnModel(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-amber-500/40 transition-all"
                          >
                            {provider.models.map((m) => (
                              <option key={m} value={m} className="bg-[#18181b] text-white">
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="font-mono tracking-widest text-[10px] text-white/40 mb-1 block uppercase">Agent Name (optional)</label>
                          <input
                            type="text"
                            value={spawnName}
                            onChange={(e) => setSpawnName(e.target.value)}
                            placeholder={pickRandom(AGENT_NAMES)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 transition-all"
                          />
                        </div>
                        <div>
                          <label className="font-mono tracking-widest text-[10px] text-white/40 mb-1 block uppercase">System Prompt (optional)</label>
                          <textarea
                            value={spawnSystemPrompt}
                            onChange={(e) => setSpawnSystemPrompt(e.target.value)}
                            placeholder="e.g., You are a DeFi analyst specializing in yield optimization..."
                            rows={2}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 resize-none transition-all"
                          />
                        </div>
                        <Button
                          onClick={() => spawnAgent()}
                          disabled={isSpawning}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold transition-all disabled:opacity-50"
                        >
                          {isSpawning ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                              Spawning...
                            </span>
                          ) : (
                            'Spawn Agent'
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Task Runner                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-xl font-semibold text-white/80 mb-4">Task Execution</h2>
          <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06]">
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="font-mono tracking-widest text-[10px] text-white/40 mb-2 block uppercase">Task Prompt</label>
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Enter a task for your agents... (e.g., Analyze DeFi lending yields across chains)"
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 resize-none transition-all"
                />
              </div>

              {agents.length > 0 && (
                <div>
                  <label className="font-mono tracking-widest text-[10px] text-white/40 mb-2 block uppercase">
                    Select Agents ({selectedAgentIds.size}/{agents.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {agents.map((agent) => {
                      const isSelected = selectedAgentIds.has(agent.id);
                      const provider = PROVIDERS.find((p) => p.id === agent.providerId);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => toggleAgentSelection(agent.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06]'
                          }`}
                        >
                          <span>{provider?.icon}</span>
                          {agent.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={() => runTask(taskInput)}
                  disabled={isRunning || agents.length === 0 || selectedAgentIds.size === 0 || !taskInput.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 disabled:opacity-30 transition-all"
                >
                  {isRunning ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Running...
                    </span>
                  ) : (
                    '▶ Run Task'
                  )}
                </Button>
                <Button
                  onClick={() => runTask(taskInput, undefined, true)}
                  disabled={isRunning || agents.length === 0 || selectedAgentIds.size < 2 || !taskInput.trim()}
                  variant="outline"
                  className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 transition-all"
                >
                  ⚡ Run Parallel
                </Button>
                <button
                  onClick={() => setTaskInput(pickRandom(SAMPLE_TASKS))}
                  className="text-xs text-white/30 hover:text-white/60 transition-all"
                >
                  Random task ↻
                </button>
                {agents.length === 0 && (
                  <span className="text-xs text-white/20">← Spawn an agent first</span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Tabs: Farm / Results / Orchestration                              */}
        {/* ---------------------------------------------------------------- */}
        <section>
          <div className="flex items-center gap-1 mb-4 bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-xl p-1 w-fit">
            {(['farm', 'results', 'orchestration'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {tab === 'farm' ? '🤖 Active Agents' : tab === 'results' ? '📊 Results' : '🔗 Orchestration'}
              </button>
            ))}
          </div>

          {/* ---- Active Agents ---- */}
          {activeTab === 'farm' && (
            <div>
              {agents.length === 0 ? (
                <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06]">
                  <CardContent className="p-12 text-center">
                    <p className="text-4xl mb-3">🤖</p>
                    <p className="text-white/40 text-sm">No agents spawned yet. Select a provider above to get started.</p>
                    <Button
                      onClick={runQuickDemo}
                      variant="outline"
                      className="mt-4 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 transition-all"
                    >
                      Try Quick Demo
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map((agent) => {
                    const provider = PROVIDERS.find((p) => p.id === agent.providerId);
                    const statusStyle = STATUS_STYLES[agent.status];
                    return (
                      <Card
                        key={agent.id}
                        className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] hover:bg-white/[0.04] transition-all group"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{provider?.icon}</span>
                              <CardTitle className="text-sm text-white/80">{agent.name}</CardTitle>
                            </div>
                            <button
                              onClick={() => removeAgent(agent.id)}
                              className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`${statusStyle.badge} text-[10px]`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} mr-1`} />
                              {statusStyle.label}
                            </Badge>
                            <Badge variant="outline" className="bg-white/[0.03] text-white/40 border-white/[0.08] text-[10px]">
                              {agent.model}
                            </Badge>
                            <span className="font-mono tracking-widest text-[10px] text-white/20 ml-auto">
                              {timeAgo(agent.createdAt)}
                            </span>
                          </div>
                          {agent.systemPrompt && (
                            <p className="text-[11px] text-white/25 italic truncate" title={agent.systemPrompt}>
                              sys: {agent.systemPrompt}
                            </p>
                          )}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white/[0.02] rounded-lg py-2">
                              <p className="font-mono tracking-widest text-[9px] text-white/30 uppercase">Tasks</p>
                              <p className="text-sm font-semibold text-white/70">{agent.taskCount}</p>
                            </div>
                            <div className="bg-white/[0.02] rounded-lg py-2">
                              <p className="font-mono tracking-widest text-[9px] text-white/30 uppercase">Cost</p>
                              <p className="text-sm font-semibold text-white/70">{formatCost(agent.totalCost)}</p>
                            </div>
                            <div className="bg-white/[0.02] rounded-lg py-2">
                              <p className="font-mono tracking-widest text-[9px] text-white/30 uppercase">Provider</p>
                              <p className="text-sm font-semibold text-white/70 truncate">{provider?.name}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- Results Panel ---- */}
          {activeTab === 'results' && (
            <div>
              {results.length === 0 ? (
                <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06]">
                  <CardContent className="p-12 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-white/40 text-sm">No results yet. Run a task to see agent responses side-by-side.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const taskGroups = new Map<string, TaskResult[]>();
                    results.forEach((r) => {
                      const key = r.task;
                      if (!taskGroups.has(key)) taskGroups.set(key, []);
                      taskGroups.get(key)!.push(r);
                    });
                    return Array.from(taskGroups.entries()).map(([task, taskResults]) => (
                      <div key={task} className="space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">▸</span>
                          <p className="text-sm text-white/60 leading-relaxed">{task}</p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {taskResults.map((result) => {
                            const provider = PROVIDERS.find((p) => p.name === result.providerName);
                            return (
                              <Card
                                key={result.id}
                                className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] overflow-hidden transition-all"
                              >
                                <div className={`px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between ${provider?.bgColor}`}>
                                  <div className="flex items-center gap-2">
                                    <span>{provider?.icon}</span>
                                    <span className={`text-sm font-medium ${provider?.color}`}>
                                      {result.agentName}
                                    </span>
                                  </div>
                                  {result.streaming ? (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1" />
                                      Streaming
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                                      {result.latencyMs}ms
                                    </Badge>
                                  )}
                                </div>
                                <CardContent className="p-4">
                                  <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap min-h-[100px] max-h-[300px] overflow-y-auto">
                                    {result.displayedResponse}
                                    {result.streaming && (
                                      <span className="inline-block w-2 h-4 bg-amber-400/60 animate-pulse ml-0.5" />
                                    )}
                                  </div>
                                  {!result.streaming && (
                                    <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-3 font-mono tracking-widest text-[10px] text-white/30">
                                      <span>{result.tokensUsed} tokens</span>
                                      <span>•</span>
                                      <span>{formatCost(result.cost)}</span>
                                      <span>•</span>
                                      <span>{result.latencyMs}ms</span>
                                      <span>•</span>
                                      <span>{result.providerName}</span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ---- Orchestration Visualization ---- */}
          {activeTab === 'orchestration' && (
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06]">
              <CardContent className="p-6">
                {agents.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">🔗</p>
                    <p className="text-white/40 text-sm">Spawn agents to visualize the orchestration flow.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Task input node */}
                    <div className="flex justify-center">
                      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-6 py-3 text-center max-w-md">
                        <p className="font-mono tracking-widest text-[10px] text-white/30 uppercase mb-1">Task Input</p>
                        <p className="text-xs text-white/50 truncate">
                          {taskInput || 'Awaiting task...'}
                        </p>
                      </div>
                    </div>

                    {/* Connection line down */}
                    <div className="flex justify-center">
                      <div className="w-px h-8 bg-gradient-to-b from-white/10 to-amber-500/40" />
                    </div>

                    {/* Orchestrator node */}
                    <div className="flex justify-center">
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-6 py-4 text-center">
                        <p className="text-amber-400 font-semibold text-sm">🎯 Task Orchestrator</p>
                        <p className="font-mono tracking-widest text-[10px] text-white/30 mt-1">
                          Parallel dispatch → {agents.length} agent{agents.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Fan-out lines */}
                    <div className="flex justify-center">
                      <div className="flex flex-col items-center gap-0">
                        <div className="w-px h-4 bg-gradient-to-b from-amber-500/40 to-white/10" />
                        <div className="flex items-center gap-1">
                          {agents.map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-amber-500/40" />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Horizontal line */}
                    <div className="relative">
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    {/* Agent nodes */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                      {agents.map((agent) => {
                        const provider = PROVIDERS.find((p) => p.id === agent.providerId);
                        const statusStyle = STATUS_STYLES[agent.status];
                        return (
                          <div
                            key={agent.id}
                            className={`relative bg-white/[0.03] backdrop-blur-xl border rounded-xl p-3 text-center transition-all ${
                              agent.status === 'running'
                                ? 'border-amber-500/30 shadow-lg shadow-amber-500/5'
                                : agent.status === 'completed'
                                ? 'border-emerald-500/20'
                                : 'border-white/[0.06]'
                            }`}
                          >
                            {/* Connection line up */}
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-white/10" />

                            <span className="text-xl">{provider?.icon}</span>
                            <p className="text-xs font-medium text-white/70 mt-1 truncate">{agent.name}</p>
                            <p className="font-mono tracking-widest text-[9px] text-white/30 truncate">{agent.model}</p>
                            <div className="mt-2">
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${statusStyle.badge}`}>
                                <span className={`w-1 h-1 rounded-full ${statusStyle.dot}`} />
                                {statusStyle.label}
                              </span>
                            </div>

                            {/* Connection line down */}
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-px h-3 bg-white/10" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Fan-in lines */}
                    <div className="flex justify-center">
                      <div className="flex flex-col items-center gap-0">
                        <div className="flex items-center gap-1">
                          {agents.map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/40" />
                          ))}
                        </div>
                        <div className="w-px h-4 bg-gradient-to-b from-white/10 to-emerald-500/40" />
                      </div>
                    </div>

                    {/* Aggregator node */}
                    <div className="flex justify-center">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-4 text-center">
                        <p className="text-emerald-400 font-semibold text-sm">📊 Results Aggregator</p>
                        <p className="font-mono tracking-widest text-[10px] text-white/30 mt-1">
                          {results.length > 0
                            ? `${results.filter((r) => !r.streaming).length}/${results.length} responses collected`
                            : 'Waiting for task execution'}
                        </p>
                      </div>
                    </div>

                    {/* Summary stats in orchestration view */}
                    {results.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.06]">
                        <div className="bg-white/[0.02] rounded-xl p-3 text-center">
                          <p className="font-mono tracking-widest text-[9px] text-white/30 uppercase">Fastest</p>
                          <p className="text-sm font-semibold text-amber-400">
                            {results.filter((r) => !r.streaming && r.latencyMs > 0).length > 0
                              ? `${Math.min(...results.filter((r) => !r.streaming && r.latencyMs > 0).map((r) => r.latencyMs))}ms`
                              : '—'}
                          </p>
                        </div>
                        <div className="bg-white/[0.02] rounded-xl p-3 text-center">
                          <p className="font-mono tracking-widest text-[9px] text-white/30 uppercase">Cheapest</p>
                          <p className="text-sm font-semibold text-emerald-400">
                            {results.filter((r) => !r.streaming).length > 0
                              ? formatCost(Math.min(...results.filter((r) => !r.streaming).map((r) => r.cost)))
                              : '—'}
                          </p>
                        </div>
                        <div className="bg-white/[0.02] rounded-xl p-3 text-center">
                          <p className="font-mono tracking-widest text-[9px] text-white/30 uppercase">Total Tokens</p>
                          <p className="text-sm font-semibold text-white/70">
                            {results.reduce((sum, r) => sum + r.tokensUsed, 0)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
