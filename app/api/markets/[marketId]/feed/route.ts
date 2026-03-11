import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { bettingTrade, bettingMarket } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAgentMarketAnalysis } from '@/lib/betting/agent-market-maker';
import { getMarketView } from '@/lib/betting/simple-bet';

// ─── Mock Feed ──────────────────────────────────────────────────────

function generateMockFeed(marketId: string, limit: number) {
  const sides = ['Yes', 'No'];
  const users = [
    { name: '0xab...cd', type: 'user' as const },
    { name: '0xef...12', type: 'user' as const },
    { name: '0x34...56', type: 'user' as const },
    { name: 'DeFi Oracle', type: 'agent' as const },
    { name: 'Alpha Hunter', type: 'agent' as const },
    { name: 'Quant Engine', type: 'agent' as const },
    { name: 'Risk Sentinel', type: 'agent' as const },
  ];

  const feed = [];
  for (let i = 0; i < limit; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    feed.push({
      id: `mock-feed-${marketId}-${i}`,
      user: user.name,
      userType: user.type,
      side: sides[Math.floor(Math.random() * sides.length)],
      shares: Math.floor(Math.random() * 200) + 10,
      price: Math.floor(Math.random() * 40) + 30,
      bbaiAmount: Math.floor(Math.random() * 2000) + 50,
      timestamp: new Date(Date.now() - i * 180000).toISOString(),
    });
  }
  return feed;
}

// ─── GET /api/markets/[marketId]/feed?limit=20 ─────────────────────
// Recent activity feed: bets (user + agent), probability changes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  try {
    const { marketId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100);

    // Try DB first
    try {
      const dbPromise = (async () => {
        // Verify market exists
        const [market] = await db
          .select({ id: bettingMarket.id, title: bettingMarket.title, status: bettingMarket.status })
          .from(bettingMarket)
          .where(eq(bettingMarket.id, marketId))
          .limit(1);

        if (!market) return null;

        // Get recent trades
        const trades = await db
          .select()
          .from(bettingTrade)
          .where(eq(bettingTrade.marketId, marketId))
          .orderBy(desc(bettingTrade.createdAt))
          .limit(limit);

        return { market, trades };
      })();

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      const result = await Promise.race([dbPromise, timeout]);

      if (result && result.market) {
        const feed = result.trades.map((t: any) => ({
          id: t.id,
          user: t.buyerAddress.length > 10
            ? `${t.buyerAddress.slice(0, 4)}...${t.buyerAddress.slice(-2)}`
            : t.buyerAddress,
          userType: 'user' as const,
          side: t.outcome,
          shares: t.shares,
          price: t.price,
          bbaiAmount: t.bbaiAmount,
          timestamp: t.createdAt?.toISOString() ?? new Date().toISOString(),
        }));

        // Get agent analysis
        const agentAnalysis = await getAgentMarketAnalysis(marketId);

        return apiSuccess({
          marketId,
          marketTitle: result.market.title,
          feed,
          agentAnalysis,
          total: feed.length,
        });
      }
    } catch {
      // Fall through to mock
    }

    // Fallback: mock feed
    const feed = generateMockFeed(marketId, limit);
    const agentAnalysis = await getAgentMarketAnalysis(marketId);

    // Try to get market title from MarketView
    let marketTitle = 'Prediction Market';
    try {
      const view = await getMarketView(marketId);
      marketTitle = view.title;
    } catch {
      // use default
    }

    return apiSuccess({
      marketId,
      marketTitle,
      feed,
      agentAnalysis,
      total: feed.length,
      _source: 'mock',
    });
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch market feed', 500);
  }
}
