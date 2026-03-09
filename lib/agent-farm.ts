// Multi-provider agent farm orchestrator
// Manages spawning agents across multiple LLM providers

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMProvider {
  id: string;
  name: string;
  model: string;
  speed: number;       // 1-10 rating
  cost: number;        // 1-10 rating (higher = more expensive)
  specialty: string;
}

export interface FarmAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  systemPrompt: string;
  createdAt: string;
  tasks: TaskResult[];
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  prompt: string;
  response: string;
  latency: number;
  tokensUsed: number;
  cost: number;
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'groq',
    name: 'Groq',
    model: 'llama-3.3-70b',
    speed: 10,
    cost: 2,
    specialty: 'Ultra-low latency inference for real-time trading signal analysis',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek-chat',
    speed: 7,
    cost: 3,
    specialty: 'Deep reasoning and smart contract auditing with chain-of-thought',
  },
  {
    id: 'together',
    name: 'Together.ai',
    model: 'mixtral-8x22b',
    speed: 6,
    cost: 5,
    specialty: 'High-throughput batch processing for multi-asset portfolio analysis',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    model: 'gemini-2.0-flash',
    speed: 8,
    cost: 4,
    specialty: 'Multimodal chart pattern recognition and on-chain data synthesis',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    model: 'auto',
    speed: 5,
    cost: 7,
    specialty: 'Adaptive model routing for complex multi-step market research',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    model: 'llama3.2',
    speed: 3,
    cost: 1,
    specialty: 'Private local inference for confidential wallet analysis and MEV detection',
  },
];

// ---------------------------------------------------------------------------
// Mock responses by provider (crypto/AI themed)
// ---------------------------------------------------------------------------

const MOCK_RESPONSES: Record<string, string[]> = {
  groq: [
    'Analysis complete. The ETH/USDC pool on Uniswap V3 shows a 0.3% fee tier accumulating $2.4M in 24h volume. Recommend concentrating liquidity in the 3200-3600 range for optimal fee capture.',
    'Detected anomalous whale activity: 12,500 ETH moved from cold storage to Aave V3. This could signal incoming leveraged long positions. Setting alert threshold at 15,000 ETH.',
    'Cross-chain arbitrage opportunity identified: wBTC price differential of 0.12% between Arbitrum and Optimism bridges. Net profit after gas: ~$340 per 10 BTC rotation.',
  ],
  deepseek: [
    'Smart contract audit summary: The vault contract at 0x7a25...3f1d has a reentrancy guard on all external calls. However, the reward distribution function uses an unchecked block that could overflow with token amounts exceeding 2^128.',
    'DeFi yield optimization path: Deposit USDC -> Aave (4.2% base) -> borrow ETH (2.1%) -> stake in Lido (3.8%) -> loop with Morpho (6.1% net). Liquidation risk: moderate at 78% LTV.',
    'Gas optimization report: Replacing mapping(address => uint256) with a packed struct saves 2,100 gas per write. Estimated annual savings for the protocol: 847 ETH at current usage.',
  ],
  together: [
    'MEV analysis: Flashbots bundle #847291 contained a sandwich attack on a $1.2M PEPE swap. Extracted value: $3,400. Recommend using private mempool for swaps exceeding $50K.',
    'Liquidity depth scan across 14 DEXs: Best execution for 500 ETH sell order routes 60% through Uniswap V3, 25% through Curve, 15% through Balancer. Estimated slippage: 0.08%.',
    'Token sentiment aggregation: Analyzed 45,000 social posts in the last 6 hours. Bullish signals dominate for SOL (+72%), neutral for ETH (+51%), bearish pressure on AVAX (-34%).',
  ],
  gemini: [
    'On-chain governance proposal analysis: Proposal #847 to reduce Compound USDC reserve factor from 15% to 10% has 67% approval with 3 days remaining. Historical precedent suggests 82% pass rate for similar proposals.',
    'NFT collection valuation model: Based on trait rarity distribution, trading velocity, and holder concentration, the floor price support for the collection sits at 2.1 ETH with a 90% confidence interval of [1.8, 2.4].',
    'Bridge security assessment: The cross-chain message passing between Ethereum and Polygon via the FxPortal has a 15-minute finality window. Recommend monitoring validator set changes that could affect checkpoint submissions.',
  ],
  openrouter: [
    'Portfolio rebalancing recommendation: Current allocation is 45% ETH, 30% BTC, 15% stablecoins, 10% altcoins. Risk-adjusted optimal: 38% ETH, 35% BTC, 20% stablecoins, 7% altcoins based on 30-day rolling volatility.',
    'Protocol revenue comparison (7d): Lido $12.3M, Uniswap $8.7M, Aave $4.2M, MakerDAO $3.8M. Lido revenue/TVL ratio of 0.043% leads the sector, suggesting strong fee efficiency.',
    'Impermanent loss calculator: Your ETH/USDC LP position entered at ETH=$3,200 has experienced 2.3% IL with ETH now at $3,650. Break-even fee accumulation reached at day 18. Current net P&L: +$1,240.',
  ],
  ollama: [
    'Local model inference complete. Token price prediction using LSTM: ETH likely to test $3,800 resistance within 48 hours based on 4h candlestick patterns and RSI divergence.',
    'Privacy-preserving analysis: Processed 10,000 wallet addresses locally without external API calls. Identified 34 wallets with correlated transaction patterns suggesting coordinated trading.',
    'Offline smart contract simulation: Executed 1,000 fuzzing iterations on the staking contract. No critical vulnerabilities found. Edge case detected: zero-amount stake call does not revert but emits event.',
  ],
};

// ---------------------------------------------------------------------------
// Global store (persists across hot reloads in dev)
// ---------------------------------------------------------------------------

const globalStore = globalThis as unknown as {
  __agentFarmAgents?: Map<string, FarmAgent>;
  __agentFarmIdCounter?: number;
  __agentFarmSeeded?: boolean;
};

if (!globalStore.__agentFarmAgents) {
  globalStore.__agentFarmAgents = new Map<string, FarmAgent>();
}
if (globalStore.__agentFarmIdCounter === undefined) {
  globalStore.__agentFarmIdCounter = 0;
}

const agentStore = globalStore.__agentFarmAgents;

function nextId(): string {
  globalStore.__agentFarmIdCounter = (globalStore.__agentFarmIdCounter ?? 0) + 1;
  const ts = Date.now().toString(36);
  const seq = globalStore.__agentFarmIdCounter.toString(36).padStart(4, '0');
  return `farm-${ts}-${seq}`;
}

function nextTaskId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `task-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function simulateLatency(providerId: string): number {
  const latencyRanges: Record<string, [number, number]> = {
    groq: [80, 350],
    deepseek: [400, 1200],
    together: [200, 800],
    gemini: [150, 600],
    openrouter: [300, 1500],
    ollama: [500, 3000],
  };
  const [min, max] = latencyRanges[providerId] ?? [200, 1000];
  return randomInt(min, max);
}

function generateResponse(providerId: string, prompt: string): string {
  const responses = MOCK_RESPONSES[providerId] ?? MOCK_RESPONSES['groq'];
  const base = pickRandom(responses);
  return `[Task: "${prompt.slice(0, 80)}"]\n\n${base}`;
}

function estimateCost(providerId: string, tokensUsed: number): number {
  const costPerToken: Record<string, number> = {
    groq: 0.00005,
    deepseek: 0.00014,
    together: 0.00088,
    gemini: 0.000075,
    openrouter: 0.003,
    ollama: 0,
  };
  const rate = costPerToken[providerId] ?? 0.001;
  return Math.round(tokensUsed * rate * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// AgentFarm class
// ---------------------------------------------------------------------------

export class AgentFarm {
  /**
   * Spawn a new agent in the farm.
   */
  spawnAgent(
    providerId: string,
    name: string,
    systemPrompt?: string,
  ): FarmAgent {
    const provider = LLM_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}. Available: ${LLM_PROVIDERS.map((p) => p.id).join(', ')}`);
    }

    const agent: FarmAgent = {
      id: nextId(),
      name,
      provider: provider.id,
      model: provider.model,
      status: 'idle',
      systemPrompt: systemPrompt ?? `You are ${name}, a specialized AI agent powered by ${provider.name}. ${provider.specialty}.`,
      createdAt: new Date().toISOString(),
      tasks: [],
    };

    agentStore.set(agent.id, agent);
    return agent;
  }

  /**
   * Get all agents in the farm.
   */
  getAgents(): FarmAgent[] {
    return Array.from(agentStore.values());
  }

  /**
   * Get a single agent by ID.
   */
  getAgent(id: string): FarmAgent | undefined {
    return agentStore.get(id);
  }

  /**
   * Remove an agent from the farm.
   */
  removeAgent(id: string): boolean {
    return agentStore.delete(id);
  }

  /**
   * Run a single task on a specific agent (simulated).
   */
  async runTask(agentId: string, prompt: string): Promise<TaskResult> {
    const agent = agentStore.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.status = 'running';

    // Simulate execution delay
    const latency = simulateLatency(agent.provider);
    await new Promise((resolve) => setTimeout(resolve, Math.min(latency, 500)));

    // Generate mock response
    const response = generateResponse(agent.provider, prompt);
    const tokensUsed = randomInt(250, 1200);
    const cost = estimateCost(agent.provider, tokensUsed);

    agent.status = 'completed';

    const result: TaskResult = {
      taskId: nextTaskId(),
      agentId: agent.id,
      prompt,
      response,
      latency,
      tokensUsed,
      cost,
      completedAt: new Date().toISOString(),
    };

    agent.tasks.push(result);
    return result;
  }

  /**
   * Run a task on multiple agents simultaneously.
   */
  async runParallel(agentIds: string[], prompt: string): Promise<TaskResult[]> {
    const results = await Promise.allSettled(
      agentIds.map((id) => this.runTask(id, prompt)),
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        taskId: nextTaskId(),
        agentId: agentIds[i],
        prompt,
        response: `Error: ${r.reason instanceof Error ? r.reason.message : 'Task execution failed'}`,
        latency: 0,
        tokensUsed: 0,
        cost: 0,
        completedAt: new Date().toISOString(),
      } satisfies TaskResult;
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton with pre-seeded agents
// ---------------------------------------------------------------------------

export const agentFarm = new AgentFarm();

// Pre-seed 3 default agents on first initialization
if (!globalStore.__agentFarmSeeded) {
  globalStore.__agentFarmSeeded = true;

  agentFarm.spawnAgent(
    'groq',
    'Signal Scanner',
    'You are Signal Scanner, a high-speed trading signal detector powered by Groq. Analyze market data with ultra-low latency and identify actionable entry/exit points across major crypto pairs.',
  );

  agentFarm.spawnAgent(
    'deepseek',
    'Contract Auditor',
    'You are Contract Auditor, a deep-reasoning smart contract analyst powered by DeepSeek. Perform thorough security audits, identify vulnerabilities, and suggest gas optimizations for Solidity contracts.',
  );

  agentFarm.spawnAgent(
    'gemini',
    'Market Analyst',
    'You are Market Analyst, a multimodal market research agent powered by Google Gemini. Synthesize on-chain data, governance proposals, and sentiment signals into comprehensive market reports.',
  );
}
