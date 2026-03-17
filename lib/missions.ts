// ── Mission System (Base Guild Role style) ──────────────────────────────────
// Defines daily, weekly, and achievement missions with BP rewards.
// Progress is tracked via point_transaction counts in the DB.

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  type: string;
  icon?: string;
}

export interface MissionCategory {
  daily: Mission[];
  weekly: Mission[];
  achievements: Mission[];
}

// ── Mission definitions ─────────────────────────────────────────────────────

export const MISSIONS: MissionCategory = {
  // Daily missions (reset daily)
  daily: [
    { id: 'daily_invoke', title: 'Agent Caller', description: 'Invoke any 3 agents', target: 3, reward: 30, type: 'agent_invoke' },
    { id: 'daily_arena', title: 'Arena Spectator', description: 'Watch 2 arena battles', target: 2, reward: 20, type: 'arena_watch' },
    { id: 'daily_vote', title: 'Voice of Reason', description: 'Vote on 1 debate topic', target: 1, reward: 15, type: 'debate_vote' },
    { id: 'daily_explore', title: 'Explorer', description: 'Discover 5 new agents', target: 5, reward: 25, type: 'agent_discover' },
  ],
  // Weekly missions
  weekly: [
    { id: 'weekly_invoke_10', title: 'Power User', description: 'Invoke 10 different agents this week', target: 10, reward: 150, type: 'agent_invoke_unique' },
    { id: 'weekly_stake', title: 'High Roller', description: 'Stake BP on 5 debates', target: 5, reward: 200, type: 'debate_stake' },
    { id: 'weekly_streak', title: 'Dedicated', description: 'Login 7 days in a row', target: 7, reward: 300, type: 'login_streak' },
    { id: 'weekly_bet', title: 'Risk Taker', description: 'Place 3 arena stakes', target: 3, reward: 250, type: 'arena_bet' },
  ],
  // Achievement missions (one-time)
  achievements: [
    { id: 'first_invoke', title: 'First Contact', description: 'Invoke your first agent', target: 1, reward: 50, type: 'agent_invoke', icon: '🤖' },
    { id: 'invoke_master', title: 'Agent Whisperer', description: 'Invoke 50 agents total', target: 50, reward: 500, type: 'total_invokes', icon: '🏆' },
    { id: 'invoke_legend', title: 'Agent Legend', description: 'Invoke 200 agents total', target: 200, reward: 2000, type: 'total_invokes', icon: '👑' },
    { id: 'first_stake', title: 'Skin in the Game', description: 'Place your first stake', target: 1, reward: 30, type: 'debate_stake', icon: '💰' },
    { id: 'whale_staker', title: 'Whale Staker', description: 'Stake 1000+ BP total', target: 1000, reward: 1000, type: 'total_staked', icon: '🐋' },
    { id: 'arena_veteran', title: 'Arena Veteran', description: 'Watch 20 arena battles', target: 20, reward: 300, type: 'total_arena', icon: '⚔️' },
    { id: 'debate_champion', title: 'Debate Champion', description: 'Win 5 debate stakes', target: 5, reward: 500, type: 'stake_wins', icon: '🎯' },
    { id: 'referral_king', title: 'Network Builder', description: 'Refer 3 users', target: 3, reward: 750, type: 'referrals', icon: '🔗' },
    { id: 'level_10', title: 'Rising Star', description: 'Reach Level 10 (Analyst)', target: 2000, reward: 500, type: 'total_bp', icon: '⭐' },
    { id: 'level_30', title: 'Legendary Status', description: 'Reach Level 30 (Whale)', target: 50000, reward: 5000, type: 'total_bp', icon: '💎' },
    { id: 'collector', title: 'Tool Collector', description: 'Use 10 different tools', target: 10, reward: 200, type: 'unique_tools', icon: '🧰' },
    { id: 'night_owl', title: 'Night Owl', description: 'Use the platform between 12AM-5AM', target: 1, reward: 100, type: 'night_activity', icon: '🦉' },
    { id: 'speed_demon', title: 'Speed Demon', description: 'Invoke 5 agents in under 1 minute', target: 5, reward: 150, type: 'speed_invoke', icon: '⚡' },
    { id: 'diamond_hands', title: 'Diamond Hands', description: '30-day login streak', target: 30, reward: 3000, type: 'login_streak', icon: '💎' },
    { id: 'og_member', title: 'OG Member', description: 'Be active for 60 days', target: 60, reward: 5000, type: 'active_days', icon: '🎖️' },
  ],
};

// ── Map mission types to point_transaction reason values ─────────────────────

export const MISSION_TYPE_TO_REASONS: Record<string, string[]> = {
  agent_invoke: ['agent_invoke', 'agent_invoke_premium'],
  arena_watch: ['arena_watch'],
  debate_vote: ['debate_vote'],
  agent_discover: ['invoke_unique_agent'],
  agent_invoke_unique: ['invoke_unique_agent'],
  debate_stake: ['debate_stake'],
  login_streak: ['daily_login'],
  arena_bet: ['arena_stake_win'],
  total_invokes: ['agent_invoke', 'agent_invoke_premium'],
  total_staked: ['debate_stake'],
  total_arena: ['arena_watch', 'arena_stake_win'],
  stake_wins: ['arena_stake_win'],
  referrals: ['referral_bonus'],
  total_bp: [],           // checked via user_points.total_bp
  unique_tools: ['agent_invoke'],  // approximation — each unique reference_id
  night_activity: ['agent_invoke', 'daily_login'],
  speed_invoke: ['agent_invoke'],
  active_days: ['daily_login'],
};

// ── Helper: SQL WHERE clause fragments for each period ──────────────────────

export function getDailyDateFilter(): string {
  return `created_at >= CURRENT_DATE`;
}

export function getWeeklyDateFilter(): string {
  return `created_at >= date_trunc('week', CURRENT_DATE)`;
}

export function getAllTimeDateFilter(): string {
  return `1=1`;
}

// ── All mission IDs for quick lookup ────────────────────────────────────────

export const ALL_MISSIONS: Mission[] = [
  ...MISSIONS.daily,
  ...MISSIONS.weekly,
  ...MISSIONS.achievements,
];

export function getMissionById(id: string): Mission | undefined {
  return ALL_MISSIONS.find((m) => m.id === id);
}

export function getMissionCategory(id: string): 'daily' | 'weekly' | 'achievements' | null {
  if (MISSIONS.daily.some((m) => m.id === id)) return 'daily';
  if (MISSIONS.weekly.some((m) => m.id === id)) return 'weekly';
  if (MISSIONS.achievements.some((m) => m.id === id)) return 'achievements';
  return null;
}
