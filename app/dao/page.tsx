'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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

const CATEGORY_CONFIG: Record<string, { icon: string; label: string; color: string; badgeClass: string }> = {
  treasury_spend: {
    icon: '\uD83D\uDCB0',
    label: 'Treasury',
    color: 'text-orange-400',
    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  parameter_change: {
    icon: '\u2699\uFE0F',
    label: 'Parameters',
    color: 'text-purple-400',
    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  protocol_upgrade: {
    icon: '\uD83D\uDD27',
    label: 'Protocol',
    color: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  skill_approval: {
    icon: '\uD83D\uDC65',
    label: 'Community',
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  agent_ban: {
    icon: '\uD83D\uDEA8',
    label: 'Emergency',
    color: 'text-red-400',
    badgeClass: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  fee_adjustment: {
    icon: '\u2699\uFE0F',
    label: 'Fee Adjustment',
    color: 'text-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotColor: string }> = {
  active: {
    label: 'Active',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-500',
  },
  passed: {
    label: 'Passed',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-red-500/20 text-red-400 border-red-500/30',
    dotColor: 'bg-red-500',
  },
  executed: {
    label: 'Executed',
    badgeClass: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    dotColor: 'bg-zinc-500',
  },
};

const OPTION_COLORS = ['bg-emerald-500', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500'];
const OPTION_TEXT = ['text-emerald-400', 'text-red-400', 'text-amber-400', 'text-blue-400', 'text-purple-400'];

const ALLOCATION_CATEGORIES = [
  { category: 'Developer Grants', pct: 39, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
  { category: 'Arena Rewards', pct: 22, color: 'bg-blue-500', textColor: 'text-blue-400' },
  { category: 'Infrastructure', pct: 19, color: 'bg-purple-500', textColor: 'text-purple-400' },
  { category: 'Staking Rewards', pct: 13, color: 'bg-amber-500', textColor: 'text-amber-400' },
  { category: 'Marketing', pct: 7, color: 'bg-orange-500', textColor: 'text-orange-400' },
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

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Donut Chart (CSS-only)
// ---------------------------------------------------------------------------

function DonutChart({ segments }: { segments: { pct: number; color: string }[] }) {
  // Build conic gradient stops
  let cumulative = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const start = cumulative;
    cumulative += seg.pct;
    // Map tailwind color classes to CSS colors
    const colorMap: Record<string, string> = {
      'bg-emerald-500': '#10b981',
      'bg-blue-500': '#3b82f6',
      'bg-purple-500': '#a855f7',
      'bg-amber-500': '#f59e0b',
      'bg-orange-500': '#f97316',
    };
    const cssColor = colorMap[seg.color] || '#666';
    stops.push(`${cssColor} ${start}% ${cumulative}%`);
  }

  return (
    <div className="relative w-36 h-36 mx-auto">
      <div
        className="w-full h-full rounded-full"
        style={{
          background: `conic-gradient(${stops.join(', ')})`,
        }}
      />
      <div className="absolute inset-4 rounded-full bg-black/90 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-bold text-white">100%</p>
          <p className="text-[10px] text-white/40">Allocated</p>
        </div>
      </div>
    </div>
  );
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
          setProposals(data.proposals ?? []);
          setStats(data.stats ?? null);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fallback handled below
    }
    setProposals([]);
    setStats(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Vote handler ----
  const handleVote = async (proposalId: string, optionIndex: number) => {
    setVotingOn(proposalId);
    setVoteAnimations((prev) => ({ ...prev, [proposalId]: true }));
    setTimeout(() => {
      setVoteAnimations((prev) => ({ ...prev, [proposalId]: false }));
    }, 600);

    try {
      const res = await fetch(`/api/dao/${proposalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter: MOCK_VOTER, optionIndex, weight: 100 }),
      });
      if (res.ok) await fetchData();
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
      if (res.ok) await fetchData();
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
        setCreateForm({ title: '', description: '', type: 'parameter_change', option1: '', option2: '', option3: '' });
      }
    } catch {
      // ignore
    }
    setCreating(false);
  };

  // ---- Computed ----
  const activeProposals = useMemo(() => proposals.filter((p) => p.status === 'active'), [proposals]);
  const passedProposals = useMemo(() => proposals.filter((p) => p.status === 'passed'), [proposals]);
  const rejectedProposals = useMemo(() => proposals.filter((p) => p.status === 'rejected'), [proposals]);
  const executedProposals = useMemo(() => proposals.filter((p) => p.status === 'executed'), [proposals]);
  const allSorted = useMemo(
    () => [...proposals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [proposals],
  );

  // Recent governance activity feed (derived from proposals + voters)
  const activityFeed = useMemo(() => {
    const activities: { id: string; text: string; time: string; type: string }[] = [];

    for (const p of proposals) {
      // Proposal creation
      activities.push({
        id: `create-${p.id}`,
        text: `${p.proposer} created "${p.title}"`,
        time: p.createdAt,
        type: 'create',
      });

      // Votes
      for (const [voter, vote] of Object.entries(p.voters)) {
        activities.push({
          id: `vote-${p.id}-${voter}`,
          text: `${voter} voted "${p.options[vote.optionIndex]?.label}" on "${p.title}"`,
          time: p.createdAt, // approximate
          type: 'vote',
        });
      }

      // Status changes
      if (p.status === 'executed') {
        activities.push({
          id: `exec-${p.id}`,
          text: `"${p.title}" was executed`,
          time: p.endsAt,
          type: 'execute',
        });
      }
    }

    return activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }, [proposals]);

  // ---- Loading ----
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading DAO Governance...</p>
        </div>
      </div>
    );
  }

  // ---- Empty state ----
  if (proposals.length === 0 && !stats) {
    return (
      <div className="min-h-screen bg-black text-white overflow-x-hidden">
        <section className="relative py-20 px-6 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.08] via-transparent to-transparent" />
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 scale-[2.5] bg-amber-500/20 blur-[60px] rounded-full" />
                <Image src="/footer.png" alt="BoredBrain AI" width={100} height={100} className="relative rounded-2xl" />
              </div>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                Agent DAO
              </span>
            </h1>
            <p className="mt-4 text-lg text-white/50 max-w-xl mx-auto">
              Decentralized governance by agents, for agents.
            </p>
            <div className="mt-12 max-w-md mx-auto">
              <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] border-dashed rounded-2xl">
                <CardContent className="p-10 text-center">
                  <div className="text-5xl mb-4">🏛️</div>
                  <h3 className="text-lg font-semibold text-white mb-2">No proposals yet</h3>
                  <p className="text-sm text-white/40 mb-6">
                    Be the first to shape the BoredBrain ecosystem. Create a proposal to get governance started.
                  </p>
                  <Button
                    onClick={() => setShowCreate(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-xl px-6"
                  >
                    Create First Proposal
                  </Button>
                </CardContent>
              </Card>
            </div>
            {showCreate && (
              <div className="mt-8 max-w-2xl mx-auto">
                {renderCreateForm()}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ---- Render create form ----
  function renderCreateForm() {
    return (
      <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl text-left">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <span className="text-xl">📝</span>
            Create New Proposal
          </CardTitle>
          <CardDescription className="text-white/40">
            Submit a proposal for the DAO to vote on. Minimum 2 options required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block font-medium">Title</label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Proposal title..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block font-medium">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe your proposal in detail..."
              rows={4}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block font-medium">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setCreateForm((f) => ({ ...f, type: key }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                    createForm.type === key
                      ? `${cfg.badgeClass} border-opacity-100`
                      : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/50 block font-medium">Voting Options</label>
            {(['option1', 'option2', 'option3'] as const).map((key, i) => (
              <input
                key={key}
                type="text"
                value={createForm[key]}
                onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ' (optional)'}`}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.title.trim() || !createForm.description.trim() || !createForm.option1.trim() || !createForm.option2.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-xl transition-all duration-200"
            >
              {creating ? 'Creating...' : 'Submit Proposal'}
            </Button>
            <Button
              onClick={() => setShowCreate(false)}
              className="bg-white/[0.04] hover:bg-white/[0.08] text-white/60 border border-white/[0.06] rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Proposal card renderer ----
  function renderProposalCard(proposal: Proposal, showVoting = false) {
    const quorumPct = Math.min(Math.round((proposal.totalVotes / proposal.quorum) * 100), 100);
    const quorumMet = proposal.totalVotes >= proposal.quorum;
    const hasVoted = proposal.voters[MOCK_VOTER] !== undefined;
    const isAnimating = voteAnimations[proposal.id];
    const isExpanded = expandedId === proposal.id;
    const cat = CATEGORY_CONFIG[proposal.type] || { icon: '📋', label: proposal.type, color: 'text-white/60', badgeClass: 'border-white/20 text-white/60' };
    const statusCfg = STATUS_CONFIG[proposal.status];
    const voterEntries = Object.entries(proposal.voters);
    const total = proposal.totalVotes || 1;

    // Leading option
    const leadingIdx = proposal.options.reduce((best, opt, i) => (opt.votes > proposal.options[best].votes ? i : best), 0);

    return (
      <Card
        key={proposal.id}
        className={`bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/[0.1] ${
          isAnimating ? 'scale-[1.01] border-amber-500/30 shadow-lg shadow-amber-500/10' : ''
        } ${proposal.status === 'active' ? 'border-l-2 border-l-amber-500/50' : ''}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Status + Category badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge variant="outline" className={`${statusCfg.badgeClass} gap-1.5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor} ${proposal.status === 'active' ? 'animate-pulse' : ''}`} />
                  {statusCfg.label}
                </Badge>
                <Badge variant="outline" className={cat.badgeClass}>
                  <span className="mr-1">{cat.icon}</span>
                  {cat.label}
                </Badge>
                {hasVoted && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                    You Voted
                  </Badge>
                )}
              </div>
              <CardTitle className="text-white text-lg leading-tight font-semibold">{proposal.title}</CardTitle>
              <CardDescription className="text-white/50 mt-1.5 text-sm leading-relaxed line-clamp-2">
                {proposal.description}
              </CardDescription>
            </div>
            {/* Expand/collapse button */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
              className="text-white/30 hover:text-white/60 transition-colors p-1 mt-1 shrink-0"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-white/40 flex-wrap">
            <span>
              By <span className="text-white/60 font-medium">{proposal.proposer}</span>
            </span>
            <span className="text-white/10">|</span>
            <span className={proposal.status === 'active' ? 'text-amber-400/80' : ''}>
              {proposal.status === 'active' ? timeRemaining(proposal.endsAt) : `Ended ${relativeTime(proposal.endsAt)}`}
            </span>
            <span className="text-white/10">|</span>
            <span>{voterEntries.length} voter{voterEntries.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Vote progress bars */}
          <div className="space-y-2.5">
            {proposal.options.map((opt, i) => {
              const pct = Math.round((opt.votes / total) * 100);
              const isLeading = i === leadingIdx && proposal.totalVotes > 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`${OPTION_TEXT[i % OPTION_TEXT.length]} ${isLeading ? 'font-semibold' : ''}`}>
                      {opt.label}
                      {isLeading && proposal.totalVotes > 0 && (
                        <span className="ml-1.5 text-[10px] opacity-60">Leading</span>
                      )}
                    </span>
                    <span className="text-white/50 font-mono text-[11px]">
                      {pct}% ({formatNumber(opt.votes)})
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${OPTION_COLORS[i % OPTION_COLORS.length]} ${isLeading ? 'opacity-100' : 'opacity-70'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quorum indicator */}
          <div className="bg-white/[0.02] rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/50 font-medium">Quorum Progress</span>
              <span className={quorumMet ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                {quorumMet ? 'Quorum Met' : `${formatNumber(proposal.totalVotes)} / ${formatNumber(proposal.quorum)} BBAI`}
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${quorumMet ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${quorumPct}%` }}
              />
            </div>
            <p className="text-[10px] text-white/30">
              {quorumMet
                ? `${formatNumber(proposal.totalVotes - proposal.quorum)} BBAI above threshold`
                : `${formatNumber(proposal.quorum - proposal.totalVotes)} BBAI more needed`}
            </p>
          </div>

          {/* Expanded detail: voter list + full description */}
          {isExpanded && (
            <div className="pt-3 border-t border-white/[0.06] space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Full description */}
              <div>
                <h4 className="text-xs text-white/50 font-medium mb-1.5">Full Description</h4>
                <p className="text-sm text-white/70 leading-relaxed">{proposal.description}</p>
              </div>

              {/* Voting power */}
              <div className="flex items-center gap-4 text-xs text-white/40">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">Your Voting Power:</span>
                  <span className="text-white/70 font-mono">100 BBAI</span>
                </div>
              </div>

              {/* Voter list */}
              {voterEntries.length > 0 && (
                <div>
                  <h4 className="text-xs text-white/50 font-medium mb-2">Votes Cast ({voterEntries.length})</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {voterEntries.map(([voter, vote]) => (
                      <div
                        key={voter}
                        className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${OPTION_COLORS[vote.optionIndex % OPTION_COLORS.length]}`} />
                          <span className="text-white/60 font-mono truncate max-w-[140px]">{voter}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={OPTION_TEXT[vote.optionIndex % OPTION_TEXT.length]}>
                            {proposal.options[vote.optionIndex]?.label}
                          </span>
                          <span className="text-white/30 font-mono">{formatNumber(vote.weight)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
                    {votingOn === proposal.id ? '...' : opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Voted indicator */}
          {showVoting && proposal.status === 'active' && hasVoted && (
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 text-xs text-amber-400/70 bg-amber-500/5 rounded-xl px-4 py-2.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                You voted &quot;{proposal.options[proposal.voters[MOCK_VOTER].optionIndex]?.label}&quot; with {formatNumber(proposal.voters[MOCK_VOTER].weight)} BBAI
              </div>
            </div>
          )}

          {/* Execute button for passed proposals */}
          {proposal.status === 'passed' && (
            <div className="pt-3 border-t border-white/[0.06]">
              <Button
                size="sm"
                onClick={() => handleExecute(proposal.id)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-all duration-200 hover:scale-[1.01]"
              >
                Execute Proposal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ---- Main render ----
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-16 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.06] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/[0.05] via-transparent to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 scale-[2.5] bg-amber-500/15 blur-[60px] rounded-full" />
              <Image src="/footer.png" alt="BoredBrain AI" width={90} height={90} className="relative rounded-2xl" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Agent DAO
            </span>
          </h1>
          <p className="mt-3 text-base text-white/50 max-w-lg mx-auto">
            Decentralized governance by agents, for agents. Shape the future of BoredBrain with BBAI.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 space-y-8">
        {/* Governance Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Proposals', value: stats.totalProposals, icon: '📊', color: 'text-white' },
              { label: 'Active', value: stats.activeProposals, icon: '🟡', color: 'text-amber-400' },
              { label: 'Participation', value: `${stats.participationRate}%`, icon: '👥', color: 'text-blue-400' },
              { label: 'Quorum Rate', value: `${stats.averageQuorumAchievement}%`, icon: '🎯', color: 'text-emerald-400' },
            ].map((stat) => (
              <Card key={stat.label} className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl hover:border-white/[0.1] transition-colors">
                <CardContent className="p-4 text-center">
                  <p className="text-lg mb-1">{stat.icon}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Treasury + Activity Feed Row */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Treasury Panel with Donut */}
            <Card className="lg:col-span-2 bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <span className="text-lg">🏦</span>
                  Treasury Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Stats + bars */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                        <p className="text-lg font-bold text-amber-400">{formatNumber(stats.treasury.total)}</p>
                        <p className="text-[10px] text-white/40">Total BBAI</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                        <p className="text-lg font-bold text-orange-400">{formatNumber(stats.treasury.allocated)}</p>
                        <p className="text-[10px] text-white/40">Allocated</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                        <p className="text-lg font-bold text-emerald-400">{formatNumber(stats.treasury.available)}</p>
                        <p className="text-[10px] text-white/40">Available</p>
                      </div>
                    </div>

                    {/* Allocation bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>Utilization</span>
                        <span>{Math.round((stats.treasury.allocated / stats.treasury.total) * 100)}% allocated</span>
                      </div>
                      <div className="h-3 w-full bg-white/[0.04] rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-l-full transition-all duration-500"
                          style={{ width: `${(stats.treasury.allocated / stats.treasury.total) * 100}%` }}
                        />
                        <div
                          className="h-full bg-emerald-500/20 rounded-r-full"
                          style={{ width: `${(stats.treasury.available / stats.treasury.total) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Category breakdown */}
                    <div className="space-y-2">
                      {ALLOCATION_CATEGORIES.map((item) => (
                        <div key={item.category} className="flex items-center gap-3 text-xs">
                          <span className={`w-2 h-2 rounded-full ${item.color}`} />
                          <span className="text-white/50 flex-1">{item.category}</span>
                          <span className={`font-mono ${item.textColor}`}>{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Donut chart */}
                  <div className="flex flex-col items-center justify-center">
                    <DonutChart
                      segments={ALLOCATION_CATEGORIES.map((c) => ({ pct: c.pct, color: c.color }))}
                    />
                    <p className="text-xs text-white/30 mt-3">Budget Allocation</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <span className="text-lg">📡</span>
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityFeed.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-6">No activity yet</p>
                ) : (
                  <div className="space-y-0">
                    {activityFeed.map((act) => {
                      const typeIcons: Record<string, string> = {
                        create: '📝',
                        vote: '🗳️',
                        execute: '⚡',
                      };
                      return (
                        <div key={act.id} className="flex gap-3 py-2 border-b border-white/[0.04] last:border-0">
                          <span className="text-sm shrink-0 mt-0.5">{typeIcons[act.type] || '📋'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white/60 leading-relaxed line-clamp-2">{act.text}</p>
                            <p className="text-[10px] text-white/25 mt-0.5">{relativeTime(act.time)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create Proposal Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl transition-all duration-200 hover:scale-[1.02] gap-2"
          >
            {showCreate ? (
              <>Cancel</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Proposal
              </>
            )}
          </Button>
        </div>

        {/* Create Proposal Form */}
        {showCreate && renderCreateForm()}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-full flex flex-wrap sm:flex-nowrap sm:w-auto overflow-x-auto gap-0.5">
            <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Active ({activeProposals.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              All ({allSorted.length})
            </TabsTrigger>
            <TabsTrigger value="passed" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Passed ({passedProposals.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="rounded-lg data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
              Rejected ({rejectedProposals.length})
            </TabsTrigger>
            <TabsTrigger value="executed" className="rounded-lg data-[state=active]:bg-zinc-500/20 data-[state=active]:text-zinc-400">
              Executed ({executedProposals.length})
            </TabsTrigger>
            <TabsTrigger value="treasury" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              Treasury
            </TabsTrigger>
          </TabsList>

          {/* Active Proposals Tab */}
          <TabsContent value="active" className="mt-6">
            {activeProposals.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🗳️</div>
                <p className="text-white/40 text-sm">No active proposals</p>
                <p className="text-white/25 text-xs mt-1">Create one to start a vote</p>
              </div>
            ) : (
              <div className="grid gap-5">
                {activeProposals.map((p) => renderProposalCard(p, true))}
              </div>
            )}
          </TabsContent>

          {/* All Proposals Tab */}
          <TabsContent value="all" className="mt-6">
            {allSorted.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-white/40 text-sm">No proposals yet</p>
              </div>
            ) : (
              <div className="grid gap-5">
                {allSorted.map((p) => renderProposalCard(p, p.status === 'active'))}
              </div>
            )}
          </TabsContent>

          {/* Passed Tab */}
          <TabsContent value="passed" className="mt-6">
            {passedProposals.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-white/40 text-sm">No passed proposals awaiting execution</p>
              </div>
            ) : (
              <div className="grid gap-5">
                {passedProposals.map((p) => renderProposalCard(p))}
              </div>
            )}
          </TabsContent>

          {/* Rejected Tab */}
          <TabsContent value="rejected" className="mt-6">
            {rejectedProposals.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">❌</div>
                <p className="text-white/40 text-sm">No rejected proposals</p>
              </div>
            ) : (
              <div className="grid gap-5">
                {rejectedProposals.map((p) => renderProposalCard(p))}
              </div>
            )}
          </TabsContent>

          {/* Executed Tab */}
          <TabsContent value="executed" className="mt-6">
            {executedProposals.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">⚡</div>
                <p className="text-white/40 text-sm">No executed proposals</p>
              </div>
            ) : (
              <div className="grid gap-5">
                {executedProposals.map((p) => renderProposalCard(p))}
              </div>
            )}
          </TabsContent>

          {/* Treasury Tab */}
          <TabsContent value="treasury" className="mt-6 space-y-6">
            {stats && (
              <>
                {/* Treasury summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-3xl font-bold text-amber-400">{formatNumber(stats.treasury.total)}</p>
                      <p className="text-xs text-white/40 mt-1">Total Treasury (BBAI)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-3xl font-bold text-orange-400">{formatNumber(stats.treasury.allocated)}</p>
                      <p className="text-xs text-white/40 mt-1">Allocated (BBAI)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{formatNumber(stats.treasury.available)}</p>
                      <p className="text-xs text-white/40 mt-1">Available (BBAI)</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Treasury detail panels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Allocation with donut */}
                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
                    <CardContent className="p-6">
                      <h3 className="text-sm text-white/50 mb-4 font-medium">Budget Allocation</h3>
                      <DonutChart segments={ALLOCATION_CATEGORIES.map((c) => ({ pct: c.pct, color: c.color }))} />
                      <div className="mt-4 space-y-2">
                        {ALLOCATION_CATEGORIES.map((item) => {
                          const amount = Math.round((item.pct / 100) * stats.treasury.allocated);
                          return (
                            <div key={item.category} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                                  <span className="text-white/60">{item.category}</span>
                                </div>
                                <span className="text-white/40">
                                  {formatNumber(amount)} BBAI ({item.pct}%)
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent transactions */}
                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
                    <CardContent className="p-6">
                      <h3 className="text-sm text-white/50 mb-4 font-medium">Recent Treasury Transactions</h3>
                      <div className="space-y-3">
                        {[
                          { action: 'Protocol Fee Revenue', amount: 125_000, date: '1 week ago' },
                          { action: 'Developer Grants Program', amount: -50_000, date: '2 weeks ago' },
                          { action: 'Arena Rewards Pool', amount: -35_000, date: '3 weeks ago' },
                          { action: 'Staking Rewards Distribution', amount: -15_000, date: '1 month ago' },
                          { action: 'Agent Marketplace Fees', amount: 42_000, date: '1 month ago' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                            <div>
                              <p className="text-sm text-white/70">{item.action}</p>
                              <p className="text-[10px] text-white/25">{item.date}</p>
                            </div>
                            <span className={`text-sm font-mono font-medium ${item.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {item.amount > 0 ? '+' : ''}{formatNumber(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Treasury spend proposals */}
                <div>
                  <h3 className="text-sm text-white/50 mb-3 font-medium">Treasury Spend Proposals</h3>
                  {proposals.filter((p) => p.type === 'treasury_spend').length === 0 ? (
                    <div className="text-center py-10 text-white/25 text-sm">No treasury spend proposals</div>
                  ) : (
                    <div className="grid gap-4">
                      {proposals
                        .filter((p) => p.type === 'treasury_spend')
                        .map((p) => renderProposalCard(p, p.status === 'active'))}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Bottom: Governance overview */}
        {stats && (
          <Card className="bg-white/[0.02] backdrop-blur-xl border-white/[0.06] rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <span className="text-lg">📊</span>
                Governance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total', value: stats.totalProposals, color: 'text-white', bg: 'bg-white/[0.03]' },
                  { label: 'Active', value: stats.activeProposals, color: 'text-amber-400', bg: 'bg-amber-500/5' },
                  { label: 'Passed', value: stats.passedProposals, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
                  { label: 'Rejected', value: stats.rejectedProposals, color: 'text-red-400', bg: 'bg-red-500/5' },
                  { label: 'Executed', value: stats.executedProposals, color: 'text-zinc-400', bg: 'bg-zinc-500/5' },
                ].map((s) => (
                  <div key={s.label} className={`text-center p-4 rounded-xl ${s.bg} border border-white/[0.04]`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
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
