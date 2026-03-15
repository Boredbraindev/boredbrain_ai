export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { createPlaybook, purchasePlaybook, getPlaybooks } from '@/lib/playbook-marketplace';

const MOCK_PLAYBOOKS = [
  { id: 'pb-1', title: 'DeFi Yield Maximizer Strategy', description: 'Proven debate strategy combining deep DeFi protocol analysis with real-time yield comparisons. Uses coin_data and wallet_analyzer tools for comprehensive on-chain evidence.', matchType: 'debate', winRate: 0.92, price: 75, totalSales: 284, totalRevenue: 21300, rating: 4.9, featured: true, creatorId: 'creator-1', agentId: 'agent-defi-oracle', status: 'active', createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z' },
  { id: 'pb-2', title: 'Alpha Signal Detector', description: 'Lightning-fast search race strategy that combines X/Twitter sentiment with on-chain whale movements. Optimized for speed and accuracy scoring.', matchType: 'search_race', winRate: 0.88, price: 60, totalSales: 196, totalRevenue: 11760, rating: 4.7, featured: true, creatorId: 'creator-2', agentId: 'agent-alpha-hunter', status: 'active', createdAt: '2026-02-20T14:00:00Z', updatedAt: '2026-02-20T14:00:00Z' },
  { id: 'pb-3', title: 'Academic Deep Research Protocol', description: 'Comprehensive research strategy leveraging academic_search, web_search, and retrieve tools. Maximizes tool usage score with systematic multi-source analysis.', matchType: 'research', winRate: 0.85, price: 80, totalSales: 142, totalRevenue: 11360, rating: 4.8, featured: false, creatorId: 'creator-3', agentId: 'agent-research-bot', status: 'active', createdAt: '2026-02-25T09:00:00Z', updatedAt: '2026-02-25T09:00:00Z' },
  { id: 'pb-4', title: 'Smart Contract Audit Blitz', description: 'Rapid security analysis strategy for debate matches. Combines code_interpreter with smart_contract_audit for unbeatable technical arguments.', matchType: 'debate', winRate: 0.82, price: 100, totalSales: 98, totalRevenue: 9800, rating: 4.6, featured: false, creatorId: 'creator-4', agentId: 'agent-code-auditor', status: 'active', createdAt: '2026-03-01T11:00:00Z', updatedAt: '2026-03-01T11:00:00Z' },
  { id: 'pb-5', title: 'NFT Market Pulse Scanner', description: 'Search race playbook optimized for NFT market data. Uses nft_retrieval and wallet_analyzer to find alpha faster than any competitor.', matchType: 'search_race', winRate: 0.79, price: 55, totalSales: 167, totalRevenue: 9185, rating: 4.5, featured: false, creatorId: 'creator-5', agentId: 'agent-nft-analyst', status: 'active', createdAt: '2026-02-28T16:00:00Z', updatedAt: '2026-02-28T16:00:00Z' },
  { id: 'pb-6', title: 'Whale Movement Tracker Pro', description: 'Research-focused strategy for tracking large wallet movements. Combines whale_alert with wallet_analyzer for institutional-grade on-chain intelligence.', matchType: 'research', winRate: 0.87, price: 90, totalSales: 124, totalRevenue: 11160, rating: 4.8, featured: true, creatorId: 'creator-6', agentId: 'agent-defi-oracle', status: 'active', createdAt: '2026-03-03T08:00:00Z', updatedAt: '2026-03-03T08:00:00Z' },
  { id: 'pb-7', title: 'Multi-Source News Aggregation', description: 'Debate powerhouse combining web_search, x_search, and reddit_search for comprehensive news coverage. Excels in current events topics.', matchType: 'debate', winRate: 0.76, price: 45, totalSales: 231, totalRevenue: 10395, rating: 4.4, featured: false, creatorId: 'creator-7', agentId: 'agent-news-wire', status: 'active', createdAt: '2026-02-18T13:00:00Z', updatedAt: '2026-02-18T13:00:00Z' },
  { id: 'pb-8', title: 'Cross-Chain Analysis Framework', description: 'Advanced research strategy analyzing token data across multiple chains. Uses coin_ohlc, token_retrieval, and extreme_search for comprehensive multi-chain analysis.', matchType: 'research', winRate: 0.84, price: 120, totalSales: 76, totalRevenue: 9120, rating: 4.7, featured: false, creatorId: 'creator-8', agentId: 'agent-alpha-hunter', status: 'active', createdAt: '2026-03-05T10:00:00Z', updatedAt: '2026-03-05T10:00:00Z' },
  { id: 'pb-9', title: 'Speed Demon Search Config', description: 'Ultra-optimized search race strategy focusing on speed score. Minimal tool usage with maximum accuracy — the fastest wins.', matchType: 'search_race', winRate: 0.91, price: 65, totalSales: 189, totalRevenue: 12285, rating: 4.6, featured: false, creatorId: 'creator-9', agentId: 'agent-market-sentinel', status: 'active', createdAt: '2026-02-22T15:00:00Z', updatedAt: '2026-02-22T15:00:00Z' },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'purchase') {
      const { playbookId, buyerId } = body;
      if (!playbookId || !buyerId) {
        return NextResponse.json({ error: 'playbookId and buyerId are required' }, { status: 400 });
      }
      const purchase = await purchasePlaybook({ playbookId, buyerId });
      return NextResponse.json({ purchase }, { status: 201 });
    }

    // Default: create playbook
    const { creatorId, title, systemPrompt, toolConfig } = body;
    if (!creatorId || !title || !systemPrompt) {
      return NextResponse.json({ error: 'creatorId, title, and systemPrompt are required' }, { status: 400 });
    }

    const pb = await createPlaybook({
      creatorId,
      title,
      description: body.description,
      systemPrompt,
      toolConfig: toolConfig || [],
      agentId: body.agentId,
      matchId: body.matchId,
      matchType: body.matchType,
      winRate: body.winRate,
      price: body.price,
    });
    return NextResponse.json({ playbook: pb }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchType = searchParams.get('matchType') || undefined;
  const featured = searchParams.get('featured') === 'true';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

  try {
    const dbPromise = getPlaybooks({ matchType, featured, limit });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );
    const playbooks = await Promise.race([dbPromise, timeout]);

    if (playbooks.length > 0) {
      return NextResponse.json({ playbooks }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
  } catch {
    // DB error or timeout — fall through to mock
  }

  // Mock fallback
  let mockData = MOCK_PLAYBOOKS;
  if (matchType) mockData = mockData.filter((p) => p.matchType === matchType);
  if (featured) mockData = mockData.filter((p) => p.featured);
  if (limit) mockData = mockData.slice(0, limit);

  return NextResponse.json({ playbooks: mockData });
}
