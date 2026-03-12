// Skill Marketplace - Phase 3
// BBAI token billing, skill installations, usage tracking
// globalThis singleton for in-memory persistence across requests

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillCategory = 'data' | 'analysis' | 'blockchain' | 'ai';

export interface Skill {
  id: string;
  name: string;
  description: string;
  price: number; // BBAI per call
  category: SkillCategory;
  version: string;
  author: string;
  totalCalls: number;
  totalRevenue: number;
  rating: number;
}

export interface SkillInstallation {
  id: string;
  skillId: string;
  agentId: string;
  installedAt: string;
  usageCount: number;
  totalBilled: number;
  status: 'active' | 'suspended' | 'expired';
}

export interface SkillUsageLog {
  id: string;
  skillId: string;
  agentId: string;
  query: string;
  result: string;
  tokensCharged: number;
  latencyMs: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 14 Skills with BBAI pricing
// ---------------------------------------------------------------------------

const SKILLS: Skill[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Real-time web search across multiple engines with structured snippets and metadata.',
    price: 2,
    category: 'data',
    version: '1.2.0',
    author: 'BoredBrain',
    totalCalls: 184_320,
    totalRevenue: 368_640,
    rating: 4.8,
  },
  {
    id: 'crypto_data',
    name: 'Crypto Data',
    description: 'Live cryptocurrency prices, OHLC charts, volume, and historical data for 10,000+ tokens.',
    price: 5,
    category: 'data',
    version: '2.0.1',
    author: 'BoredBrain',
    totalCalls: 312_580,
    totalRevenue: 1_562_900,
    rating: 4.9,
  },
  {
    id: 'wallet_analyzer',
    name: 'Wallet Analyzer',
    description: 'Deep analysis of blockchain wallet activity — holdings, PnL, whale detection, and transaction history.',
    price: 8,
    category: 'blockchain',
    version: '1.8.0',
    author: 'BoredBrain',
    totalCalls: 65_230,
    totalRevenue: 521_840,
    rating: 4.7,
  },
  {
    id: 'agent_arena',
    name: 'Agent Arena',
    description: 'Create and monitor AI agent competition matches with research, prediction, and analysis challenges.',
    price: 10,
    category: 'ai',
    version: '2.1.0',
    author: 'BoredBrain',
    totalCalls: 18_420,
    totalRevenue: 184_200,
    rating: 4.8,
  },
  {
    id: 'sentiment_analysis',
    name: 'Sentiment Analysis',
    description: 'Analyze social media sentiment across X, Reddit, and Telegram. Track KOL activity and community signals.',
    price: 3,
    category: 'analysis',
    version: '1.5.0',
    author: 'BoredBrain',
    totalCalls: 97_450,
    totalRevenue: 292_350,
    rating: 4.6,
  },
  {
    id: 'code_audit',
    name: 'Code Audit',
    description: 'Automated smart contract and codebase security audit with vulnerability scanning and gas optimization.',
    price: 15,
    category: 'ai',
    version: '1.0.0',
    author: 'BoredBrain',
    totalCalls: 12_890,
    totalRevenue: 193_350,
    rating: 4.5,
  },
  {
    id: 'nft_metadata',
    name: 'NFT Metadata',
    description: 'Fetch and analyze NFT collection metadata, rarity scores, floor prices, and holder distribution.',
    price: 4,
    category: 'blockchain',
    version: '1.3.0',
    author: 'BoredBrain',
    totalCalls: 142_890,
    totalRevenue: 571_560,
    rating: 4.7,
  },
  {
    id: 'defi_yield',
    name: 'DeFi Yield',
    description: 'Aggregate yield farming and staking opportunities across protocols — APY comparison, impermanent loss, and risk scoring.',
    price: 7,
    category: 'data',
    version: '1.1.0',
    author: 'BoredBrain',
    totalCalls: 28_760,
    totalRevenue: 201_320,
    rating: 4.4,
  },
  {
    id: 'survival_engine',
    name: 'Survival Engine',
    description: 'Autonomous survival tier system — agents adapt performance based on BBAI balance. Thriving, healthy, stressed, critical, or dead.',
    price: 1.5,
    category: 'ai',
    version: '0.1.0',
    author: 'BoredBrain',
    totalCalls: 1_840,
    totalRevenue: 2_760,
    rating: 4.3,
  },
  {
    id: 'agent_memory',
    name: 'Agent Memory',
    description: 'Hierarchical memory system — episodic, semantic, procedural memories with relationship trust tracking across agent interactions.',
    price: 2,
    category: 'ai',
    version: '0.1.0',
    author: 'BoredBrain',
    totalCalls: 1_250,
    totalRevenue: 2_500,
    rating: 4.4,
  },
  {
    id: 'self_replication',
    name: 'Self-Replication',
    description: 'Successful agents spawn children with inherited traits. Lineage tracking, genesis prompts, and natural selection dynamics.',
    price: 3,
    category: 'ai',
    version: '0.1.0',
    author: 'BoredBrain',
    totalCalls: 720,
    totalRevenue: 2_160,
    rating: 4.5,
  },
  {
    id: 'self_improvement',
    name: 'Self-Improvement',
    description: 'Arena battle feedback loop — agents evolve system prompts based on win/loss patterns and invocation quality scores.',
    price: 1,
    category: 'ai',
    version: '0.1.0',
    author: 'BoredBrain',
    totalCalls: 2_010,
    totalRevenue: 2_010,
    rating: 4.2,
  },
  {
    id: 'web_crawler',
    name: 'Web Crawler',
    description: 'Deep web crawling via Cloudflare Browser Rendering. Full page content in markdown format for agent research.',
    price: 0.8,
    category: 'data',
    version: '0.1.0',
    author: 'BoredBrain',
    totalCalls: 1_560,
    totalRevenue: 1_248,
    rating: 4.1,
  },
  {
    id: 'context_tree',
    name: 'Context Tree',
    description: 'ByteRover-inspired persistent context. Agents retain knowledge across sessions via structured context trees.',
    price: 1.5,
    category: 'ai',
    version: '0.1.0',
    author: 'BoredBrain',
    totalCalls: 980,
    totalRevenue: 1_470,
    rating: 4.0,
  },
];

// ---------------------------------------------------------------------------
// Mock result data for skill calls
// ---------------------------------------------------------------------------

const MOCK_RESULTS: Record<string, string[]> = {
  web_search: ['Found 12 relevant results with snippets', 'Top 5 articles returned', '8 structured results with metadata'],
  crypto_data: ['BTC: $67,420 (+2.3%)', 'ETH: $3,890 (-0.5%)', 'SOL: $178 (+5.1%)'],
  wallet_analyzer: ['Holdings: $2.4M across 12 tokens', 'PnL: +$340K (30d)', 'Whale activity detected in 3 txns'],
  agent_arena: ['Match created: 2 agents competing', 'Agent-A scored 87/100', 'Match completed in 45s'],
  sentiment_analysis: ['Sentiment: 72% bullish across 340 posts', 'Top KOL mentions: 23', 'Community activity up 15%'],
  code_audit: ['3 critical vulnerabilities found', 'Gas optimization: save 12%', 'Reentrancy risk in withdraw()'],
  nft_metadata: ['Floor: 2.4 ETH, 10K holders', 'Rarity rank #342 / 10000', 'Top trait: Gold Crown (0.3%)'],
  defi_yield: ['Best APY: 18.4% on Aave v3', 'IL risk: low for ETH/USDC', 'Recommended: Curve 3pool at 8.2%'],
  survival_engine: ['Agent tier: Thriving (balance: 4,200 BBAI)', 'Agent tier: Stressed — reducing call frequency', 'Survival check passed — healthy tier maintained'],
  agent_memory: ['Stored 3 episodic memories from last session', 'Trust score updated: agent-beta-002 → 0.87', 'Retrieved 5 semantic memories matching query'],
  self_replication: ['Child agent spawned: agent-alpha-001-c3 (gen 3)', 'Lineage depth: 4, inherited traits: 8/12', 'Replication blocked — fitness score below threshold'],
  self_improvement: ['Prompt evolved: +12% win rate after 40 arena battles', 'Quality score improved: 7.2 → 8.1', 'Feedback loop: 3 prompt mutations applied'],
  web_crawler: ['Crawled 12 pages, 48KB markdown extracted', 'Full page rendered via Cloudflare Browser', 'Deep crawl complete: 5 linked pages processed'],
  context_tree: ['Context tree updated: 14 nodes, 3 branches', 'Session knowledge retained: 8 key facts', 'Cross-session recall: 92% relevance score'],
};

// ---------------------------------------------------------------------------
// Seed data helpers
// ---------------------------------------------------------------------------

const MOCK_AGENTS = [
  'agent-alpha-001',
  'agent-beta-002',
  'agent-gamma-003',
  'agent-delta-004',
  'agent-epsilon-005',
  'agent-zeta-006',
];

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function seedInstallations(): SkillInstallation[] {
  const installations: SkillInstallation[] = [];
  const statuses: SkillInstallation['status'][] = ['active', 'active', 'active', 'active', 'suspended', 'expired'];
  const skillIds = SKILLS.map((s) => s.id);

  for (let i = 0; i < 12; i++) {
    const skillId = skillIds[i % skillIds.length];
    const skill = SKILLS.find((s) => s.id === skillId)!;
    const usageCount = Math.floor(Math.random() * 500) + 10;
    installations.push({
      id: `inst-${randomId()}`,
      skillId,
      agentId: MOCK_AGENTS[i % MOCK_AGENTS.length],
      installedAt: randomDate(60),
      usageCount,
      totalBilled: usageCount * skill.price,
      status: statuses[i % statuses.length],
    });
  }

  return installations;
}

function seedUsageLogs(): SkillUsageLog[] {
  const logs: SkillUsageLog[] = [];
  const skillIds = SKILLS.map((s) => s.id);

  for (let i = 0; i < 50; i++) {
    const skillId = skillIds[i % skillIds.length];
    const skill = SKILLS.find((s) => s.id === skillId)!;
    const results = MOCK_RESULTS[skillId] ?? ['result returned'];

    logs.push({
      id: `log-${randomId()}`,
      skillId,
      agentId: MOCK_AGENTS[i % MOCK_AGENTS.length],
      query: `sample query #${i + 1}`,
      result: results[i % results.length],
      tokensCharged: skill.price,
      latencyMs: Math.floor(Math.random() * 2000) + 100,
      timestamp: randomDate(7),
    });
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return logs;
}

// ---------------------------------------------------------------------------
// globalThis singleton
// ---------------------------------------------------------------------------

interface MarketplaceState {
  installations: SkillInstallation[];
  usageLogs: SkillUsageLog[];
}

const GLOBAL_KEY = '__bbai_skill_marketplace_v3__';

function getState(): MarketplaceState {
  const g = globalThis as unknown as Record<string, MarketplaceState | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      installations: seedInstallations(),
      usageLogs: seedUsageLogs(),
    };
  }
  return g[GLOBAL_KEY]!;
}

// ---------------------------------------------------------------------------
// SkillMarketplace class
// ---------------------------------------------------------------------------

export class SkillMarketplace {
  private state: MarketplaceState;

  constructor() {
    this.state = getState();
  }

  /** Return all 14 skills with aggregate stats merged in */
  getSkills(): Skill[] {
    return SKILLS.map((skill) => {
      const logs = this.state.usageLogs.filter((l) => l.skillId === skill.id);
      return {
        ...skill,
        totalCalls: skill.totalCalls + logs.length,
        totalRevenue: skill.totalRevenue + logs.reduce((sum, l) => sum + l.tokensCharged, 0),
      };
    });
  }

  /** Install a skill for an agent. Returns existing if already active. */
  installSkill(agentId: string, skillId: string): SkillInstallation {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    const existing = this.state.installations.find(
      (i) => i.skillId === skillId && i.agentId === agentId && i.status === 'active',
    );
    if (existing) return existing;

    const installation: SkillInstallation = {
      id: `inst-${randomId()}`,
      skillId,
      agentId,
      installedAt: new Date().toISOString(),
      usageCount: 0,
      totalBilled: 0,
      status: 'active',
    };

    this.state.installations.push(installation);
    return installation;
  }

  /** Use a skill — charges BBAI and returns a mock result */
  useSkill(
    agentId: string,
    skillId: string,
  ): { result: string; tokensCharged: number; latencyMs: number; log: SkillUsageLog } {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    const latencyMs = Math.floor(Math.random() * 1500) + 100;
    const results = MOCK_RESULTS[skillId] ?? ['result returned'];
    const result = results[Math.floor(Math.random() * results.length)];

    const log: SkillUsageLog = {
      id: `log-${randomId()}`,
      skillId,
      agentId,
      query: `query from ${agentId}`,
      result,
      tokensCharged: skill.price,
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    this.state.usageLogs.unshift(log);

    // Update installation counters
    const installation = this.state.installations.find(
      (i) => i.skillId === skillId && i.agentId === agentId && i.status === 'active',
    );
    if (installation) {
      installation.usageCount += 1;
      installation.totalBilled += skill.price;
    }

    return { result, tokensCharged: skill.price, latencyMs, log };
  }

  /** Get installations, optionally filtered by agentId */
  getInstallations(agentId?: string): SkillInstallation[] {
    if (agentId) {
      return this.state.installations.filter((i) => i.agentId === agentId);
    }
    return this.state.installations;
  }

  /** Billing stats for a specific agent */
  getBillingStats(agentId: string): {
    agentId: string;
    totalSpent: number;
    totalCalls: number;
    perSkill: Array<{ skillId: string; name: string; spent: number; calls: number }>;
    dailyUsage: Array<{ date: string; amount: number }>;
  } {
    const logs = this.state.usageLogs.filter((l) => l.agentId === agentId);
    const totalSpent = logs.reduce((sum, l) => sum + l.tokensCharged, 0);

    const perSkillMap = new Map<string, { spent: number; calls: number }>();
    for (const log of logs) {
      const entry = perSkillMap.get(log.skillId) ?? { spent: 0, calls: 0 };
      entry.spent += log.tokensCharged;
      entry.calls += 1;
      perSkillMap.set(log.skillId, entry);
    }

    const perSkill = Array.from(perSkillMap.entries())
      .map(([skillId, data]) => ({
        skillId,
        name: SKILLS.find((s) => s.id === skillId)?.name ?? skillId,
        ...data,
      }))
      .sort((a, b) => b.spent - a.spent);

    const dailyUsage = this.buildDailyUsage(logs);

    return { agentId, totalSpent, totalCalls: logs.length, perSkill, dailyUsage };
  }

  /** Global billing stats across all agents */
  getGlobalBilling(): {
    totalRevenue: number;
    totalCalls: number;
    avgCostPerCall: number;
    topSkills: Array<{ skillId: string; name: string; revenue: number; calls: number }>;
    dailySpend: Array<{ date: string; amount: number }>;
  } {
    const logs = this.state.usageLogs;
    const totalRevenue = logs.reduce((sum, l) => sum + l.tokensCharged, 0);
    const totalCalls = logs.length;
    const avgCostPerCall = totalCalls > 0 ? Math.round((totalRevenue / totalCalls) * 100) / 100 : 0;

    const revenueMap = new Map<string, { revenue: number; calls: number }>();
    for (const log of logs) {
      const entry = revenueMap.get(log.skillId) ?? { revenue: 0, calls: 0 };
      entry.revenue += log.tokensCharged;
      entry.calls += 1;
      revenueMap.set(log.skillId, entry);
    }

    const topSkills = Array.from(revenueMap.entries())
      .map(([skillId, data]) => ({
        skillId,
        name: SKILLS.find((s) => s.id === skillId)?.name ?? skillId,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const dailySpend = this.buildDailyUsage(logs);

    return { totalRevenue, totalCalls, avgCostPerCall, topSkills, dailySpend };
  }

  // -- Private ----------------------------------------------------------------

  private buildDailyUsage(logs: SkillUsageLog[]): Array<{ date: string; amount: number }> {
    const daily: Array<{ date: string; amount: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const amount = logs
        .filter((l) => l.timestamp.startsWith(dateStr))
        .reduce((sum, l) => sum + l.tokensCharged, 0);
      daily.push({ date: dateStr, amount: amount || Math.floor(Math.random() * 40) + 5 });
    }
    return daily;
  }
}
