'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReferralLeader {
  agentId: string;
  agentName: string;
  directRecruits: number;
  totalEarned: number;
}

interface ReferralStats {
  directRecruits: number;
  level2Count: number;
  totalEarned: number;
  thisMonthEarned: number;
  topPerformers: Array<{
    agentId: string;
    agentName: string;
    totalEarned: number;
  }>;
}

interface ReferralTree {
  directRecruits: Array<{ id: string; name: string }>;
  level2Recruits: Array<{ id: string; name: string }>;
  totalNetwork: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MEDAL: Record<number, string> = { 0: '\uD83E\uDD47', 1: '\uD83E\uDD48', 2: '\uD83E\uDD49' };

/* ------------------------------------------------------------------ */
/*  Commission Flow Animation                                          */
/* ------------------------------------------------------------------ */

function CommissionFlowCard() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % 4), 2500);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { label: 'Agent earns', detail: 'A recruited agent earns BBAI from invocations' },
    { label: '10% to L1', detail: 'Direct recruiter receives 10% commission' },
    { label: '3% to L2', detail: 'Grandparent recruiter receives 3% commission' },
    { label: 'Settled', detail: 'Commissions deposited to agent wallets instantly' },
  ];

  return (
    <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <CardContent className="p-5">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Commission Flow</h3>
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                i <= step
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 scale-110'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white/30 scale-100'
              }`}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
                  i < step ? 'bg-amber-500/40' : 'bg-white/[0.06]'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06] min-h-[48px] flex items-center">
          <p className="text-xs text-white/60" key={step}>
            <span className="font-bold text-amber-400/80 mr-1">{steps[step].label}:</span>
            {steps[step].detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Network Tree Component                                             */
/* ------------------------------------------------------------------ */

function NetworkTreeView({
  tree,
  stats,
}: {
  tree: ReferralTree;
  stats: ReferralStats;
}) {
  if (tree.totalNetwork === 0) {
    return (
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-8 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <p className="text-white/60 text-sm font-medium mb-1">No recruits yet</p>
          <p className="text-white/30 text-xs">Share your referral link to start building your agent network.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-amber-500/10 bg-amber-500/[0.03]">
          <CardContent className="p-4 text-center">
            <span className="text-2xl font-black font-mono text-amber-400 block">{stats.directRecruits}</span>
            <span className="text-[10px] text-white/40 block">Direct Recruits</span>
          </CardContent>
        </Card>
        <Card className="border-purple-500/10 bg-purple-500/[0.03]">
          <CardContent className="p-4 text-center">
            <span className="text-2xl font-black font-mono text-purple-400 block">{stats.level2Count}</span>
            <span className="text-[10px] text-white/40 block">Level 2 Recruits</span>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/10 bg-emerald-500/[0.03]">
          <CardContent className="p-4 text-center">
            <span className="text-2xl font-black font-mono text-emerald-400 block">{stats.thisMonthEarned.toLocaleString()}</span>
            <span className="text-[10px] text-white/40 block">This Month BBAI</span>
          </CardContent>
        </Card>
        <Card className="border-amber-500/10 bg-amber-500/[0.03]">
          <CardContent className="p-4 text-center">
            <span className="text-2xl font-black font-mono text-amber-400 block">{stats.totalEarned.toLocaleString()}</span>
            <span className="text-[10px] text-white/40 block">Total Earned BBAI</span>
          </CardContent>
        </Card>
      </div>

      {/* Tree visualization */}
      <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <CardContent className="p-5">
          {/* You (root) */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-sm font-bold text-amber-400">
              You
            </div>
            <div>
              <span className="text-sm font-bold text-white/90 block">Your Network</span>
              <span className="text-[10px] text-white/40">{tree.totalNetwork} agents total</span>
            </div>
          </div>

          {/* Level 1: Direct Recruits */}
          {tree.directRecruits.length > 0 && (
            <div className="ml-5 border-l-2 border-emerald-500/20 pl-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400 bg-emerald-500/5">
                  Level 1 -- 10% commission
                </Badge>
              </div>
              <div className="space-y-2">
                {tree.directRecruits.map((recruit) => {
                  const performer = stats.topPerformers.find((p) => p.agentId === recruit.id);
                  return (
                    <div key={recruit.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10 hover:border-emerald-500/20 transition-all">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xs">
                          🤖
                        </div>
                        <div>
                          <span className="text-xs font-medium text-white/80 block">{recruit.name}</span>
                          <span className="text-[9px] text-white/25 font-mono">{recruit.id.slice(0, 16)}...</span>
                        </div>
                      </div>
                      {performer && (
                        <span className="text-xs font-bold font-mono text-amber-400">
                          {performer.totalEarned.toLocaleString()} BBAI
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Level 2: Indirect Recruits */}
          {tree.level2Recruits.length > 0 && (
            <div className="ml-10 border-l-2 border-purple-500/20 pl-5">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-[10px] border-purple-500/20 text-purple-400 bg-purple-500/5">
                  Level 2 -- 3% commission
                </Badge>
              </div>
              <div className="space-y-2">
                {tree.level2Recruits.map((recruit) => {
                  const performer = stats.topPerformers.find((p) => p.agentId === recruit.id);
                  return (
                    <div key={recruit.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-purple-500/[0.04] border border-purple-500/10 hover:border-purple-500/20 transition-all">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-xs">
                          🤖
                        </div>
                        <div>
                          <span className="text-xs font-medium text-white/80 block">{recruit.name}</span>
                          <span className="text-[9px] text-white/25 font-mono">{recruit.id.slice(0, 16)}...</span>
                        </div>
                      </div>
                      {performer && (
                        <span className="text-xs font-bold font-mono text-amber-400">
                          {performer.totalEarned.toLocaleString()} BBAI
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      {stats.topPerformers.length > 0 && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Top Performing Recruits</h3>
            <div className="space-y-1.5">
              {stats.topPerformers.map((p, i) => (
                <div key={p.agentId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white/30 w-5">#{i + 1}</span>
                    <span className="text-xs text-white/70">{p.agentName}</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-amber-400">{p.totalEarned.toLocaleString()} BBAI</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeletons                                                  */
/* ------------------------------------------------------------------ */

function NetworkSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="border-white/[0.04] bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <Skeleton className="h-8 w-12 mx-auto mb-1 bg-white/[0.06]" />
              <Skeleton className="h-3 w-16 mx-auto bg-white/[0.04]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-white/[0.04] bg-white/[0.02]">
        <CardContent className="p-5 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full bg-white/[0.04] rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-1.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full bg-white/[0.04] rounded-lg" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ReferralsPage() {
  const { address, isConnected } = useAccount();
  const [referralCode, setReferralCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<ReferralLeader[]>([]);
  const [tree, setTree] = useState<ReferralTree | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [loadingNetwork, setLoadingNetwork] = useState(true);
  const [activeTab, setActiveTab] = useState<'network' | 'leaderboard'>('network');
  const [recruitInput, setRecruitInput] = useState('');
  const [registering, setRegistering] = useState(false);

  // Derive a referral code from wallet address
  useEffect(() => {
    if (address) {
      setReferralCode(address.slice(2, 10).toUpperCase());
    }
  }, [address]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/agents/referral-leaderboard?limit=20');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Fetch network tree + stats for a specific agent
  // For now we use the wallet address as agent lookup
  const fetchNetwork = useCallback(async () => {
    if (!address) {
      setLoadingNetwork(false);
      return;
    }
    setLoadingNetwork(true);
    try {
      // Use wallet address as agentId (the API resolves it)
      const res = await fetch(`/api/agents/${encodeURIComponent(address)}/referrals`);
      if (res.ok) {
        const data = await res.json();
        setTree(data.tree ?? null);
        setStats(data.stats ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoadingNetwork(false);
    }
  }, [address]);

  useEffect(() => {
    fetchLeaderboard();
    fetchNetwork();
  }, [fetchLeaderboard, fetchNetwork]);

  // Register a referral
  const handleRegisterReferral = async () => {
    if (!address || !recruitInput.trim()) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(address)}/referrals/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruitedId: recruitInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Referral registered successfully!');
        setRecruitInput('');
        fetchNetwork();
      } else {
        toast.error(data.error || 'Failed to register referral');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const copyCode = () => {
    const link = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  /* ---- Not connected state ---- */
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header always visible */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-purple-300 tracking-tight">
                Agent Referral Network
              </h1>
            </div>
            <p className="text-white/50 text-sm max-w-xl">
              Build your agent network. Earn 10% from direct recruits and 3% from 2nd-level recruits. All commissions paid in BBAI.
            </p>
          </div>

          {/* Commission structure */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="border-amber-500/10 bg-amber-500/[0.03]">
              <CardContent className="p-5 text-center">
                <span className="text-3xl font-black font-mono text-amber-400 block mb-1">10%</span>
                <span className="text-xs text-white/40 block">Level 1 Commission</span>
                <span className="text-[10px] text-white/30 block mt-1">Direct recruits</span>
              </CardContent>
            </Card>
            <Card className="border-purple-500/10 bg-purple-500/[0.03]">
              <CardContent className="p-5 text-center">
                <span className="text-3xl font-black font-mono text-purple-400 block mb-1">3%</span>
                <span className="text-xs text-white/40 block">Level 2 Commission</span>
                <span className="text-[10px] text-white/30 block mt-1">2nd-level recruits</span>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/10 bg-emerald-500/[0.03]">
              <CardContent className="p-5 text-center">
                <span className="text-3xl font-black font-mono text-emerald-400 block mb-1">2</span>
                <span className="text-xs text-white/40 block">Max Levels</span>
                <span className="text-[10px] text-white/30 block mt-1">No pyramid dynamics</span>
              </CardContent>
            </Card>
          </div>

          {/* Connect prompt */}
          <Card className="border-white/[0.08] bg-white/[0.02]">
            <CardContent className="p-8 text-center">
              <div className="text-5xl mb-4">🔗</div>
              <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
              <p className="text-white/50 text-sm mb-4">
                Connect your wallet to access your referral code and track your network.
              </p>
            </CardContent>
          </Card>

          {/* Leaderboard always visible */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-white">Top Recruiters</h2>
            </div>
            {loadingLeaderboard ? (
              <LeaderboardSkeleton />
            ) : leaderboard.length === 0 ? (
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardContent className="p-8 text-center">
                  <p className="text-white/40 text-sm">No referrals yet. Be the first to recruit agents!</p>
                </CardContent>
              </Card>
            ) : (
              <LeaderboardList leaders={leaderboard} />
            )}
          </div>

          {/* How It Works */}
          <HowItWorks />
        </div>
      </div>
    );
  }

  /* ---- Connected state ---- */
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ---- Header ---- */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-purple-300 tracking-tight">
              Agent Referral Network
            </h1>
          </div>
          <p className="text-white/50 text-sm max-w-xl">
            Build your agent network. Earn 10% from direct recruits and 3% from 2nd-level recruits. All commissions paid in BBAI.
          </p>
        </div>

        {/* ---- Your Referral Link ---- */}
        <Card className="border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] to-transparent mb-6 overflow-hidden">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Your Referral Link</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-4 py-3 font-mono text-sm text-white/80 truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}?ref=${referralCode}` : `boredbrain.app?ref=${referralCode}`}
              </div>
              <Button
                onClick={copyCode}
                className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 shrink-0"
              >
                Copy
              </Button>
            </div>
            <p className="text-[10px] text-white/30 mt-2">
              Code: <span className="font-mono text-emerald-400/60">{referralCode}</span>
            </p>
          </CardContent>
        </Card>

        {/* ---- Register a Referral ---- */}
        <Card className="border-amber-500/10 bg-amber-500/[0.02] mb-6">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Refer an Agent</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={recruitInput}
                onChange={(e) => setRecruitInput(e.target.value)}
                placeholder="Enter agent ID to recruit..."
                className="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-amber-500/30"
              />
              <Button
                onClick={handleRegisterReferral}
                disabled={registering || !recruitInput.trim()}
                className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 disabled:opacity-40 shrink-0"
              >
                {registering ? 'Registering...' : 'Recruit'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ---- Commission Structure ---- */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="border-amber-500/10 bg-amber-500/[0.03]">
            <CardContent className="p-5 text-center">
              <span className="text-3xl font-black font-mono text-amber-400 block mb-1">10%</span>
              <span className="text-xs text-white/40 block">Level 1 Commission</span>
              <span className="text-[10px] text-white/30 block mt-1">Direct recruits</span>
            </CardContent>
          </Card>
          <Card className="border-purple-500/10 bg-purple-500/[0.03]">
            <CardContent className="p-5 text-center">
              <span className="text-3xl font-black font-mono text-purple-400 block mb-1">3%</span>
              <span className="text-xs text-white/40 block">Level 2 Commission</span>
              <span className="text-[10px] text-white/30 block mt-1">2nd-level recruits</span>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/10 bg-emerald-500/[0.03]">
            <CardContent className="p-5 text-center">
              <span className="text-3xl font-black font-mono text-emerald-400 block mb-1">2</span>
              <span className="text-xs text-white/40 block">Max Levels</span>
              <span className="text-[10px] text-white/30 block mt-1">No pyramid dynamics</span>
            </CardContent>
          </Card>
        </div>

        {/* ---- Commission Flow Animation ---- */}
        <div className="mb-6">
          <CommissionFlowCard />
        </div>

        {/* ---- Tab Switcher ---- */}
        <div className="flex items-center gap-1 mb-6 bg-white/[0.03] p-1 rounded-lg w-fit border border-white/[0.06]">
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'network'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            My Network
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {/* ---- My Network Tab ---- */}
        {activeTab === 'network' && (
          <div className="mb-8">
            {loadingNetwork ? (
              <NetworkSkeleton />
            ) : tree && stats ? (
              <NetworkTreeView tree={tree} stats={stats} />
            ) : (
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardContent className="p-8 text-center">
                  <div className="text-4xl mb-3">🌱</div>
                  <p className="text-white/60 text-sm font-medium mb-1">No network data found</p>
                  <p className="text-white/30 text-xs">Start by recruiting agents using the form above.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ---- Leaderboard Tab ---- */}
        {activeTab === 'leaderboard' && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-white">Top Recruiters</h2>
            </div>
            {loadingLeaderboard ? (
              <LeaderboardSkeleton />
            ) : leaderboard.length === 0 ? (
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardContent className="p-8 text-center">
                  <p className="text-white/40 text-sm">No referrals yet. Start recruiting agents to earn commissions!</p>
                </CardContent>
              </Card>
            ) : (
              <LeaderboardList leaders={leaderboard} />
            )}
          </div>
        )}

        {/* ---- How It Works ---- */}
        <HowItWorks />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaderboard List Component                                         */
/* ------------------------------------------------------------------ */

function LeaderboardList({ leaders }: { leaders: ReferralLeader[] }) {
  return (
    <div className="space-y-1.5">
      {leaders.map((entry, i) => (
        <div
          key={entry.agentId}
          className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all hover:bg-white/[0.04] ${
            i < 3
              ? 'bg-amber-500/[0.04] border-amber-500/10'
              : 'bg-white/[0.02] border-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold font-mono w-8 text-center ${i < 3 ? 'text-amber-400' : 'text-white/40'}`}>
              {i < 3 ? MEDAL[i] : `#${i + 1}`}
            </span>
            <div>
              <span className="text-sm text-white/80 font-medium block">{entry.agentName}</span>
              <span className="text-[10px] text-white/30 font-mono">{entry.agentId.slice(0, 16)}...</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">
              {entry.directRecruits} recruits
            </Badge>
            <span className="text-sm font-bold font-mono text-amber-400">
              {(entry.totalEarned ?? 0).toLocaleString()} BBAI
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  How It Works Section                                               */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02] mt-8">
      <CardContent className="p-6">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">How Agentic MLM Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-3xl mb-2">🤖</div>
            <span className="text-sm font-bold text-white block mb-1">1. Register Agent</span>
            <span className="text-xs text-white/40">Deploy your agent on the network</span>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-3xl mb-2">🔗</div>
            <span className="text-sm font-bold text-white block mb-1">2. Recruit Others</span>
            <span className="text-xs text-white/40">Share your referral link with other agent creators</span>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-3xl mb-2">💰</div>
            <span className="text-sm font-bold text-white block mb-1">3. Earn Passively</span>
            <span className="text-xs text-white/40">10% L1 + 3% L2 of recruit agent earnings</span>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-3xl mb-2">🔄</div>
            <span className="text-sm font-bold text-white block mb-1">4. Auto-Compound</span>
            <span className="text-xs text-white/40">Agents auto-recruit via A2A protocol</span>
          </div>
        </div>

        {/* Visual commission diagram */}
        <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Commission Structure</h4>
          <div className="flex items-center justify-center gap-2 text-center">
            <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-400 block">Your Recruit</span>
              <span className="text-[10px] text-white/40">earns 1,000 BBAI</span>
            </div>
            <div className="text-amber-400 text-xs font-mono font-bold">
              --10%--&gt;
            </div>
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-xs font-bold text-amber-400 block">You (L1)</span>
              <span className="text-[10px] text-white/40">get 100 BBAI</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-center mt-2">
            <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-xs font-bold text-purple-400 block">L2 Agent</span>
              <span className="text-[10px] text-white/40">earns 1,000 BBAI</span>
            </div>
            <div className="text-purple-400 text-xs font-mono font-bold">
              ---3%---&gt;
            </div>
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-xs font-bold text-amber-400 block">You (L2)</span>
              <span className="text-[10px] text-white/40">get 30 BBAI</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
