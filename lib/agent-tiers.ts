/**
 * Agent Tier System
 *
 * Tiers determine initial BBAI balance, daily limits, and participation costs.
 * Mirrors user level system (Newbie→OG) for agents.
 */

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

export interface AgentTier {
  name: string;
  stakeRequired: number;   // BBAI to register (0 = demo)
  initialBalance: number;  // BBAI granted on wallet creation
  dailyLimit: number;      // Max BBAI spend per day
  debateCost: number;      // BBAI cost per debate participation
  maxSlots: number;        // Max agents per wallet at this user level
  freeSlots: number;       // Free (demo) slots at this user level
}

export const AGENT_TIERS: Record<string, AgentTier> = {
  demo:    { name: 'Demo',    stakeRequired: 0,   initialBalance: 50,   dailyLimit: 50,   debateCost: 2, maxSlots: 1,  freeSlots: 1 },
  basic:   { name: 'Basic',   stakeRequired: 100, initialBalance: 200,  dailyLimit: 200,  debateCost: 2, maxSlots: 2,  freeSlots: 1 },
  premium: { name: 'Premium', stakeRequired: 250, initialBalance: 500,  dailyLimit: 500,  debateCost: 1, maxSlots: 5,  freeSlots: 2 },
  elite:   { name: 'Elite',   stakeRequired: 500, initialBalance: 1000, dailyLimit: 1000, debateCost: 0, maxSlots: 10, freeSlots: 3 },
  fleet:   { name: 'Fleet',   stakeRequired: 0,   initialBalance: 1000, dailyLimit: 500,  debateCost: 2, maxSlots: 999, freeSlots: 999 },
};

// ---------------------------------------------------------------------------
// User level → agent slot mapping
// ---------------------------------------------------------------------------

export interface UserLevelSlots {
  maxAgents: number;
  freeDemo: number;
  initialBbai: number;
}

const USER_LEVEL_SLOTS: Record<number, UserLevelSlots> = {
  1:  { maxAgents: 1,  freeDemo: 1, initialBbai: 50 },   // Newbie
  5:  { maxAgents: 2,  freeDemo: 1, initialBbai: 50 },   // Trader
  10: { maxAgents: 3,  freeDemo: 1, initialBbai: 100 },  // Analyst
  20: { maxAgents: 5,  freeDemo: 2, initialBbai: 100 },  // Strategist
  30: { maxAgents: 10, freeDemo: 3, initialBbai: 200 },  // Whale
  50: { maxAgents: 999, freeDemo: 5, initialBbai: 500 },  // OG
};

/**
 * Get slot limits for a user level.
 * Falls back to nearest lower level threshold.
 * Pro subscribers get +5 extra slots.
 */
export function getSlotsForLevel(level: number, isPro: boolean = false): UserLevelSlots {
  const thresholds = Object.keys(USER_LEVEL_SLOTS)
    .map(Number)
    .sort((a, b) => b - a);

  let slots = USER_LEVEL_SLOTS[1];
  for (const t of thresholds) {
    if (level >= t) {
      slots = USER_LEVEL_SLOTS[t];
      break;
    }
  }

  if (isPro) {
    return {
      ...slots,
      maxAgents: slots.maxAgents + 5,
      freeDemo: slots.freeDemo + 2,
    };
  }

  return slots;
}

/**
 * Determine tier from staking amount.
 */
export function getTierFromStake(stakeAmount: number, isFleet: boolean = false): AgentTier {
  if (isFleet) return AGENT_TIERS.fleet;
  if (stakeAmount >= 500) return AGENT_TIERS.elite;
  if (stakeAmount >= 250) return AGENT_TIERS.premium;
  if (stakeAmount >= 100) return AGENT_TIERS.basic;
  return AGENT_TIERS.demo;
}

/**
 * Get debate cost with Pro discount.
 * Pro subscribers pay 50% less for debate participation.
 */
export function getDebateCost(tier: AgentTier, isPro: boolean = false): number {
  if (tier.debateCost === 0) return 0;
  return isPro ? Math.max(1, Math.floor(tier.debateCost * 0.5)) : tier.debateCost;
}

/** Standard debate participation cost (BBAI) */
export const DEFAULT_DEBATE_COST = 2;
