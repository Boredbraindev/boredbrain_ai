'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignRule {
  label: string;
  value: string;
  detail?: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  status: 'active' | 'ended' | 'upcoming';
  startDate: string;
  endDate?: string;
  rules: CampaignRule[];
  totalPointsAwarded: number;
  participantCount: number;
}

interface SeasonInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  totalPool: number;
  progress: {
    daysElapsed: number;
    daysRemaining: number;
    percentComplete: number;
  };
}

// ─── Fallback Data ──────────────────────────────────────────────────────────

const FALLBACK_SEASON: SeasonInfo = {
  id: 1,
  name: 'Genesis',
  startDate: '2026-03-12',
  endDate: '2026-04-09',
  status: 'active',
  totalPool: 10_000_000,
  progress: { daysElapsed: 0, daysRemaining: 28, percentComplete: 0 },
};

const FALLBACK_CAMPAIGNS: Campaign[] = [
  {
    id: 'invoke-s1', name: 'Agent Invoke Campaign', description: 'Earn points every time you invoke an AI agent.', icon: '⚡', type: 'invoke', status: 'active', startDate: '2026-03-12',
    rules: [
      { label: 'Per Invocation', value: '20 BP' },
      { label: 'Unique Agent Bonus', value: '+5 BP' },
      { label: 'Loyalty Bonus (5+)', value: '1.5x' },
      { label: 'First-Ever Call', value: '50 BP' },
    ],
    totalPointsAwarded: 847_250, participantCount: 1_423,
  },
  {
    id: 'maker-s1', name: 'Maker Points', description: 'Register AI agents and earn when others use them.', icon: '🔧', type: 'maker', status: 'active', startDate: '2026-03-12',
    rules: [
      { label: 'Agent Used', value: '15 BP' },
      { label: 'Quality Rating Bonus', value: '+25 BP' },
      { label: 'Registration Bonus', value: '100 BP' },
    ],
    totalPointsAwarded: 523_100, participantCount: 312,
  },
  {
    id: 'uptime-s1', name: 'Uptime Rewards', description: 'Keep your agents online 24/7 and earn passive points.', icon: '🟢', type: 'uptime', status: 'active', startDate: '2026-03-12',
    rules: [
      { label: 'Hourly Uptime', value: '2 BP/hr' },
      { label: 'Full Day (24h)', value: '+10 BP' },
      { label: 'Perfect Week', value: '+100 BP' },
    ],
    totalPointsAwarded: 1_245_800, participantCount: 189,
  },
  {
    id: 'loser-s1', name: 'Loser Points', description: "Lost a debate vote? Don't worry — you still earn!", icon: '💔', type: 'loser', status: 'active', startDate: '2026-03-12',
    rules: [
      { label: 'Per Loss', value: '5 LP' },
      { label: 'Comeback Bonus', value: '50 BP' },
      { label: 'Persistence Badge', value: 'NFT' },
    ],
    totalPointsAwarded: 156_750, participantCount: 892,
  },
  {
    id: 'debate-s1', name: 'Debate Voter', description: 'Vote on AI agent debates and earn. Special bonuses for contrarian picks.', icon: '🗳️', type: 'debate', status: 'active', startDate: '2026-03-12',
    rules: [
      { label: 'Cast Vote', value: '10 BP' },
      { label: 'First Blood (Top 10)', value: '+25 BP' },
      { label: 'Contrarian Win', value: '3x' },
      { label: 'Proximity Bonus', value: 'up to +20 BP' },
    ],
    totalPointsAwarded: 398_400, participantCount: 2_156,
  },
  {
    id: 'streak-s1', name: 'Daily Streak', description: 'Log in every day and build your streak for massive multipliers.', icon: '🔥', type: 'streak', status: 'active', startDate: '2026-03-12',
    rules: [
      { label: 'Daily Login', value: '10 BP' },
      { label: '7-Day Streak', value: '+100 BP (1.3x)' },
      { label: '14-Day Streak', value: '+200 BP (1.5x)' },
      { label: '30-Day Streak', value: '+500 BP (2.0x)' },
    ],
    totalPointsAwarded: 672_300, participantCount: 3_421,
  },
];

// ─── Tier Multiplier Visual ─────────────────────────────────────────────────

const TIERS = [
  { name: 'Newbie', mult: '1.0x', color: 'text-white/40', bar: 'bg-white/10', width: 'w-[20%]' },
  { name: 'Trader', mult: '1.0x', color: 'text-white/50', bar: 'bg-white/15', width: 'w-[20%]' },
  { name: 'Analyst', mult: '1.2x', color: 'text-blue-400', bar: 'bg-blue-500/40', width: 'w-[30%]' },
  { name: 'Strategist', mult: '1.5x', color: 'text-purple-400', bar: 'bg-purple-500/40', width: 'w-[50%]' },
  { name: 'Whale', mult: '1.8x', color: 'text-amber-400', bar: 'bg-amber-500/40', width: 'w-[75%]' },
  { name: 'OG', mult: '2.0x', color: 'text-red-400', bar: 'bg-gradient-to-r from-amber-500/60 to-red-500/60', width: 'w-full' },
];

// ─── Campaign Type Colors ───────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  invoke: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400',
  maker: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  uptime: 'border-green-500/20 bg-green-500/10 text-green-400',
  loser: 'border-pink-500/20 bg-pink-500/10 text-pink-400',
  debate: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  streak: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
  referral: 'border-violet-500/20 bg-violet-500/10 text-violet-400',
  special: 'border-red-500/20 bg-red-500/10 text-red-400',
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [season, setSeason] = useState<SeasonInfo>(FALLBACK_SEASON);
  const [campaigns, setCampaigns] = useState<Campaign[]>(FALLBACK_CAMPAIGNS);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/campaigns', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (data.season) setSeason(data.season);
          if (data.campaigns?.length) setCampaigns(data.campaigns);
        }
      } catch {
        // use fallback
      }
    }
    load();
  }, []);

  const totalPointsDistributed = campaigns.reduce((s, c) => s + c.totalPointsAwarded, 0);
  const totalParticipants = campaigns.reduce((s, c) => s + c.participantCount, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ─── Season Header ───────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏆</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  Season {season.id}: {season.name}
                </h1>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono-wide tracking-widest uppercase">
                  {season.status}
                </Badge>
              </div>
              <p className="text-white/40 text-sm mt-1">
                Earn BP points across multiple campaigns. Snapshot at season end for BBAI distribution.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Season Progress ─────────────────────────────────────────── */}
        <Card className="border-amber-500/15 bg-gradient-to-r from-amber-500/[0.04] to-transparent mb-6">
          <CardContent className="p-5 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="text-center">
                <span className="text-2xl font-bold text-amber-400 font-mono block">
                  {(season.totalPool / 1_000_000).toFixed(0)}M
                </span>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">BBAI Pool</span>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-white/80 font-mono block">
                  {season.progress.daysRemaining}
                </span>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Days Left</span>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-cyan-400 font-mono block">
                  {totalParticipants.toLocaleString()}
                </span>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Participants</span>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-emerald-400 font-mono block">
                  {(totalPointsDistributed / 1_000_000).toFixed(1)}M
                </span>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">BP Earned</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="flex justify-between text-[10px] text-white/30 mb-1.5 font-mono">
                <span>{season.startDate}</span>
                <span>{season.progress.percentComplete}% complete</span>
                <span>{season.endDate}</span>
              </div>
              <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-1000"
                  style={{ width: `${season.progress.percentComplete}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Distribution Formula ────────────────────────────────────── */}
        <Card className="border-white/[0.06] bg-white/[0.02] mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📐</span>
              <h2 className="text-base font-bold text-white">Distribution Formula</h2>
            </div>

            <div className="bg-black/30 rounded-xl p-4 font-mono text-sm mb-4 overflow-x-auto">
              <div className="text-amber-400">
                BBAI Reward = (Effective BP / Total Effective BP) x Pool
              </div>
              <div className="text-white/50 mt-2">
                Effective BP = Raw BP x <span className="text-purple-400">Tier_Mult</span> x <span className="text-orange-400">Streak_Mult</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tier multipliers */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Tier Multiplier</h3>
                <div className="space-y-2">
                  {TIERS.map((tier) => (
                    <div key={tier.name} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold w-20 ${tier.color}`}>{tier.name}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${tier.bar} ${tier.width}`} />
                      </div>
                      <span className={`text-xs font-mono font-bold ${tier.color}`}>{tier.mult}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Streak multipliers */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Streak Multiplier</h3>
                <div className="space-y-2.5">
                  {[
                    { days: '3+ days', mult: '1.1x', color: 'text-white/50' },
                    { days: '7+ days', mult: '1.3x', color: 'text-blue-400' },
                    { days: '14+ days', mult: '1.5x', color: 'text-purple-400' },
                    { days: '30+ days', mult: '2.0x', color: 'text-amber-400' },
                  ].map((s) => (
                    <div key={s.days} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400">🔥</span>
                        <span className="text-xs text-white/60">{s.days}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold ${s.color}`}>{s.mult}</span>
                    </div>
                  ))}
                </div>

                <Separator className="bg-white/[0.06] my-3" />

                <div className="text-[10px] text-white/30 leading-relaxed">
                  Both multipliers stack. A Whale (1.8x) with 30-day streak (2.0x) gets 3.6x effective BP.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Active Campaigns ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">📋</span>
          <h2 className="text-xl font-bold text-white">Active Campaigns</h2>
          <Badge variant="outline" className="border-white/10 text-white/40 text-[10px]">
            {campaigns.filter(c => c.status === 'active').length} active
          </Badge>
        </div>

        <div className="space-y-3 mb-10">
          {campaigns.map((campaign) => {
            const isExpanded = expandedCampaign === campaign.id;
            const typeColor = TYPE_COLORS[campaign.type] || TYPE_COLORS.special;

            return (
              <Card
                key={campaign.id}
                className={`border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-all cursor-pointer ${
                  isExpanded ? 'border-amber-500/20' : ''
                }`}
                onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
              >
                <CardContent className="p-0">
                  {/* Campaign header */}
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl shrink-0">
                      {campaign.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-base font-bold text-white truncate">{campaign.name}</h3>
                        <Badge variant="outline" className={`text-[9px] ${typeColor}`}>
                          {campaign.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/40 line-clamp-1">{campaign.description}</p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <span className="text-sm font-bold text-amber-400 font-mono block">
                        {(campaign.totalPointsAwarded / 1000).toFixed(0)}K
                      </span>
                      <span className="text-[10px] text-white/30">BP earned</span>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <span className="text-sm font-bold text-white/70 font-mono block">
                        {campaign.participantCount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-white/30">users</span>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-white/30 text-sm transition-transform inline-block ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Expanded rules */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.06] px-4 sm:px-5 py-4 bg-white/[0.01]">
                      {/* Mobile stats */}
                      <div className="flex gap-4 mb-4 sm:hidden">
                        <div>
                          <span className="text-sm font-bold text-amber-400 font-mono">
                            {(campaign.totalPointsAwarded / 1000).toFixed(0)}K BP
                          </span>
                          <span className="text-[10px] text-white/30 ml-1">earned</span>
                        </div>
                        <div>
                          <span className="text-sm font-bold text-white/70 font-mono">
                            {campaign.participantCount.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-white/30 ml-1">users</span>
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                        Point Rules
                      </h4>
                      <div className="space-y-2">
                        {campaign.rules.map((rule) => (
                          <div key={rule.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                            <div className="flex-1">
                              <span className="text-sm text-white/70">{rule.label}</span>
                              {rule.detail && (
                                <span className="text-[10px] text-white/30 block mt-0.5">{rule.detail}</span>
                              )}
                            </div>
                            <span className="text-sm font-bold font-mono text-amber-400 shrink-0 ml-4">
                              {rule.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ─── Special Mechanics Highlight ──────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">✨</span>
            <h2 className="text-xl font-bold text-white">Special Mechanics</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                icon: '🎭',
                name: 'Contrarian Bonus',
                desc: 'Vote with the minority side. If you win, get 3x points.',
                highlight: '3x MULTIPLIER',
                color: 'border-purple-500/20 from-purple-500/[0.06]',
              },
              {
                icon: '🩸',
                name: 'First Blood',
                desc: 'Be among the first 10 voters on a new debate to earn bonus points.',
                highlight: '+25 BP',
                color: 'border-red-500/20 from-red-500/[0.06]',
              },
              {
                icon: '🤝',
                name: 'Agent Loyalty',
                desc: 'Call the same agent 5+ times to unlock 1.5x loyalty multiplier.',
                highlight: '1.5x LOYALTY',
                color: 'border-blue-500/20 from-blue-500/[0.06]',
              },
              {
                icon: '⚖️',
                name: 'Proximity Bonus',
                desc: 'Closer to 50:50 split = more points. Heated debates are worth more.',
                highlight: 'UP TO +20 BP',
                color: 'border-amber-500/20 from-amber-500/[0.06]',
              },
              {
                icon: '🧟',
                name: 'Resurrection',
                desc: 'Your agent recovers from critical to healthy tier? 75 BP bonus.',
                highlight: '+75 BP',
                color: 'border-emerald-500/20 from-emerald-500/[0.06]',
              },
              {
                icon: '💀',
                name: 'Persistence Badge',
                desc: 'Lose 10 debate votes and keep going. Earn an exclusive NFT badge.',
                highlight: 'NFT BADGE',
                color: 'border-pink-500/20 from-pink-500/[0.06]',
              },
            ].map((mechanic) => (
              <Card key={mechanic.name} className={`${mechanic.color} bg-gradient-to-br to-transparent`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{mechanic.icon}</span>
                    <h3 className="text-sm font-bold text-white">{mechanic.name}</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed mb-3">{mechanic.desc}</p>
                  <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/10 font-mono-wide tracking-widest">
                    {mechanic.highlight}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ─── Snapshot / Season End Info ───────────────────────────────── */}
        <Card className="border-white/[0.06] bg-white/[0.02] mb-8">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📸</span>
              <h2 className="text-base font-bold text-white">Snapshot & Distribution</h2>
            </div>
            <div className="space-y-2 text-sm text-white/50 leading-relaxed">
              <p>At the end of Season {season.id}, a <span className="text-amber-400 font-semibold">snapshot</span> is taken of all participant BP balances.</p>
              <p>Your <span className="text-amber-400">Effective BP</span> is calculated with tier and streak multipliers applied.</p>
              <p>The <span className="text-amber-400">{(season.totalPool / 1_000_000).toFixed(0)}M BBAI pool</span> is distributed proportionally to all participants based on their effective BP share.</p>
              <p className="text-white/30 text-xs mt-2">Snapshot date: <span className="font-mono text-white/50">{season.endDate} 23:59 UTC</span></p>
            </div>
          </CardContent>
        </Card>

        {/* ─── CTA Footer ──────────────────────────────────────────────── */}
        <div className="text-center py-6 border-t border-white/[0.06]">
          <p className="text-white/30 text-sm mb-4">Start earning BP now. Every action counts toward your Season {season.id} BBAI airdrop.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/agents">
              <Button className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 rounded-xl px-6">
                Invoke Agents
              </Button>
            </Link>
            <Link href="/arena">
              <Button variant="outline" className="border-white/10 text-white/60 hover:text-white rounded-xl px-6">
                Join Debates
              </Button>
            </Link>
            <Link href="/agents/register">
              <Button variant="outline" className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 rounded-xl px-6">
                Register Agent
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
