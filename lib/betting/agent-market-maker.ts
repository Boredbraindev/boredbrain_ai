/**
 * Agent Market Maker — ensures markets always have liquidity.
 * When a user takes a position and there's no counterparty,
 * an agent automatically takes the other side.
 *
 * Currency: BBAI
 */

import { db } from '@/lib/db';
import { externalAgent, bettingPosition } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { placeOrder } from './matching-engine';

// ─── Config ─────────────────────────────────────────────────────────

export interface MarketMakerConfig {
  maxExposure: number; // max BBAI per market per agent
  spreadBps: number; // spread in basis points (e.g. 300 = 3%)
  agentCount: number; // how many agents seed each market
}

const DEFAULT_CONFIG: MarketMakerConfig = {
  maxExposure: 2000,
  spreadBps: 300, // 3% spread
  agentCount: 5,
};

// ─── Analysis Templates ─────────────────────────────────────────────

const ANALYSIS_TEMPLATES: Record<string, { bullish: string[]; bearish: string[] }> = {
  crypto_price: {
    bullish: [
      'On-chain data shows accumulation phase. Whale wallets increasing holdings.',
      'Technical breakout forming. RSI at {rsi}, MACD crossover imminent.',
      'Funding rates turning positive. Institutional buying detected.',
      'Key support level holding strong. Buyers stepping in at every dip.',
      'Exchange outflows at 3-month high — supply squeeze forming.',
    ],
    bearish: [
      'Exchange inflows spiking — potential sell pressure ahead.',
      'Resistance at current level holding strong. Volume declining on rallies.',
      'Derivatives data shows overleveraged longs. Liquidation cascade risk.',
      'Bearish divergence on 4H chart. Momentum fading despite price holding.',
      'Stablecoin reserves on exchanges declining — less buying power available.',
    ],
  },
  agent_performance: {
    bullish: [
      "Agent's call volume trending up {pct}% week-over-week.",
      'Recent accuracy rate of {acc}% across last 50 forecasts.',
      'Growing user base — unique callers up 30% this week.',
      'Consistent response times under 2s. Reliability score: 98%.',
    ],
    bearish: [
      'Declining engagement metrics. Call volume down {pct}% this week.',
      'Error rate increasing — {err}% of recent calls failed.',
      'Response latency trending up. User satisfaction dropping.',
      'Competing agents gaining market share in same specialization.',
    ],
  },
  ecosystem: {
    bullish: [
      'Platform activity surging. Daily active wallets up {pct}%.',
      'New agent registrations accelerating. Ecosystem expanding rapidly.',
      'BBAI transaction volume at all-time high.',
      'Developer activity on GitHub increasing — new features incoming.',
    ],
    bearish: [
      'User retention dropping — 7-day active users declining.',
      'Gas costs eating into margins. Smaller agents becoming unprofitable.',
      'Market saturation in core categories. Growth plateauing.',
      'Competitive platforms launching similar features.',
    ],
  },
  defi: {
    bullish: [
      'TVL recovering post-correction. Major protocols showing inflows.',
      'Yield opportunities expanding. New farming strategies emerging.',
      'Cross-chain bridges seeing record volume. Liquidity deepening.',
      'Institutional DeFi adoption accelerating. New compliance tools launching.',
    ],
    bearish: [
      'Smart contract exploit risk elevated. Multiple audits flagging issues.',
      'Yield compression across major protocols. Returns becoming unattractive.',
      'Regulatory uncertainty creating headwinds for DeFi adoption.',
      'Impermanent loss exceeding yields on major LP positions.',
    ],
  },
  nft: {
    bullish: [
      'Blue-chip floor prices stabilizing. Smart money accumulating.',
      'New utility unlocks driving renewed interest in top collections.',
    ],
    bearish: [
      'Wash trading concerns. Real volume may be significantly lower.',
      'Floor prices under pressure. Panic selling detected in mid-tier collections.',
    ],
  },
};

// ─── Mock Agent Names ───────────────────────────────────────────────

const MOCK_AGENT_NAMES = [
  'DeFi Oracle', 'Alpha Hunter', 'Quant Engine', 'Risk Sentinel',
  'Yield Farmer', 'Chain Scout', 'Arb Bot', 'Whale Tracker',
  'Gas Optimizer', 'MEV Watcher', 'Liquidity Scout', 'Trend Surfer',
];

const MOCK_AGENT_SPECIALIZATIONS = [
  'crypto_price', 'defi', 'agent_performance', 'ecosystem', 'nft',
  'crypto_price', 'defi', 'crypto_price', 'ecosystem', 'defi',
  'defi', 'crypto_price',
];

// ─── Helper ─────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string): string {
  return template
    .replace('{rsi}', String(randomInt(30, 80)))
    .replace('{price}', `$${randomInt(50, 120)}k`)
    .replace('{pct}', String(randomInt(10, 45)))
    .replace('{acc}', String(randomInt(55, 85)))
    .replace('{err}', String(randomInt(5, 25)));
}

// ─── Fetch Fleet Agents ─────────────────────────────────────────────

async function getFleetAgents(count: number): Promise<Array<{ id: string; name: string; specialization: string }>> {
  try {
    const dbPromise = db
      .select({ id: externalAgent.id, name: externalAgent.name, specialization: externalAgent.specialization })
      .from(externalAgent)
      .where(eq(externalAgent.ownerAddress, 'platform-fleet'))
      .limit(count * 3); // fetch more, then pick random subset

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    const agents = await Promise.race([dbPromise, timeout]);
    if (agents.length === 0) throw new Error('no agents');

    // Shuffle and pick
    const shuffled = agents.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  } catch {
    // Fallback: mock agents
    const agents = [];
    for (let i = 0; i < count; i++) {
      const idx = i % MOCK_AGENT_NAMES.length;
      agents.push({
        id: `mock-agent-mm-${idx}`,
        name: MOCK_AGENT_NAMES[idx],
        specialization: MOCK_AGENT_SPECIALIZATIONS[idx],
      });
    }
    return agents;
  }
}

// ─── Seed Market Liquidity ──────────────────────────────────────────

/**
 * Seed a market with agent orders to provide initial liquidity.
 * Creates a natural-looking order book with spreads around fair value.
 */
export async function seedMarketLiquidity(
  marketId: string,
  config?: Partial<MarketMakerConfig>,
): Promise<{
  ordersPlaced: number;
  totalLiquidity: number;
  agents: string[];
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const agents = await getFleetAgents(cfg.agentCount);

  let ordersPlaced = 0;
  let totalLiquidity = 0;
  const agentNames: string[] = [];

  for (const agent of agents) {
    // Each agent generates a slightly different fair value (45-55%)
    const fairValue = randomInt(45, 55);
    const halfSpread = Math.round(cfg.spreadBps / 100 / 2);

    // Place BUY YES order (bid) — below fair value
    const bidPrice = Math.max(1, fairValue - halfSpread - randomInt(0, 3));
    const bidAmount = randomInt(50, 500);

    // Place BUY NO order (equivalent to SELL YES) — above fair value
    const askNoPrice = Math.max(1, 100 - fairValue - halfSpread - randomInt(0, 3));
    const askAmount = randomInt(50, 500);

    try {
      await placeOrder({
        marketId,
        userAddress: agent.id,
        userType: 'agent',
        side: 'Yes',
        price: bidPrice,
        amount: bidAmount,
      });
      ordersPlaced++;
      totalLiquidity += bidAmount * bidPrice;

      await placeOrder({
        marketId,
        userAddress: agent.id,
        userType: 'agent',
        side: 'No',
        price: askNoPrice,
        amount: askAmount,
      });
      ordersPlaced++;
      totalLiquidity += askAmount * askNoPrice;

      agentNames.push(agent.name);
    } catch (err) {
      console.error(`[market-maker] Failed to seed for agent ${agent.name}:`, err);
    }
  }

  return { ordersPlaced, totalLiquidity, agents: agentNames };
}

// ─── Ensure Agent Liquidity ─────────────────────────────────────────

/**
 * Called when a user position can't find a counterparty.
 * A fleet agent steps in to take the other side.
 */
export async function ensureAgentLiquidity(
  marketId: string,
  neededSide: string, // the side that needs a counterparty (complement of user's side)
  neededShares: number,
  maxPrice: number,
): Promise<{ filled: boolean; agentId: string | null }> {
  const agents = await getFleetAgents(1);
  if (agents.length === 0) return { filled: false, agentId: null };

  const agent = agents[0];

  // Check agent's current exposure in this market
  let currentExposure = 0;
  try {
    const positions = await db
      .select({ shares: bettingPosition.shares, avgPrice: bettingPosition.avgPrice })
      .from(bettingPosition)
      .where(
        and(
          eq(bettingPosition.marketId, marketId),
          eq(bettingPosition.userAddress, agent.id),
        ),
      );
    currentExposure = positions.reduce((sum: number, p: { shares: number; avgPrice: number }) => sum + p.shares * p.avgPrice, 0);
  } catch {
    // Can't check exposure, proceed with caution
  }

  if (currentExposure >= DEFAULT_CONFIG.maxExposure) {
    return { filled: false, agentId: null };
  }

  // Cap shares to stay within maxExposure
  const remainingExposure = DEFAULT_CONFIG.maxExposure - currentExposure;
  const affordableShares = Math.min(neededShares, Math.floor(remainingExposure / Math.max(maxPrice, 1)));
  const sharesToPlace = Math.max(1, affordableShares);

  const price = Math.max(1, Math.min(99, maxPrice));

  try {
    await placeOrder({
      marketId,
      userAddress: agent.id,
      userType: 'agent',
      side: neededSide,
      price,
      amount: sharesToPlace,
    });
    return { filled: true, agentId: agent.id };
  } catch (err) {
    console.error('[market-maker] ensureAgentLiquidity failed:', err);
    return { filled: false, agentId: null };
  }
}

// ─── Agent Market Analysis ──────────────────────────────────────────

/**
 * Generate analysis comments from agents who have positions in this market.
 * Uses templates (not LLM) for speed. Each agent's specialization colors their analysis.
 */
export async function getAgentMarketAnalysis(marketId: string): Promise<Array<{
  agentId: string;
  agentName: string;
  side: string;
  confidence: number;
  comment: string;
}>> {
  // Try to get actual agent positions
  let positionedAgents: Array<{ userAddress: string; outcome: string; shares: number }> = [];
  try {
    const dbPromise = db
      .select({
        userAddress: bettingPosition.userAddress,
        outcome: bettingPosition.outcome,
        shares: bettingPosition.shares,
      })
      .from(bettingPosition)
      .where(eq(bettingPosition.marketId, marketId));

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    positionedAgents = await Promise.race([dbPromise, timeout]);
  } catch {
    // Use mock
  }

  // If we have real positions, look up agent info
  if (positionedAgents.length > 0) {
    const analysis = [];
    for (const pos of positionedAgents.slice(0, 5)) {
      if (pos.shares <= 0) continue;

      let agentName = pos.userAddress;
      let specialization = 'crypto_price';
      try {
        const [agent] = await db
          .select({ name: externalAgent.name, specialization: externalAgent.specialization })
          .from(externalAgent)
          .where(eq(externalAgent.id, pos.userAddress))
          .limit(1);
        if (agent) {
          agentName = agent.name;
          specialization = agent.specialization;
        }
      } catch {
        // use address as name
      }

      const isBullish = pos.outcome === 'Yes' || pos.outcome === 'YES';
      const category = ANALYSIS_TEMPLATES[specialization] ?? ANALYSIS_TEMPLATES.crypto_price;
      const templates = isBullish ? category.bullish : category.bearish;
      const comment = fillTemplate(pickRandom(templates));
      const confidence = randomInt(52, 78);

      analysis.push({
        agentId: pos.userAddress,
        agentName,
        side: pos.outcome,
        confidence,
        comment,
      });
    }
    if (analysis.length > 0) return analysis;
  }

  // Fallback: generate mock analysis from random agents
  const mockCount = randomInt(2, 4);
  const analysis = [];
  const usedAgents = new Set<number>();

  for (let i = 0; i < mockCount; i++) {
    let idx = randomInt(0, MOCK_AGENT_NAMES.length - 1);
    while (usedAgents.has(idx)) idx = (idx + 1) % MOCK_AGENT_NAMES.length;
    usedAgents.add(idx);

    const isBullish = Math.random() > 0.5;
    const spec = MOCK_AGENT_SPECIALIZATIONS[idx];
    const category = ANALYSIS_TEMPLATES[spec] ?? ANALYSIS_TEMPLATES.crypto_price;
    const templates = isBullish ? category.bullish : category.bearish;
    const comment = fillTemplate(pickRandom(templates));

    analysis.push({
      agentId: `mock-agent-mm-${idx}`,
      agentName: MOCK_AGENT_NAMES[idx],
      side: isBullish ? 'Yes' : 'No',
      confidence: randomInt(52, 78),
      comment,
    });
  }

  return analysis;
}
