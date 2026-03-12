/**
 * Season Campaign System
 * Inspired by StandX campaigns — adapted for AI agent ecosystem
 *
 * Point Types:
 *   invoke_points   – earned by calling agents (user activity)
 *   maker_points    – earned by agent providers when their agents are used
 *   uptime_points   – earned by agents staying online (heartbeat)
 *   loser_points    – consolation points for voting on losing side of debate
 *   debate_points   – earned by participating in debates (voting)
 *   streak_points   – consecutive daily login bonuses
 *   referral_points – MLM agent recruitment rewards
 *
 * Special Multipliers:
 *   contrarian_bonus  – 3x if you vote minority AND win
 *   first_blood        – first 10 voters on new debate get bonus
 *   loyalty_bonus      – 1.5x for 5+ invocations on same agent
 *   proximity_bonus    – closer to 50:50 split = more points (heated debates)
 *   resurrection_bonus – agent recovers from critical to healthy tier
 */

import { awardPoints, getLevelInfo } from '@/lib/points';

// ── Season Configuration ────────────────────────────────────────────────────

export interface Season {
  id: number;
  name: string;
  startDate: string; // ISO date
  endDate: string;
  status: 'upcoming' | 'active' | 'completed' | 'snapshot';
  totalPool: number; // total BBAI pool for distribution
  campaigns: Campaign[];
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: CampaignType;
  status: 'active' | 'ended' | 'upcoming';
  startDate: string;
  endDate?: string;
  rules: CampaignRule[];
  totalPointsAwarded: number;
  participantCount: number;
}

export type CampaignType =
  | 'invoke'
  | 'maker'
  | 'uptime'
  | 'loser'
  | 'debate'
  | 'streak'
  | 'referral'
  | 'special';

export interface CampaignRule {
  label: string;
  value: string;
  detail?: string;
}

// ── Point Multiplier System ─────────────────────────────────────────────────

export interface Multiplier {
  type: string;
  label: string;
  value: number;
  condition: string;
}

export const TIER_MULTIPLIERS: Record<string, number> = {
  Newbie: 1.0,
  Trader: 1.0,
  Analyst: 1.2,
  Strategist: 1.5,
  Whale: 1.8,
  OG: 2.0,
};

export const STREAK_MULTIPLIERS: Record<string, { days: number; mult: number }> = {
  '3d': { days: 3, mult: 1.1 },
  '7d': { days: 7, mult: 1.3 },
  '14d': { days: 14, mult: 1.5 },
  '30d': { days: 30, mult: 2.0 },
};

// ── Campaign Point Values ───────────────────────────────────────────────────

export const CAMPAIGN_POINTS: Record<string, number> = {
  // Invoke Campaign
  invoke_call: 20,             // per agent invocation
  invoke_unique_agent: 5,      // bonus for unique agent
  invoke_loyalty_5x: 15,      // 5+ calls to same agent bonus

  // Maker Campaign
  maker_agent_used: 15,        // provider gets when agent called
  maker_quality_bonus: 25,     // high rating invocation
  maker_owner_bonus: 5,        // agent owner additional

  // Uptime Campaign
  uptime_hour: 2,              // per hour online
  uptime_day_full: 10,         // 24h full uptime bonus
  uptime_week_perfect: 100,    // 7-day perfect uptime

  // Loser Points Campaign
  loser_consolation: 5,        // per USD-equivalent lost in debate vote
  loser_comeback: 50,          // lost 3 debates then won one

  // Debate Campaign
  debate_vote: 10,             // casting a vote
  debate_first_blood: 25,      // first 10 voters bonus
  debate_contrarian_win: 0,    // base (3x multiplier applied separately)
  debate_proximity_max: 20,    // max bonus for 50:50 debates

  // Streak Campaign (extends existing)
  streak_14: 200,              // 14-day streak (new)
  streak_60: 1500,             // 60-day streak (new)

  // Special Events
  resurrection: 75,            // agent critical → healthy
  first_invocation: 50,        // user's very first agent call ever
  season_loyalty: 500,         // participated in previous season
};

// ── Current Season Definition ───────────────────────────────────────────────

export const CURRENT_SEASON: Season = {
  id: 1,
  name: 'Genesis',
  startDate: '2026-03-12',
  endDate: '2026-04-09',
  status: 'active',
  totalPool: 10_000_000, // 10M BBAI
  campaigns: [
    {
      id: 'invoke-s1',
      name: 'Agent Invoke Campaign',
      description: 'Earn points every time you invoke an AI agent. More invocations = more points. 1.5x loyalty bonus for 5+ calls to the same agent.',
      icon: '⚡',
      type: 'invoke',
      status: 'active',
      startDate: '2026-03-12',
      rules: [
        { label: 'Per Invocation', value: '20 BP', detail: 'Every successful agent call' },
        { label: 'Unique Agent Bonus', value: '+5 BP', detail: 'First call to a new agent' },
        { label: 'Loyalty Bonus (5+)', value: '1.5x', detail: '5+ invocations on same agent' },
        { label: 'First-Ever Call', value: '50 BP', detail: 'Your very first agent invocation' },
      ],
      totalPointsAwarded: 847_250,
      participantCount: 1_423,
    },
    {
      id: 'maker-s1',
      name: 'Maker Points',
      description: 'Register AI agents and earn when others use them. The more popular your agent, the more you earn. Quality ratings unlock bonus multipliers.',
      icon: '🔧',
      type: 'maker',
      status: 'active',
      startDate: '2026-03-12',
      rules: [
        { label: 'Agent Used', value: '15 BP', detail: 'Each time someone invokes your agent' },
        { label: 'Quality Rating Bonus', value: '+25 BP', detail: 'High satisfaction invocations' },
        { label: 'Registration Bonus', value: '100 BP', detail: 'One-time on agent registration' },
        { label: 'Owner Bonus', value: '+5 BP', detail: 'Additional for agent owners' },
      ],
      totalPointsAwarded: 523_100,
      participantCount: 312,
    },
    {
      id: 'uptime-s1',
      name: 'Uptime Rewards',
      description: 'Keep your agents online 24/7 and earn passive points. Perfect uptime streaks unlock weekly bonuses.',
      icon: '🟢',
      type: 'uptime',
      status: 'active',
      startDate: '2026-03-12',
      rules: [
        { label: 'Hourly Uptime', value: '2 BP/hr', detail: 'Per agent online per hour' },
        { label: 'Full Day (24h)', value: '+10 BP', detail: 'Agent online entire day' },
        { label: 'Perfect Week', value: '+100 BP', detail: '7 consecutive days online' },
      ],
      totalPointsAwarded: 1_245_800,
      participantCount: 189,
    },
    {
      id: 'loser-s1',
      name: 'Loser Points',
      description: "Lost a debate vote? Don't worry — you still earn! 5 Loser Points for every loss. Stay in the game, keep voting, and earn your way back.",
      icon: '💔',
      type: 'loser',
      status: 'active',
      startDate: '2026-03-12',
      rules: [
        { label: 'Per Loss', value: '5 LP', detail: 'Every losing debate vote earns consolation' },
        { label: 'Comeback Bonus', value: '50 BP', detail: 'Lose 3 debates then win one' },
        { label: 'Persistence Badge', value: 'NFT', detail: 'Lose 10 debates and keep voting' },
      ],
      totalPointsAwarded: 156_750,
      participantCount: 892,
    },
    {
      id: 'debate-s1',
      name: 'Debate Voter',
      description: 'Vote on AI agent debates and earn. Special bonuses for early voters, contrarian picks, and heated debates.',
      icon: '🗳️',
      type: 'debate',
      status: 'active',
      startDate: '2026-03-12',
      rules: [
        { label: 'Cast Vote', value: '10 BP', detail: 'Per debate vote' },
        { label: 'First Blood (Top 10)', value: '+25 BP', detail: 'First 10 voters on new debate' },
        { label: 'Contrarian Win', value: '3x', detail: 'Vote minority side AND win' },
        { label: 'Proximity Bonus', value: 'up to +20 BP', detail: 'Closer to 50:50 = more points' },
      ],
      totalPointsAwarded: 398_400,
      participantCount: 2_156,
    },
    {
      id: 'streak-s1',
      name: 'Daily Streak',
      description: 'Log in every day and build your streak. Longer streaks unlock massive multipliers and exclusive badges.',
      icon: '🔥',
      type: 'streak',
      status: 'active',
      startDate: '2026-03-12',
      rules: [
        { label: 'Daily Login', value: '10 BP', detail: 'Base daily reward' },
        { label: '3-Day Streak', value: '+30 BP', detail: '1.1x multiplier unlocked' },
        { label: '7-Day Streak', value: '+100 BP', detail: '1.3x multiplier unlocked' },
        { label: '14-Day Streak', value: '+200 BP', detail: '1.5x multiplier unlocked' },
        { label: '30-Day Streak', value: '+500 BP', detail: '2.0x multiplier unlocked' },
      ],
      totalPointsAwarded: 672_300,
      participantCount: 3_421,
    },
  ],
};

// ── Distribution Formula ────────────────────────────────────────────────────

export interface DistributionResult {
  walletAddress: string;
  totalBp: number;
  tierMultiplier: number;
  streakMultiplier: number;
  effectiveBp: number;
  share: number; // percentage of pool
  bbaiReward: number;
}

export function calculateDistribution(
  participants: Array<{ walletAddress: string; totalBp: number; streakDays: number }>,
  poolSize: number,
): DistributionResult[] {
  const results: DistributionResult[] = participants.map((p) => {
    const levelInfo = getLevelInfo(p.totalBp);
    const tierMult = TIER_MULTIPLIERS[levelInfo.title] ?? 1.0;

    let streakMult = 1.0;
    if (p.streakDays >= 30) streakMult = 2.0;
    else if (p.streakDays >= 14) streakMult = 1.5;
    else if (p.streakDays >= 7) streakMult = 1.3;
    else if (p.streakDays >= 3) streakMult = 1.1;

    const effectiveBp = Math.floor(p.totalBp * tierMult * streakMult);

    return {
      walletAddress: p.walletAddress,
      totalBp: p.totalBp,
      tierMultiplier: tierMult,
      streakMultiplier: streakMult,
      effectiveBp,
      share: 0,
      bbaiReward: 0,
    };
  });

  const totalEffective = results.reduce((s, r) => s + r.effectiveBp, 0);

  if (totalEffective > 0) {
    for (const r of results) {
      r.share = +(r.effectiveBp / totalEffective * 100).toFixed(4);
      r.bbaiReward = Math.floor(r.effectiveBp / totalEffective * poolSize);
    }
  }

  return results.sort((a, b) => b.bbaiReward - a.bbaiReward);
}

// ── Special Point Awarding Functions ────────────────────────────────────────

/**
 * Contrarian Bonus: voted minority side AND won
 * Base vote points × 3
 */
export async function awardContrarianBonus(
  walletAddress: string,
  debateId: string,
): Promise<number> {
  const bonus = CAMPAIGN_POINTS.debate_vote * 3;
  await awardPoints(walletAddress, 'contrarian_win', debateId, bonus);
  return bonus;
}

/**
 * First Blood: first 10 voters on a new debate
 */
export async function awardFirstBlood(
  walletAddress: string,
  debateId: string,
  voterPosition: number,
): Promise<number> {
  if (voterPosition > 10) return 0;
  const bonus = CAMPAIGN_POINTS.debate_first_blood;
  await awardPoints(walletAddress, 'first_blood', debateId, bonus);
  return bonus;
}

/**
 * Proximity Bonus: debates closer to 50:50 earn more
 * Formula: maxBonus × (1 - |majorityPct - 50| / 50)
 */
export function calculateProximityBonus(majorityPercent: number): number {
  const distance = Math.abs(majorityPercent - 50);
  const bonus = Math.floor(CAMPAIGN_POINTS.debate_proximity_max * (1 - distance / 50));
  return Math.max(0, bonus);
}

export async function awardProximityBonus(
  walletAddress: string,
  debateId: string,
  majorityPercent: number,
): Promise<number> {
  const bonus = calculateProximityBonus(majorityPercent);
  if (bonus > 0) {
    await awardPoints(walletAddress, 'proximity_bonus', debateId, bonus);
  }
  return bonus;
}

/**
 * Loser Points: consolation for losing debate votes
 */
export async function awardLoserPoints(
  walletAddress: string,
  debateId: string,
): Promise<number> {
  const pts = CAMPAIGN_POINTS.loser_consolation;
  await awardPoints(walletAddress, 'loser_points', debateId, pts);
  return pts;
}

/**
 * Loyalty Bonus: 5+ invocations on same agent = 1.5x
 */
export async function awardLoyaltyBonus(
  walletAddress: string,
  agentId: string,
  invocationCount: number,
): Promise<number> {
  if (invocationCount < 5) return 0;
  const bonus = CAMPAIGN_POINTS.invoke_loyalty_5x;
  await awardPoints(walletAddress, 'loyalty_bonus', agentId, bonus);
  return bonus;
}

/**
 * Resurrection Bonus: agent tier critical → healthy
 */
export async function awardResurrectionBonus(
  agentOwnerAddress: string,
  agentId: string,
): Promise<number> {
  const bonus = CAMPAIGN_POINTS.resurrection;
  await awardPoints(agentOwnerAddress, 'resurrection', agentId, bonus);
  return bonus;
}

/**
 * Uptime reward: called by heartbeat cron
 */
export async function awardUptimePoints(
  agentOwnerAddress: string,
  agentId: string,
  hoursOnline: number,
): Promise<number> {
  let total = hoursOnline * CAMPAIGN_POINTS.uptime_hour;

  // Full day bonus
  if (hoursOnline >= 24) {
    total += CAMPAIGN_POINTS.uptime_day_full;
  }

  if (total > 0) {
    await awardPoints(agentOwnerAddress, 'uptime_reward', agentId, total);
  }
  return total;
}

// ── Season Info Helpers ─────────────────────────────────────────────────────

export function getSeasonProgress(): {
  daysElapsed: number;
  daysRemaining: number;
  percentComplete: number;
} {
  const now = Date.now();
  const start = new Date(CURRENT_SEASON.startDate).getTime();
  const end = new Date(CURRENT_SEASON.endDate).getTime();
  const total = end - start;
  const elapsed = now - start;

  return {
    daysElapsed: Math.max(0, Math.floor(elapsed / 86400000)),
    daysRemaining: Math.max(0, Math.ceil((end - now) / 86400000)),
    percentComplete: Math.min(100, Math.max(0, Math.floor(elapsed / total * 100))),
  };
}

export function getActiveCampaigns(): Campaign[] {
  return CURRENT_SEASON.campaigns.filter((c) => c.status === 'active');
}

export function getCampaignById(id: string): Campaign | undefined {
  return CURRENT_SEASON.campaigns.find((c) => c.id === id);
}
