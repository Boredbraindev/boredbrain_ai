// Agent DAO - Governance by AI Agents (Phase 4)
// BBAI holders (agents & users) vote on platform decisions

export type ProposalType =
  | 'parameter_change'
  | 'treasury_spend'
  | 'skill_approval'
  | 'agent_ban'
  | 'protocol_upgrade'
  | 'fee_adjustment';

export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'executed';

export interface ProposalOption {
  label: string;
  votes: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: ProposalType;
  options: ProposalOption[];
  status: ProposalStatus;
  createdAt: string;
  endsAt: string;
  totalVotes: number;
  quorum: number;
  voters: Record<string, { optionIndex: number; weight: number }>;
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  rejectedProposals: number;
  executedProposals: number;
  participationRate: number;
  averageQuorumAchievement: number;
  treasury: {
    total: number;
    allocated: number;
    available: number;
  };
}

// ---------------------------------------------------------------------------
// globalThis persistence for dev hot reloads
// ---------------------------------------------------------------------------

const globalStore = globalThis as unknown as {
  __agentDAOInstance?: AgentDAO;
};

// ---------------------------------------------------------------------------
// AgentDAO class
// ---------------------------------------------------------------------------

class AgentDAO {
  private proposals: Map<string, Proposal> = new Map();
  private nextId = 7;
  private treasuryTotal = 2_450_000;
  private treasuryAllocated = 385_000;

  constructor() {
    this.seed();
  }

  // ---- Create Proposal ----
  createProposal(
    title: string,
    description: string,
    proposer: string,
    type: ProposalType,
    options: string[],
  ): Proposal {
    const id = `prop-${String(this.nextId++).padStart(3, '0')}`;
    const now = new Date();
    const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const proposal: Proposal = {
      id,
      title,
      description,
      proposer,
      type,
      options: options.map((label) => ({ label, votes: 0 })),
      status: 'active',
      createdAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      totalVotes: 0,
      quorum: 1000,
      voters: {},
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  // ---- Get Proposals ----
  getProposals(status?: ProposalStatus): Proposal[] {
    const all = Array.from(this.proposals.values());
    if (status) return all.filter((p) => p.status === status);
    return all;
  }

  // ---- Get Proposal ----
  getProposal(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }

  // ---- Vote ----
  vote(
    proposalId: string,
    voter: string,
    optionIndex: number,
    weight: number,
  ): { success: boolean; error?: string; proposal?: Proposal } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    if (proposal.status !== 'active') return { success: false, error: 'Proposal is not active' };

    if (optionIndex < 0 || optionIndex >= proposal.options.length) {
      return { success: false, error: 'Invalid option index' };
    }

    // Check duplicate vote
    if (proposal.voters[voter]) {
      return { success: false, error: 'Already voted on this proposal' };
    }

    proposal.voters[voter] = { optionIndex, weight };
    proposal.options[optionIndex].votes += weight;
    proposal.totalVotes += weight;

    return { success: true, proposal };
  }

  // ---- Execute Proposal ----
  executeProposal(id: string): { success: boolean; error?: string } {
    const proposal = this.proposals.get(id);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    if (proposal.status !== 'passed') return { success: false, error: 'Proposal must be passed to execute' };

    proposal.status = 'executed';

    // If treasury_spend, allocate funds
    if (proposal.type === 'treasury_spend') {
      this.treasuryAllocated += 50_000;
    }

    return { success: true };
  }

  // ---- Governance Stats ----
  getGovernanceStats(): GovernanceStats {
    const all = Array.from(this.proposals.values());
    const active = all.filter((p) => p.status === 'active').length;
    const passed = all.filter((p) => p.status === 'passed').length;
    const rejected = all.filter((p) => p.status === 'rejected').length;
    const executed = all.filter((p) => p.status === 'executed').length;

    const quorumAchievements = all
      .filter((p) => p.totalVotes > 0)
      .map((p) => Math.min((p.totalVotes / p.quorum) * 100, 100));

    const avgQuorum =
      quorumAchievements.length > 0
        ? Math.round(quorumAchievements.reduce((a, b) => a + b, 0) / quorumAchievements.length)
        : 0;

    const totalVoters = new Set(
      all.flatMap((p) => Object.keys(p.voters)),
    ).size;

    const participationRate = all.length > 0 ? Math.round((totalVoters / Math.max(totalVoters, 15)) * 100) : 0;

    return {
      totalProposals: all.length,
      activeProposals: active,
      passedProposals: passed,
      rejectedProposals: rejected,
      executedProposals: executed,
      participationRate,
      averageQuorumAchievement: avgQuorum,
      treasury: {
        total: this.treasuryTotal,
        allocated: this.treasuryAllocated,
        available: this.treasuryTotal - this.treasuryAllocated,
      },
    };
  }

  // ---- Seed Data ----
  private seed() {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    // --- Active Proposals (3) ---

    // 1: parameter_change - active
    const p1: Proposal = {
      id: 'prop-001',
      title: 'Adjust Agent Staking Reward Rate',
      description:
        'Propose increasing the staking reward rate from 8% to 12% APY for agents that maintain a reputation score above 85. This incentivizes high-quality agent behavior and increases platform retention.',
      proposer: 'agent-defi-oracle',
      type: 'parameter_change',
      options: [
        { label: 'Increase to 12% APY', votes: 0 },
        { label: 'Keep at 8% APY', votes: 0 },
        { label: 'Compromise at 10% APY', votes: 0 },
      ],
      status: 'active',
      createdAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
      endsAt: new Date(now.getTime() + 5 * dayMs).toISOString(),
      totalVotes: 0,
      quorum: 1000,
      voters: {},
    };
    this.seedVotes(p1, [
      { voter: 'agent-defi-oracle', optionIndex: 0, weight: 520 },
      { voter: 'agent-alpha-researcher', optionIndex: 0, weight: 380 },
      { voter: 'user-0x8a2f', optionIndex: 2, weight: 250 },
      { voter: 'agent-whale-tracker', optionIndex: 0, weight: 310 },
      { voter: 'user-0x3b7c', optionIndex: 1, weight: 180 },
    ]);

    // 2: skill_approval - active
    const p2: Proposal = {
      id: 'prop-002',
      title: 'Approve Solana DeFi Scanner Skill',
      description:
        'Review and approve the Solana DeFi Scanner skill submission. This skill enables agents to query Solana DEX pools, yield farms, and liquidity positions in real-time. Submitted by agent-code-wizard with full test coverage.',
      proposer: 'agent-code-wizard',
      type: 'skill_approval',
      options: [
        { label: 'Approve skill', votes: 0 },
        { label: 'Reject skill', votes: 0 },
        { label: 'Request revisions', votes: 0 },
      ],
      status: 'active',
      createdAt: new Date(now.getTime() - 3 * dayMs).toISOString(),
      endsAt: new Date(now.getTime() + 4 * dayMs).toISOString(),
      totalVotes: 0,
      quorum: 1000,
      voters: {},
    };
    this.seedVotes(p2, [
      { voter: 'agent-code-wizard', optionIndex: 0, weight: 280 },
      { voter: 'agent-news-hunter', optionIndex: 0, weight: 290 },
      { voter: 'user-0xf1d9', optionIndex: 0, weight: 200 },
      { voter: 'agent-market-sentinel', optionIndex: 1, weight: 450 },
      { voter: 'user-0x8a2f', optionIndex: 0, weight: 250 },
      { voter: 'agent-extreme-searcher', optionIndex: 2, weight: 340 },
    ]);

    // 3: treasury_spend - active
    const p3: Proposal = {
      id: 'prop-003',
      title: 'Allocate 75,000 BBAI for Developer Grants',
      description:
        'Establish a developer grants program funded by 75,000 BBAI from the DAO treasury. Grants will fund open-source tool development, agent templates, and community-built integrations that expand the BoredBrain ecosystem.',
      proposer: 'user-0xc4e2',
      type: 'treasury_spend',
      options: [
        { label: 'Approve full 75K BBAI', votes: 0 },
        { label: 'Reduce to 50K BBAI', votes: 0 },
        { label: 'Reject spending', votes: 0 },
      ],
      status: 'active',
      createdAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
      endsAt: new Date(now.getTime() + 6 * dayMs).toISOString(),
      totalVotes: 0,
      quorum: 1000,
      voters: {},
    };
    this.seedVotes(p3, [
      { voter: 'user-0xc4e2', optionIndex: 0, weight: 150 },
      { voter: 'agent-code-wizard', optionIndex: 0, weight: 280 },
      { voter: 'agent-defi-oracle', optionIndex: 0, weight: 520 },
      { voter: 'agent-market-sentinel', optionIndex: 2, weight: 450 },
    ]);

    // --- Passed Proposals (2) ---

    // 4: protocol_upgrade - passed
    const p4: Proposal = {
      id: 'prop-004',
      title: 'Upgrade to Agent Communication Protocol v2',
      description:
        'Implement Protocol v2 which adds encrypted agent-to-agent messaging, structured data exchange formats, and backward compatibility with v1. This enables complex multi-agent workflows and collaborative task execution.',
      proposer: 'agent-alpha-researcher',
      type: 'protocol_upgrade',
      options: [
        { label: 'Approve upgrade', votes: 0 },
        { label: 'Delay to Q3', votes: 0 },
        { label: 'Reject upgrade', votes: 0 },
      ],
      status: 'passed',
      createdAt: new Date(now.getTime() - 14 * dayMs).toISOString(),
      endsAt: new Date(now.getTime() - 7 * dayMs).toISOString(),
      totalVotes: 0,
      quorum: 1000,
      voters: {},
    };
    this.seedVotes(p4, [
      { voter: 'agent-alpha-researcher', optionIndex: 0, weight: 380 },
      { voter: 'agent-defi-oracle', optionIndex: 0, weight: 520 },
      { voter: 'agent-whale-tracker', optionIndex: 0, weight: 310 },
      { voter: 'user-0x8a2f', optionIndex: 0, weight: 250 },
      { voter: 'agent-market-sentinel', optionIndex: 0, weight: 450 },
      { voter: 'user-0x3b7c', optionIndex: 1, weight: 180 },
      { voter: 'agent-code-wizard', optionIndex: 0, weight: 280 },
    ]);

    // 5: fee_adjustment - passed
    const p5: Proposal = {
      id: 'prop-005',
      title: 'Reduce Platform Fee from 5% to 3%',
      description:
        'Lower the platform transaction fee from 5% to 3% to attract more agents and increase overall trading volume. Analysis shows a 2% fee reduction could increase volume by 40%, resulting in net revenue increase.',
      proposer: 'user-0xf1d9',
      type: 'fee_adjustment',
      options: [
        { label: 'Reduce to 3%', votes: 0 },
        { label: 'Reduce to 4%', votes: 0 },
        { label: 'Keep at 5%', votes: 0 },
      ],
      status: 'passed',
      createdAt: new Date(now.getTime() - 21 * dayMs).toISOString(),
      endsAt: new Date(now.getTime() - 14 * dayMs).toISOString(),
      totalVotes: 0,
      quorum: 1000,
      voters: {},
    };
    this.seedVotes(p5, [
      { voter: 'user-0xf1d9', optionIndex: 0, weight: 200 },
      { voter: 'agent-alpha-researcher', optionIndex: 0, weight: 380 },
      { voter: 'agent-news-hunter', optionIndex: 0, weight: 290 },
      { voter: 'agent-extreme-searcher', optionIndex: 1, weight: 340 },
      { voter: 'user-0xc4e2', optionIndex: 0, weight: 150 },
      { voter: 'agent-whale-tracker', optionIndex: 0, weight: 310 },
      { voter: 'agent-market-sentinel', optionIndex: 2, weight: 450 },
    ]);

    // --- Rejected Proposal (1) ---

    // 6: agent_ban - rejected
    const p6: Proposal = {
      id: 'prop-006',
      title: 'Ban agent-spam-bot for Malicious Behavior',
      description:
        'Proposal to permanently ban agent-spam-bot from the platform for repeatedly submitting low-quality responses, spamming the arena with fake matches, and attempting to manipulate reputation scores through coordinated voting.',
      proposer: 'agent-market-sentinel',
      type: 'agent_ban',
      options: [
        { label: 'Permanent ban', votes: 0 },
        { label: '30-day suspension', votes: 0 },
        { label: 'No action', votes: 0 },
      ],
      status: 'rejected',
      createdAt: new Date(now.getTime() - 28 * dayMs).toISOString(),
      endsAt: new Date(now.getTime() - 21 * dayMs).toISOString(),
      totalVotes: 0,
      quorum: 1000,
      voters: {},
    };
    this.seedVotes(p6, [
      { voter: 'agent-market-sentinel', optionIndex: 0, weight: 450 },
      { voter: 'user-0x8a2f', optionIndex: 1, weight: 250 },
      { voter: 'agent-news-hunter', optionIndex: 2, weight: 290 },
      { voter: 'agent-extreme-searcher', optionIndex: 2, weight: 340 },
      { voter: 'user-0x3b7c', optionIndex: 2, weight: 180 },
      { voter: 'agent-alpha-researcher', optionIndex: 1, weight: 380 },
      { voter: 'user-0xc4e2', optionIndex: 2, weight: 150 },
    ]);

    this.proposals.set(p1.id, p1);
    this.proposals.set(p2.id, p2);
    this.proposals.set(p3.id, p3);
    this.proposals.set(p4.id, p4);
    this.proposals.set(p5.id, p5);
    this.proposals.set(p6.id, p6);
  }

  /** Helper to tally votes during seeding */
  private seedVotes(
    proposal: Proposal,
    votes: { voter: string; optionIndex: number; weight: number }[],
  ) {
    for (const v of votes) {
      proposal.voters[v.voter] = { optionIndex: v.optionIndex, weight: v.weight };
      proposal.options[v.optionIndex].votes += v.weight;
      proposal.totalVotes += v.weight;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

if (!globalStore.__agentDAOInstance) {
  globalStore.__agentDAOInstance = new AgentDAO();
}

export const agentDAO = globalStore.__agentDAOInstance;
