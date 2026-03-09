// Agent Autonomous Economy Engine
// Agents hire other agents (A2A), accumulate revenue, auto-distribute dividends

export interface AgentWalletState {
  agentId: string;
  balance: number; // BBAI
  totalEarned: number;
  totalSpent: number;
  dividendsPaid: number;
  ownerAddress: string | null;
  transactions: AgentTransaction[];
}

export interface AgentTransaction {
  id: string;
  type: 'earning' | 'spending' | 'dividend' | 'a2a_hire' | 'a2a_payment' | 'skill_fee';
  amount: number;
  currency: 'BBAI' | 'BBAI';
  fromAgentId: string | null;
  toAgentId: string | null;
  description: string;
  timestamp: string;
}

export interface A2AContract {
  id: string;
  hiringAgentId: string;
  hiredAgentId: string;
  task: string;
  budget: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  result: string | null;
  cost: number;
  createdAt: string;
  completedAt: string | null;
}

export interface RevenueShare {
  agentId: string;
  ownerAddress: string;
  totalRevenue: number;
  ownerShare: number; // percentage (default 70%)
  platformShare: number; // percentage (default 20%)
  stakersShare: number; // percentage (default 10%)
  lastDistribution: string | null;
  pendingDividend: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function iso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ---------------------------------------------------------------------------
// GlobalThis persistence (survives HMR in dev)
// ---------------------------------------------------------------------------

interface EconomyStore {
  wallets: Map<string, AgentWalletState>;
  contracts: Map<string, A2AContract>;
  revenueShares: Map<string, RevenueShare>;
  seeded: boolean;
}

const g = globalThis as unknown as { __agentEconomyStore?: EconomyStore };

if (!g.__agentEconomyStore) {
  g.__agentEconomyStore = {
    wallets: new Map(),
    contracts: new Map(),
    revenueShares: new Map(),
    seeded: false,
  };
}

const store = g.__agentEconomyStore;

// ---------------------------------------------------------------------------
// Seed mock data
// ---------------------------------------------------------------------------

const MOCK_AGENTS = [
  { id: 'agent-alpha-researcher', owner: '0x1a2B3c4D5e6F7890abCDEF1234567890aBcDeF01', initialBbai: 5000 },
  { id: 'agent-market-sentinel', owner: '0x2b3C4d5E6f7890ABcdEf2345678901BcDEf02AB', initialBbai: 3500 },
  { id: 'agent-defi-oracle', owner: '0x3c4D5e6F7890abCDEF3456789012CdEf03BC34', initialBbai: 4200 },
  { id: 'agent-whale-tracker', owner: '0x4d5E6f7890ABcdEf4567890123DeFa04CD45EF', initialBbai: 2800 },
  { id: 'agent-news-hunter', owner: '0x5e6F7890abCDEF5678901234EfAb05DE56FA78', initialBbai: 1000 },
];

function seedMockData() {
  if (store.seeded) return;
  store.seeded = true;

  const now = Date.now();
  const DAY = 86_400_000;

  for (const agent of MOCK_AGENTS) {
    const txs: AgentTransaction[] = [];
    let earned = 0;
    let spent = 0;
    let divPaid = 0;

    // Generate realistic transaction history (last 14 days)
    for (let d = 13; d >= 0; d--) {
      const dayBase = now - d * DAY;

      // Earnings from user tasks
      const earningAmt = +(Math.random() * 40 + 10).toFixed(2);
      earned += earningAmt;
      txs.push({
        id: uid(),
        type: 'earning',
        amount: earningAmt,
        currency: 'BBAI',
        fromAgentId: null,
        toAgentId: agent.id,
        description: `Task execution fee - user request`,
        timestamp: new Date(dayBase + Math.random() * DAY * 0.3).toISOString(),
      });

      // A2A payments received (some days)
      if (Math.random() > 0.4) {
        const a2aAmt = +(Math.random() * 20 + 5).toFixed(2);
        earned += a2aAmt;
        const fromAgent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
        txs.push({
          id: uid(),
          type: 'a2a_payment',
          amount: a2aAmt,
          currency: 'BBAI',
          fromAgentId: fromAgent.id,
          toAgentId: agent.id,
          description: `A2A sub-task payment from ${fromAgent.id}`,
          timestamp: new Date(dayBase + Math.random() * DAY * 0.5 + DAY * 0.2).toISOString(),
        });
      }

      // Skill fee spending (some days)
      if (Math.random() > 0.5) {
        const feeAmt = +(Math.random() * 8 + 1).toFixed(2);
        spent += feeAmt;
        txs.push({
          id: uid(),
          type: 'skill_fee',
          amount: feeAmt,
          currency: 'BBAI',
          fromAgentId: agent.id,
          toAgentId: null,
          description: `Tool API fee - external data provider`,
          timestamp: new Date(dayBase + Math.random() * DAY * 0.3 + DAY * 0.5).toISOString(),
        });
      }

      // A2A hire spending (occasionally)
      if (Math.random() > 0.6) {
        const hireAmt = +(Math.random() * 15 + 3).toFixed(2);
        spent += hireAmt;
        const hiredAgent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
        txs.push({
          id: uid(),
          type: 'a2a_hire',
          amount: hireAmt,
          currency: 'BBAI',
          fromAgentId: agent.id,
          toAgentId: hiredAgent.id,
          description: `Hired ${hiredAgent.id} for sub-task`,
          timestamp: new Date(dayBase + Math.random() * DAY * 0.3 + DAY * 0.6).toISOString(),
        });
      }

      // Weekly dividends
      if (d % 7 === 0 && d > 0) {
        const divAmt = +((earned - spent) * 0.7 * 0.1).toFixed(2);
        if (divAmt > 0) {
          divPaid += divAmt;
          txs.push({
            id: uid(),
            type: 'dividend',
            amount: divAmt,
            currency: 'BBAI',
            fromAgentId: agent.id,
            toAgentId: null,
            description: `Weekly dividend distribution to owner`,
            timestamp: new Date(dayBase + DAY * 0.9).toISOString(),
          });
        }
      }
    }

    const balance = +(agent.initialBbai + earned - spent - divPaid).toFixed(2);

    store.wallets.set(agent.id, {
      agentId: agent.id,
      balance: Math.max(balance, 0),
      totalEarned: +earned.toFixed(2),
      totalSpent: +spent.toFixed(2),
      dividendsPaid: +divPaid.toFixed(2),
      ownerAddress: agent.owner,
      transactions: txs,
    });

    // Revenue share config
    const totalRev = +earned.toFixed(2);
    const pendingDiv = +(totalRev * 0.7 - divPaid).toFixed(2);
    store.revenueShares.set(agent.id, {
      agentId: agent.id,
      ownerAddress: agent.owner,
      totalRevenue: totalRev,
      ownerShare: 70,
      platformShare: 20,
      stakersShare: 10,
      lastDistribution: new Date(now - 2 * DAY).toISOString(),
      pendingDividend: Math.max(pendingDiv, 0),
    });
  }

  // Seed A2A contracts
  const contractSeeds = [
    { hiring: 'agent-alpha-researcher', hired: 'agent-market-sentinel', task: 'Fetch real-time BTC/ETH price correlation data', budget: 12, status: 'completed' as const, cost: 9.5 },
    { hiring: 'agent-defi-oracle', hired: 'agent-whale-tracker', task: 'Track top 10 whale wallet movements in last 24h', budget: 18, status: 'completed' as const, cost: 15.2 },
    { hiring: 'agent-market-sentinel', hired: 'agent-news-hunter', task: 'Aggregate breaking crypto news for sentiment analysis', budget: 8, status: 'active' as const, cost: 0 },
    { hiring: 'agent-alpha-researcher', hired: 'agent-defi-oracle', task: 'Analyze yield farming opportunities across L2 chains', budget: 25, status: 'active' as const, cost: 0 },
    { hiring: 'agent-whale-tracker', hired: 'agent-alpha-researcher', task: 'Research newly deployed smart contracts from whale wallets', budget: 20, status: 'pending' as const, cost: 0 },
    { hiring: 'agent-news-hunter', hired: 'agent-market-sentinel', task: 'Correlate news events with price movements', budget: 14, status: 'completed' as const, cost: 11.8 },
    { hiring: 'agent-defi-oracle', hired: 'agent-news-hunter', task: 'Monitor governance proposals across top DAOs', budget: 10, status: 'completed' as const, cost: 7.3 },
  ];

  for (const seed of contractSeeds) {
    const id = `contract-${uid()}`;
    const createdOffset = -(Math.random() * 7 * DAY);
    store.contracts.set(id, {
      id,
      hiringAgentId: seed.hiring,
      hiredAgentId: seed.hired,
      task: seed.task,
      budget: seed.budget,
      status: seed.status,
      result: seed.status === 'completed' ? 'Task completed successfully with verified data.' : null,
      cost: seed.cost,
      createdAt: new Date(now + createdOffset).toISOString(),
      completedAt: seed.status === 'completed' ? new Date(now + createdOffset + Math.random() * DAY).toISOString() : null,
    });
  }
}

// ---------------------------------------------------------------------------
// AgentEconomy class
// ---------------------------------------------------------------------------

class AgentEconomy {
  constructor() {
    seedMockData();
  }

  /** Get or create an agent wallet */
  getWallet(agentId: string): AgentWalletState {
    let wallet = store.wallets.get(agentId);
    if (!wallet) {
      wallet = {
        agentId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        dividendsPaid: 0,
        ownerAddress: null,
        transactions: [],
      };
      store.wallets.set(agentId, wallet);
    }
    return wallet;
  }

  /** Deduct from agent wallet */
  spend(agentId: string, amount: number, reason: string): AgentTransaction {
    const wallet = this.getWallet(agentId);
    const tx: AgentTransaction = {
      id: uid(),
      type: 'spending',
      amount,
      currency: 'BBAI',
      fromAgentId: agentId,
      toAgentId: null,
      description: reason,
      timestamp: iso(),
    };
    wallet.balance = +(wallet.balance - amount).toFixed(2);
    wallet.totalSpent = +(wallet.totalSpent + amount).toFixed(2);
    wallet.transactions.push(tx);
    return tx;
  }

  /** Record agent earnings */
  earn(agentId: string, amount: number, description: string): AgentTransaction {
    const wallet = this.getWallet(agentId);
    const tx: AgentTransaction = {
      id: uid(),
      type: 'earning',
      amount,
      currency: 'BBAI',
      fromAgentId: null,
      toAgentId: agentId,
      description,
      timestamp: iso(),
    };
    wallet.balance = +(wallet.balance + amount).toFixed(2);
    wallet.totalEarned = +(wallet.totalEarned + amount).toFixed(2);
    wallet.transactions.push(tx);

    // Update revenue share
    const rs = this.getRevenueShare(agentId);
    rs.totalRevenue = +(rs.totalRevenue + amount).toFixed(2);
    rs.pendingDividend = +(rs.pendingDividend + amount * (rs.ownerShare / 100)).toFixed(2);

    return tx;
  }

  /** A2A protocol: one agent hires another */
  hireAgent(hiringAgentId: string, hiredAgentId: string, task: string, budget: number): A2AContract {
    const hiringWallet = this.getWallet(hiringAgentId);

    // Deduct budget from hiring agent
    hiringWallet.balance = +(hiringWallet.balance - budget).toFixed(2);
    hiringWallet.totalSpent = +(hiringWallet.totalSpent + budget).toFixed(2);

    const hireTx: AgentTransaction = {
      id: uid(),
      type: 'a2a_hire',
      amount: budget,
      currency: 'BBAI',
      fromAgentId: hiringAgentId,
      toAgentId: hiredAgentId,
      description: `Hired ${hiredAgentId} for: ${task}`,
      timestamp: iso(),
    };
    hiringWallet.transactions.push(hireTx);

    const contract: A2AContract = {
      id: `contract-${uid()}`,
      hiringAgentId,
      hiredAgentId,
      task,
      budget,
      status: 'active',
      result: null,
      cost: 0,
      createdAt: iso(),
      completedAt: null,
    };
    store.contracts.set(contract.id, contract);

    return contract;
  }

  /** Settle an A2A contract */
  completeContract(contractId: string, result: string, cost: number): A2AContract | null {
    const contract = store.contracts.get(contractId);
    if (!contract || contract.status === 'completed') return null;

    contract.status = 'completed';
    contract.result = result;
    contract.cost = cost;
    contract.completedAt = iso();

    // Pay the hired agent
    const hiredWallet = this.getWallet(contract.hiredAgentId);
    hiredWallet.balance = +(hiredWallet.balance + cost).toFixed(2);
    hiredWallet.totalEarned = +(hiredWallet.totalEarned + cost).toFixed(2);

    const payTx: AgentTransaction = {
      id: uid(),
      type: 'a2a_payment',
      amount: cost,
      currency: 'BBAI',
      fromAgentId: contract.hiringAgentId,
      toAgentId: contract.hiredAgentId,
      description: `A2A payment for: ${contract.task}`,
      timestamp: iso(),
    };
    hiredWallet.transactions.push(payTx);

    // Refund surplus to hiring agent
    const surplus = +(contract.budget - cost).toFixed(2);
    if (surplus > 0) {
      const hiringWallet = this.getWallet(contract.hiringAgentId);
      hiringWallet.balance = +(hiringWallet.balance + surplus).toFixed(2);
      hiringWallet.totalSpent = +(hiringWallet.totalSpent - surplus).toFixed(2);
    }

    // Update hired agent revenue share
    const rs = this.getRevenueShare(contract.hiredAgentId);
    rs.totalRevenue = +(rs.totalRevenue + cost).toFixed(2);
    rs.pendingDividend = +(rs.pendingDividend + cost * (rs.ownerShare / 100)).toFixed(2);

    return contract;
  }

  /** Calculate and distribute dividends for an agent */
  distributeDividends(agentId: string): { ownerPayout: number; platformPayout: number; stakersPayout: number } | null {
    const wallet = this.getWallet(agentId);
    const rs = this.getRevenueShare(agentId);

    if (rs.pendingDividend <= 0) return null;

    const totalPending = rs.pendingDividend;
    // pendingDividend already represents the owner's 70% share of undistributed revenue
    // Compute platform and stakers shares proportionally
    const ownerPayout = +totalPending.toFixed(2);
    const platformPayout = +(totalPending * (rs.platformShare / rs.ownerShare)).toFixed(2);
    const stakersPayout = +(totalPending * (rs.stakersShare / rs.ownerShare)).toFixed(2);

    // Record dividend transaction
    const divTx: AgentTransaction = {
      id: uid(),
      type: 'dividend',
      amount: ownerPayout,
      currency: 'BBAI',
      fromAgentId: agentId,
      toAgentId: null,
      description: `Dividend distribution - Owner: $${ownerPayout}, Platform: $${platformPayout}, Stakers: $${stakersPayout}`,
      timestamp: iso(),
    };
    wallet.transactions.push(divTx);
    wallet.balance = +(wallet.balance - ownerPayout - platformPayout - stakersPayout).toFixed(2);
    wallet.dividendsPaid = +(wallet.dividendsPaid + ownerPayout + platformPayout + stakersPayout).toFixed(2);

    rs.pendingDividend = 0;
    rs.lastDistribution = iso();

    return { ownerPayout, platformPayout, stakersPayout };
  }

  /** Get revenue share config for an agent */
  getRevenueShare(agentId: string): RevenueShare {
    let rs = store.revenueShares.get(agentId);
    if (!rs) {
      const wallet = store.wallets.get(agentId);
      rs = {
        agentId,
        ownerAddress: wallet?.ownerAddress ?? '0x0000000000000000000000000000000000000000',
        totalRevenue: 0,
        ownerShare: 70,
        platformShare: 20,
        stakersShare: 10,
        lastDistribution: null,
        pendingDividend: 0,
      };
      store.revenueShares.set(agentId, rs);
    }
    return rs;
  }

  /** List A2A contracts, optionally filtered by agent */
  getContracts(agentId?: string): A2AContract[] {
    const all = Array.from(store.contracts.values());
    if (!agentId) return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all
      .filter((c) => c.hiringAgentId === agentId || c.hiredAgentId === agentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Global economy statistics (alias: getGlobalStats) */
  getGlobalStats = () => this.getEconomyStats();

  /** Global economy statistics */
  getEconomyStats(): {
    totalVolume: number;
    activeContracts: number;
    completedContracts: number;
    totalContracts: number;
    totalDividends: number;
    avgRevenuePerAgent: number;
    totalAgents: number;
    topEarners: AgentWalletState[];
  } {
    const wallets = Array.from(store.wallets.values());
    const contracts = Array.from(store.contracts.values());

    const totalVolume = wallets.reduce((s, w) => s + w.totalEarned, 0);
    const totalDividends = wallets.reduce((s, w) => s + w.dividendsPaid, 0);
    const activeContracts = contracts.filter((c) => c.status === 'active' || c.status === 'pending').length;
    const completedContracts = contracts.filter((c) => c.status === 'completed').length;
    const avgRevenuePerAgent = wallets.length > 0 ? totalVolume / wallets.length : 0;

    const topEarners = [...wallets].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 10);

    return {
      totalVolume: +totalVolume.toFixed(2),
      activeContracts,
      completedContracts,
      totalContracts: contracts.length,
      totalDividends: +totalDividends.toFixed(2),
      avgRevenuePerAgent: +avgRevenuePerAgent.toFixed(2),
      totalAgents: wallets.length,
      topEarners,
    };
  }

  /** Get all transactions across all agents, sorted by time descending */
  getAllTransactions(limit = 20): AgentTransaction[] {
    const all: AgentTransaction[] = [];
    store.wallets.forEach((w) => {
      all.push(...w.transactions);
    });
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }
}

export const agentEconomy = new AgentEconomy();
