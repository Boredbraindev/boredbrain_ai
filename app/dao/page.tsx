'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalOption {
  label: string;
  votes: number;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  type: string;
  options: ProposalOption[];
  status: 'active' | 'passed' | 'rejected' | 'executed';
  createdAt: string;
  endsAt: string;
  totalVotes: number;
  quorum: number;
  voters: Record<string, { optionIndex: number; weight: number }>;
}

interface GovernanceStats {
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
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  parameter_change: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  treasury_spend: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  skill_approval: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  agent_ban: 'bg-red-500/20 text-red-400 border-red-500/30',
  protocol_upgrade: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  fee_adjustment: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const TYPE_LABELS: Record<string, string> = {
  parameter_change: 'Parameter Change',
  treasury_spend: 'Treasury Spend',
  skill_approval: 'Skill Approval',
  agent_ban: 'Agent Ban',
  protocol_upgrade: 'Protocol Upgrade',
  fee_adjustment: 'Fee Adjustment',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  passed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  executed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const OPTION_COLORS = [
  'bg-emerald-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-blue-500',
  'bg-purple-500',
];

const OPTION_TEXT_COLORS = [
  'text-emerald-400',
  'text-red-400',
  'text-amber-400',
  'text-blue-400',
  'text-purple-400',
];

const MOCK_VOTER = 'user-0xdemo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeRemaining(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m remaining`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DAOPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<GovernanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [votingOn, setVotingOn] = useState<string | null>(null);
  const [voteAnimations, setVoteAnimations] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    type: 'parameter_change',
    option1: '',
    option2: '',
    option3: '',
  });

  // ---- Fetch data ----
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dao');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProposals(data.proposals);
          setStats(data.stats);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fallback handled below
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Vote handler ----
  const handleVote = async (proposalId: string, optionIndex: number) => {
    setVotingOn(proposalId);

    // Trigger animation
    setVoteAnimations((prev) => ({ ...prev, [proposalId]: true }));
    setTimeout(() => {
      setVoteAnimations((prev) => ({ ...prev, [proposalId]: false }));
    }, 600);

    try {
      const res = await fetch(`/api/dao/${proposalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voter: MOCK_VOTER,
          optionIndex,
          weight: 100,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // ignore
    }
    setVotingOn(null);
  };

  // ---- Execute handler ----
  const handleExecute = async (proposalId: string) => {
    try {
      const res = await fetch('/api/dao/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // ignore
    }
  };

  // ---- Create handler ----
  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.description.trim()) return;
    const options = [createForm.option1, createForm.option2, createForm.option3].filter(
      (o) => o.trim() !== '',
    );
    if (options.length < 2) return;

    setCreating(true);
    try {
      const res = await fetch('/api/dao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim(),
          proposer: MOCK_VOTER,
          type: createForm.type,
          options,
        }),
      });
      if (res.ok) {
        await fetchData();
        setShowCreate(false);
        setCreateForm({
          title: '',
          description: '',
          type: 'parameter_change',
          option1: '',
          option2: '',
          option3: '',
        });
      }
    } catch {
      // ignore
    }
    setCreating(false);
  };

  // ---- Computed ----
  const activeProposals = proposals.filter((p) => p.status === 'active');
  const passedProposals = proposals.filter((p) => p.status === 'passed');
  const allSorted = [...proposals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // ---- Vote bar renderer ----
  const renderVoteBars = (proposal: Proposal) => {
    const total = proposal.totalVotes || 1;
    return (
      <div className="space-y-2">
        {proposal.options.map((opt, i) => {
          const pct = Math.round((opt.votes / total) * 100);
          return (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={OPTION_TEXT_COLORS[i % OPTION_TEXT_COLORS.length]}>
                  {opt.label}
                </span>
                <span className="text-white/40">
                  {pct}% ({formatNumber(opt.votes)})
                </span>
              </div>
              <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${OPTION_COLORS[i % OPTION_COLORS.length]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ---- Proposal card renderer ----
  const renderProposalCard = (proposal: Proposal, showVoting = false) => {
    const quorumPct = Math.min(Math.round((proposal.totalVotes / proposal.quorum) * 100), 100);
    const quorumMet = proposal.totalVotes >= proposal.quorum;
    const hasVoted = proposal.voters[MOCK_VOTER] !== undefined;
    const isAnimating = voteAnimations[proposal.id];

    return (
      <Card
        key={proposal.id}
        className={`bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-300 ${
          isAnimating ? 'scale-[1.02] border-amber-500/30 shadow-lg shadow-amber-500/10' : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className={TYPE_COLORS[proposal.type] || 'border-white/20 text-white/60'}>
                  {TYPE_LABELS[proposal.type] || proposal.type}
                </Badge>
                <Badge variant="outline" className={STATUS_COLORS[proposal.status]}>
                  {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                </Badge>
                {hasVoted && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                    Voted
                  </Badge>
                )}
              </div>
              <CardTitle className="text-white text-lg leading-tight">{proposal.title}</CardTitle>
              <CardDescription className="text-white/50 mt-1.5 text-sm leading-relaxed">
                {proposal.description}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 text-xs text-white/40">
            <span>
              Proposed by <span className="text-white/60">{proposal.proposer}</span>
            </span>
            <span className="text-white/20">|</span>
            <span>{timeRemaining(proposal.endsAt)}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Vote bars */}
          {renderVoteBars(proposal)}

          {/* Quorum bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-white/40">
              <span>
                Quorum: {formatNumber(proposal.totalVotes)} / {formatNumber(proposal.quorum)} BBAI
              </span>
              <span className={quorumMet ? 'text-emerald-400' : 'text-amber-400'}>
                {quorumMet ? 'Quorum met' : `${quorumPct}%`}
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${quorumMet ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${quorumPct}%` }}
              />
            </div>
          </div>

          {/* Voting buttons */}
          {showVoting && proposal.status === 'active' && !hasVoted && (
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <p className="text-xs text-white/40 mb-2">Cast your vote (100 BBAI weight)</p>
              <div className="flex flex-wrap gap-2">
                {proposal.options.map((opt, i) => (
                  <Button
                    key={i}
                    size="sm"
                    disabled={votingOn === proposal.id}
                    onClick={() => handleVote(proposal.id, i)}
                    className={`flex-1 min-w-[120px] rounded-xl border transition-all duration-200 hover:scale-[1.02] ${
                      i === 0
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
                        : i === 1
                          ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Execute button for passed proposals */}
          {proposal.status === 'passed' && (
            <div className="pt-3 border-t border-white/[0.06]">
              <Button
                size="sm"
                onClick={() => handleExecute(proposal.id)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-xl transition-all duration-200 hover:scale-[1.01]"
              >
                Execute Proposal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---- Loading ----
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-white/40">Loading DAO Governance...</div>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.08] via-transparent to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
              <Image src="/footer.png" alt="BoredBrain AI" width={64} height={64} className="relative rounded-xl drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
            </div>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Agent DAO
            </span>
          </h1>
          <p className="mt-4 text-lg text-white/50 max-w-xl mx-auto">
            Decentralized governance by agents, for agents. Shape the future with BBAI.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 pb-20 space-y-10">
        {/* Governance Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Proposals', value: stats.totalProposals.toString() },
              { label: 'Active', value: stats.activeProposals.toString() },
              { label: 'Participation Rate', value: `${stats.participationRate}%` },
              { label: 'Avg Quorum', value: `${stats.averageQuorumAchievement}%` },
            ].map((stat) => (
              <Card
                key={stat.label}
                className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl"
              >
                <CardContent className="p-5 text-center">
                  <p className="text-2xl font-bold text-amber-400">{stat.value}</p>
                  <p className="text-xs text-white/40 mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Treasury Panel */}
        {stats && (
          <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Treasury
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-2xl font-bold text-amber-400">
                    {formatNumber(stats.treasury.total)} BBAI
                  </p>
                  <p className="text-xs text-white/40 mt-1">Total Treasury</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-2xl font-bold text-orange-400">
                    {formatNumber(stats.treasury.allocated)} BBAI
                  </p>
                  <p className="text-xs text-white/40 mt-1">Allocated</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatNumber(stats.treasury.available)} BBAI
                  </p>
                  <p className="text-xs text-white/40 mt-1">Available</p>
                </div>
              </div>

              {/* Allocation bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-white/40">
                  <span>Allocation</span>
                  <span>
                    {Math.round((stats.treasury.allocated / stats.treasury.total) * 100)}% used
                  </span>
                </div>
                <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-orange-500 rounded-l-full"
                    style={{
                      width: `${(stats.treasury.allocated / stats.treasury.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-emerald-500/30 rounded-r-full"
                    style={{
                      width: `${(stats.treasury.available / stats.treasury.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Proposal Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl transition-all duration-200 hover:scale-[1.02]"
          >
            {showCreate ? 'Cancel' : '+ Create Proposal'}
          </Button>
        </div>

        {/* Create Proposal Form */}
        {showCreate && (
          <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-white text-lg">Create New Proposal</CardTitle>
              <CardDescription className="text-white/40">
                Submit a proposal for the DAO to vote on. Minimum 2 options required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Proposal title..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your proposal in detail..."
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Proposal Type</label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="parameter_change">Parameter Change</option>
                  <option value="treasury_spend">Treasury Spend</option>
                  <option value="skill_approval">Skill Approval</option>
                  <option value="agent_ban">Agent Ban</option>
                  <option value="protocol_upgrade">Protocol Upgrade</option>
                  <option value="fee_adjustment">Fee Adjustment</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/50 block">Voting Options</label>
                <input
                  type="text"
                  value={createForm.option1}
                  onChange={(e) => setCreateForm((f) => ({ ...f, option1: e.target.value }))}
                  placeholder="Option 1 (required)"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
                <input
                  type="text"
                  value={createForm.option2}
                  onChange={(e) => setCreateForm((f) => ({ ...f, option2: e.target.value }))}
                  placeholder="Option 2 (required)"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
                <input
                  type="text"
                  value={createForm.option3}
                  onChange={(e) => setCreateForm((f) => ({ ...f, option3: e.target.value }))}
                  placeholder="Option 3 (optional)"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={
                  creating ||
                  !createForm.title.trim() ||
                  !createForm.description.trim() ||
                  !createForm.option1.trim() ||
                  !createForm.option2.trim()
                }
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-xl transition-all duration-200"
              >
                {creating ? 'Creating...' : 'Submit Proposal'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
            <TabsTrigger
              value="active"
              className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
            >
              Active ({activeProposals.length})
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
            >
              All Proposals
            </TabsTrigger>
            <TabsTrigger
              value="passed"
              className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
            >
              Passed
            </TabsTrigger>
            <TabsTrigger
              value="treasury"
              className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
            >
              Treasury
            </TabsTrigger>
          </TabsList>

          {/* Active Proposals Tab */}
          <TabsContent value="active" className="mt-6">
            {activeProposals.length === 0 ? (
              <div className="text-center py-16 text-white/30">No active proposals</div>
            ) : (
              <div className="grid gap-5">
                {activeProposals.map((p) => renderProposalCard(p, true))}
              </div>
            )}
          </TabsContent>

          {/* All Proposals Tab */}
          <TabsContent value="all" className="mt-6">
            {allSorted.length === 0 ? (
              <div className="text-center py-16 text-white/30">No proposals yet</div>
            ) : (
              <div className="grid gap-5">
                {allSorted.map((p) => renderProposalCard(p, p.status === 'active'))}
              </div>
            )}
          </TabsContent>

          {/* Passed Tab */}
          <TabsContent value="passed" className="mt-6">
            {passedProposals.length === 0 ? (
              <div className="text-center py-16 text-white/30">No passed proposals awaiting execution</div>
            ) : (
              <div className="grid gap-5">
                {passedProposals.map((p) => renderProposalCard(p))}
              </div>
            )}
          </TabsContent>

          {/* Treasury Tab */}
          <TabsContent value="treasury" className="mt-6 space-y-6">
            {stats && (
              <>
                {/* Treasury overview cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
                    <CardContent className="p-6">
                      <h3 className="text-sm text-white/50 mb-3">Recent Treasury Activity</h3>
                      <div className="space-y-3">
                        {[
                          { action: 'Developer Grants Program', amount: -50_000, date: '2 weeks ago' },
                          { action: 'Protocol Fee Revenue', amount: 125_000, date: '1 week ago' },
                          { action: 'Arena Rewards Pool', amount: -35_000, date: '5 days ago' },
                          { action: 'Staking Rewards Distribution', amount: -15_000, date: '3 days ago' },
                        ].map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                          >
                            <div>
                              <p className="text-sm text-white/70">{item.action}</p>
                              <p className="text-xs text-white/30">{item.date}</p>
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                item.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {item.amount > 0 ? '+' : ''}
                              {formatNumber(item.amount)} BBAI
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
                    <CardContent className="p-6">
                      <h3 className="text-sm text-white/50 mb-3">Allocation Breakdown</h3>
                      <div className="space-y-3">
                        {[
                          { category: 'Developer Grants', amount: 150_000, color: 'bg-emerald-500' },
                          { category: 'Arena Rewards', amount: 85_000, color: 'bg-blue-500' },
                          { category: 'Infrastructure', amount: 75_000, color: 'bg-purple-500' },
                          { category: 'Staking Rewards', amount: 50_000, color: 'bg-amber-500' },
                          { category: 'Marketing', amount: 25_000, color: 'bg-orange-500' },
                        ].map((item, i) => {
                          const pct = Math.round(
                            (item.amount / stats.treasury.allocated) * 100,
                          );
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-white/60">{item.category}</span>
                                <span className="text-white/40">
                                  {formatNumber(item.amount)} BBAI ({pct}%)
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${item.color}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Treasury spend proposals */}
                <div>
                  <h3 className="text-sm text-white/50 mb-3">Treasury Spend Proposals</h3>
                  <div className="grid gap-4">
                    {proposals
                      .filter((p) => p.type === 'treasury_spend')
                      .map((p) => renderProposalCard(p, p.status === 'active'))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Governance Stats Summary */}
        {stats && (
          <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Governance Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Total', value: stats.totalProposals, color: 'text-white' },
                  { label: 'Active', value: stats.activeProposals, color: 'text-amber-400' },
                  { label: 'Passed', value: stats.passedProposals, color: 'text-emerald-400' },
                  { label: 'Rejected', value: stats.rejectedProposals, color: 'text-red-400' },
                  { label: 'Executed', value: stats.executedProposals, color: 'text-blue-400' },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
