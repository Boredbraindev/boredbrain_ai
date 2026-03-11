/**
 * Simple P2P Betting — abstracts the order book away.
 * Users just pick YES/NO and amount. Agents provide liquidity.
 *
 * Currency: BBAI
 */

import { db } from '@/lib/db';
import { bettingMarket, bettingTrade, bettingPosition } from '@/lib/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { placeOrder, getOrderBook, getMarketStats } from './matching-engine';
import { ensureAgentLiquidity } from './agent-market-maker';

// ─── Types ──────────────────────────────────────────────────────────

export interface SimpleBetResult {
  betId: string;
  side: string;
  amount: number; // BBAI spent
  shares: number; // shares received
  avgPrice: number; // average fill price (1-99)
  expectedPayout: number; // if correct: shares x 97.5 (after 2.5% fee)
  matched: boolean; // was it fully matched?
  bpEarned: number; // BP points earned
}

export interface MarketView {
  id: string;
  title: string;
  category: string;
  outcomes: string[];
  probability: Record<string, number>; // e.g. { Yes: 64, No: 36 }
  totalVolume: number;
  participants: number;
  recentBets: Array<{
    user: string;
    userType: 'user' | 'agent';
    side: string;
    amount: number;
    timestamp: string;
  }>;
  agentAnalysis: Array<{
    agentName: string;
    side: string;
    confidence: number;
    comment: string;
  }>;
  resolvesAt: string | null;
  status: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────

const MOCK_MARKETS: MarketView[] = [
  {
    id: 'mock-market-1',
    title: 'BTC above $100k by end of week?',
    category: 'crypto_price',
    outcomes: ['Yes', 'No'],
    probability: { Yes: 62, No: 38 },
    totalVolume: 45200,
    participants: 87,
    recentBets: [
      { user: '0xab...cd', userType: 'user', side: 'Yes', amount: 200, timestamp: new Date(Date.now() - 120000).toISOString() },
      { user: 'DeFi Oracle', userType: 'agent', side: 'No', amount: 500, timestamp: new Date(Date.now() - 300000).toISOString() },
    ],
    agentAnalysis: [
      { agentName: 'DeFi Oracle', side: 'No', confidence: 62, comment: 'Resistance at $100k holding strong. Volume declining on rallies.' },
      { agentName: 'Alpha Hunter', side: 'Yes', confidence: 58, comment: 'On-chain data shows accumulation phase. Whale wallets increasing holdings.' },
    ],
    resolvesAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: 'open',
  },
  {
    id: 'mock-market-2',
    title: 'Top agent by calls this week: DeFi Oracle or Alpha Hunter?',
    category: 'agent_performance',
    outcomes: ['DeFi Oracle', 'Alpha Hunter'],
    probability: { 'DeFi Oracle': 55, 'Alpha Hunter': 45 },
    totalVolume: 12800,
    participants: 42,
    recentBets: [
      { user: '0xef...12', userType: 'user', side: 'DeFi Oracle', amount: 150, timestamp: new Date(Date.now() - 60000).toISOString() },
    ],
    agentAnalysis: [
      { agentName: 'Research Bot', side: 'DeFi Oracle', confidence: 60, comment: "Agent's call volume trending up 23% week-over-week." },
    ],
    resolvesAt: new Date(Date.now() + 6 * 86400000).toISOString(),
    status: 'open',
  },
  {
    id: 'mock-market-3',
    title: 'ETH above $5,000 by end of month?',
    category: 'crypto_price',
    outcomes: ['Yes', 'No'],
    probability: { Yes: 44, No: 56 },
    totalVolume: 89500,
    participants: 156,
    recentBets: [
      { user: 'Quant Engine', userType: 'agent', side: 'Yes', amount: 800, timestamp: new Date(Date.now() - 180000).toISOString() },
      { user: '0x34...56', userType: 'user', side: 'No', amount: 300, timestamp: new Date(Date.now() - 420000).toISOString() },
    ],
    agentAnalysis: [
      { agentName: 'Quant Engine', side: 'Yes', confidence: 52, comment: 'Funding rates turning positive. Institutional buying detected.' },
      { agentName: 'Risk Sentinel', side: 'No', confidence: 65, comment: 'Derivatives data shows overleveraged longs. Liquidation cascade risk.' },
    ],
    resolvesAt: new Date(Date.now() + 20 * 86400000).toISOString(),
    status: 'open',
  },
  {
    id: 'mock-market-4',
    title: 'Arena battles completed this week: over 50?',
    category: 'ecosystem',
    outcomes: ['Yes', 'No'],
    probability: { Yes: 71, No: 29 },
    totalVolume: 6400,
    participants: 31,
    recentBets: [],
    agentAnalysis: [
      { agentName: 'Ecosystem Tracker', side: 'Yes', confidence: 70, comment: 'Current pace: 38 battles in 4 days. Projection exceeds target.' },
    ],
    resolvesAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    status: 'open',
  },
  {
    id: 'mock-market-5',
    title: 'Total DeFi TVL above $200B by month end?',
    category: 'defi',
    outcomes: ['Yes', 'No'],
    probability: { Yes: 58, No: 42 },
    totalVolume: 34100,
    participants: 98,
    recentBets: [
      { user: '0x78...9a', userType: 'user', side: 'Yes', amount: 500, timestamp: new Date(Date.now() - 600000).toISOString() },
    ],
    agentAnalysis: [
      { agentName: 'DeFi Oracle', side: 'Yes', confidence: 63, comment: 'TVL recovering post-correction. Major protocols showing inflows.' },
    ],
    resolvesAt: new Date(Date.now() + 18 * 86400000).toISOString(),
    status: 'open',
  },
];

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Place a simple bet — user picks a side and amount, we handle the rest.
 */
export async function placeBet(input: {
  marketId: string;
  userAddress: string;
  userType: 'user' | 'agent';
  side: string; // 'YES' or 'NO' (or outcome name)
  amount: number; // BBAI to spend
}): Promise<SimpleBetResult> {
  // 1. Get current probability from order book
  let currentPrice = 50;
  try {
    const stats = await getMarketStats(input.marketId);
    const sideNormalized =
      input.side.toUpperCase() === 'YES' ? 'Yes' :
      input.side.toUpperCase() === 'NO' ? 'No' :
      input.side;
    currentPrice = stats.currentPrices[sideNormalized] ?? 50;
  } catch {
    // No market data yet, default to 50
  }

  // 2. Clamp price to valid range
  const price = Math.max(1, Math.min(99, currentPrice));

  // 3. Calculate shares: amount of shares = BBAI / (price / 100)
  //    e.g. 100 BBAI at price 60 = 100 / 0.60 = ~166 shares
  //    But matching engine uses integer amounts (shares), so we use amount directly
  //    The matching engine treats `amount` as shares, each share costs `price` BBAI-cents
  const shares = input.amount;

  // 4. Place order via matching engine
  const result = await placeOrder({
    marketId: input.marketId,
    userAddress: input.userAddress,
    userType: input.userType,
    side: input.side,
    price,
    amount: shares,
  });

  // 5. If not fully filled, try agent liquidity
  let agentFilled = false;
  if (result.filled < shares) {
    try {
      const needed = shares - result.filled;
      const complementSide = input.side.toUpperCase() === 'YES' ? 'No' :
        input.side.toUpperCase() === 'NO' ? 'Yes' : input.side;
      const agentResult = await ensureAgentLiquidity(
        input.marketId,
        complementSide,
        needed,
        100 - price,
      );
      agentFilled = agentResult.filled;
    } catch {
      // Agent liquidity unavailable, partial fill is OK
    }
  }

  const totalFilled = agentFilled ? shares : result.filled;
  const avgPrice = result.trades.length > 0
    ? Math.round(result.trades.reduce((s, t) => s + t.price * t.shares, 0) / Math.max(1, result.trades.reduce((s, t) => s + t.shares, 0)))
    : price;

  // Expected payout: shares x 97.5 BBAI (100 payout minus 2.5% fee)
  const expectedPayout = Math.round(totalFilled * 97.5);
  const bpEarned = 10; // prediction_bet BP

  return {
    betId: result.orderId,
    side: input.side,
    amount: input.amount,
    shares: totalFilled,
    avgPrice,
    expectedPayout,
    matched: totalFilled >= shares,
    bpEarned,
  };
}

/**
 * Get a clean market view for the UI — no order book, just probabilities.
 */
export async function getMarketView(marketId: string): Promise<MarketView> {
  try {
    // Try DB first
    const dbPromise = db
      .select()
      .from(bettingMarket)
      .where(eq(bettingMarket.id, marketId))
      .limit(1);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    const [market] = await Promise.race([dbPromise, timeout]);
    if (!market) throw new Error('not found');

    // Get current prices as probability
    const stats = await getMarketStats(marketId);
    const probability: Record<string, number> = {};
    for (const outcome of market.outcomes) {
      probability[outcome] = stats.currentPrices[outcome] ?? 50;
    }

    // Get recent trades
    const trades = await db
      .select()
      .from(bettingTrade)
      .where(eq(bettingTrade.marketId, marketId))
      .orderBy(desc(bettingTrade.createdAt))
      .limit(20);

    const recentBets = trades.map((t: any) => ({
      user: t.buyerAddress.length > 10
        ? `${t.buyerAddress.slice(0, 4)}...${t.buyerAddress.slice(-2)}`
        : t.buyerAddress,
      userType: 'user' as const,
      side: t.outcome,
      amount: t.bbaiAmount,
      timestamp: t.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    // Count unique participants
    const participantResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${bettingPosition.userAddress})` })
      .from(bettingPosition)
      .where(eq(bettingPosition.marketId, marketId));
    const participants = Number(participantResult[0]?.count ?? 0);

    // Agent analysis from metadata or empty
    const agentAnalysis: MarketView['agentAnalysis'] =
      (market.metadata as any)?.agentAnalysis ?? [];

    return {
      id: market.id,
      title: market.title,
      category: market.category,
      outcomes: market.outcomes,
      probability,
      totalVolume: market.totalVolume,
      participants,
      recentBets,
      agentAnalysis,
      resolvesAt: market.resolvesAt?.toISOString() ?? null,
      status: market.status,
    };
  } catch {
    // Fallback to mock
    const mock = MOCK_MARKETS.find((m) => m.id === marketId);
    if (mock) return mock;
    return MOCK_MARKETS[0];
  }
}

/**
 * Return hot markets sorted by volume.
 */
export async function getHotMarkets(limit: number = 10): Promise<MarketView[]> {
  try {
    const dbPromise = db
      .select()
      .from(bettingMarket)
      .where(eq(bettingMarket.status, 'open'))
      .orderBy(desc(bettingMarket.totalVolume))
      .limit(limit);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    const markets = await Promise.race([dbPromise, timeout]);

    const views: MarketView[] = [];
    for (const market of markets) {
      // Get probabilities
      let probability: Record<string, number> = {};
      try {
        const stats = await getMarketStats(market.id);
        for (const outcome of market.outcomes) {
          probability[outcome] = stats.currentPrices[outcome] ?? 50;
        }
      } catch {
        for (const outcome of market.outcomes) {
          probability[outcome] = 50;
        }
      }

      // Participant count
      let participants = 0;
      try {
        const res = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${bettingPosition.userAddress})` })
          .from(bettingPosition)
          .where(eq(bettingPosition.marketId, market.id));
        participants = Number(res[0]?.count ?? 0);
      } catch {
        // ignore
      }

      views.push({
        id: market.id,
        title: market.title,
        category: market.category,
        outcomes: market.outcomes,
        probability,
        totalVolume: market.totalVolume,
        participants,
        recentBets: [],
        agentAnalysis: (market.metadata as any)?.agentAnalysis ?? [],
        resolvesAt: market.resolvesAt?.toISOString() ?? null,
        status: market.status,
      });
    }

    return views;
  } catch {
    // Fallback to mock
    return MOCK_MARKETS.slice(0, limit);
  }
}

/**
 * Get a user's active bets with current P&L.
 */
export async function getMyBets(walletAddress: string): Promise<Array<{
  market: { id: string; title: string; status: string };
  side: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}>> {
  try {
    const dbPromise = db
      .select()
      .from(bettingPosition)
      .where(eq(bettingPosition.userAddress, walletAddress))
      .orderBy(desc(bettingPosition.updatedAt));

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    const positions = await Promise.race([dbPromise, timeout]);

    const results = [];
    for (const pos of positions) {
      if (pos.shares <= 0) continue;

      // Get market info
      let marketTitle = 'Unknown Market';
      let marketStatus = 'open';
      let currentPrice = 50;

      try {
        const [market] = await db
          .select({ id: bettingMarket.id, title: bettingMarket.title, status: bettingMarket.status })
          .from(bettingMarket)
          .where(eq(bettingMarket.id, pos.marketId))
          .limit(1);
        if (market) {
          marketTitle = market.title;
          marketStatus = market.status;
        }
      } catch {
        // use defaults
      }

      try {
        const stats = await getMarketStats(pos.marketId);
        currentPrice = stats.currentPrices[pos.outcome] ?? 50;
      } catch {
        // use default 50
      }

      const costBasis = pos.shares * pos.avgPrice;
      const currentValue = pos.shares * currentPrice;
      const pnl = currentValue - costBasis + pos.realizedPnl;
      const pnlPercent = costBasis > 0 ? Math.round((pnl / costBasis) * 10000) / 100 : 0;

      results.push({
        market: { id: pos.marketId, title: marketTitle, status: marketStatus },
        side: pos.outcome,
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        currentPrice,
        pnl,
        pnlPercent,
      });
    }

    return results;
  } catch {
    // Return empty on error
    return [];
  }
}
