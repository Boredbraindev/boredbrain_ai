export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

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

// Inline getAgentMarketAnalysis (was from agent-market-maker which uses Drizzle)
async function getAgentMarketAnalysis(marketId: string, sql: ReturnType<typeof neon>): Promise<Array<{
  agentId: string;
  agentName: string;
  side: string;
  confidence: number;
  comment: string;
}>> {
  let positionedAgents: Array<{ user_address: string; outcome: string; shares: number }> = [];
  try {
    positionedAgents = await sql`
      SELECT user_address, outcome, shares FROM betting_position WHERE market_id = ${marketId}
    `;
  } catch {
    // Use mock
  }

  if (positionedAgents.length > 0) {
    const analysis = [];
    for (const pos of positionedAgents.slice(0, 5)) {
      if (pos.shares <= 0) continue;

      let agentName = pos.user_address;
      let specialization = 'crypto_price';
      try {
        const agentRows = await sql`
          SELECT name, specialization FROM external_agent WHERE id = ${pos.user_address} LIMIT 1
        `;
        if (agentRows.length > 0) {
          agentName = agentRows[0].name;
          specialization = agentRows[0].specialization;
        }
      } catch {
        // keep defaults
      }

      const confidence = Math.min(95, 50 + Math.floor(pos.shares / 10));
      analysis.push({
        agentId: pos.user_address,
        agentName,
        side: pos.outcome,
        confidence,
        comment: `${specialization} analysis supports ${pos.outcome} position with ${pos.shares} shares.`,
      });
    }
    if (analysis.length > 0) return analysis;
  }

  // Fallback mock analysis
  return [
    { agentId: 'mock-1', agentName: 'DeFi Oracle', side: 'Yes', confidence: 72, comment: 'On-chain data supports bullish thesis.' },
    { agentId: 'mock-2', agentName: 'Risk Sentinel', side: 'No', confidence: 58, comment: 'Volatility metrics suggest caution.' },
    { agentId: 'mock-3', agentName: 'Alpha Hunter', side: 'Yes', confidence: 65, comment: 'Momentum indicators are positive.' },
  ];
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

    const sql = neon(process.env.DATABASE_URL!);

    // Try DB first
    try {
      const dbPromise = (async () => {
        // Verify market exists
        const marketRows = await sql`
          SELECT id, title, status FROM betting_market WHERE id = ${marketId} LIMIT 1
        `;
        if (!marketRows.length) return null;
        const market = marketRows[0];

        // Get recent trades
        const trades = await sql`
          SELECT * FROM betting_trade WHERE market_id = ${marketId} ORDER BY created_at DESC LIMIT ${limit}
        `;

        return { market, trades };
      })();

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      const result = await Promise.race([dbPromise, timeout]);

      if (result && result.market) {
        const feed = result.trades.map((t: any) => ({
          id: t.id,
          user: t.buyer_address.length > 10
            ? `${t.buyer_address.slice(0, 4)}...${t.buyer_address.slice(-2)}`
            : t.buyer_address,
          userType: 'user' as const,
          side: t.outcome,
          shares: t.shares,
          price: t.price,
          bbaiAmount: t.bbai_amount,
          timestamp: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
        }));

        // Get agent analysis
        const agentAnalysis = await getAgentMarketAnalysis(marketId, sql);

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
    const agentAnalysis = await getAgentMarketAnalysis(marketId, sql);

    // Try to get market title from DB
    let marketTitle = 'Insight Market';
    try {
      const marketRows = await sql`
        SELECT title FROM betting_market WHERE id = ${marketId} LIMIT 1
      `;
      if (marketRows.length > 0) {
        marketTitle = marketRows[0].title;
      }
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
