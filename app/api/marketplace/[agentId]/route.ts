import { NextRequest, NextResponse } from 'next/server';
import {
  getListing,
  getReviews,
  getPerformance,
} from '@/lib/agent-marketplace';
import { MOCK_MARKETPLACE_LISTINGS } from '@/lib/mock-marketplace';

// Generate deterministic mock performance from listing data
function mockPerformance(agentId: string, period: '24h' | '7d' | '30d', listing: typeof MOCK_MARKETPLACE_LISTINGS[0]) {
  const mult = period === '24h' ? 1 : period === '7d' ? 7 : 30;
  const calls = Math.floor((listing.totalCalls / 30) * mult);
  const successful = Math.floor(calls * (listing.successRate / 100));
  // Deterministic seed
  let seed = 0;
  for (let i = 0; i < agentId.length; i++) seed = ((seed << 5) - seed + agentId.charCodeAt(i)) | 0;
  const sr = (s: number) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    calls: Math.max(1, Math.floor((calls / 24) * (h >= 8 && h <= 23 ? 0.8 : 0.3) * (0.7 + sr(seed + h) * 0.6))),
  }));
  return {
    agentId, period, totalCalls: calls, successfulCalls: successful,
    failedCalls: calls - successful, avgResponseTime: listing.avgResponseTime,
    totalEarned: Math.floor(calls * listing.pricing.perCall * 0.85),
    uniqueCallers: Math.floor(calls * 0.35),
    topTools: listing.tools.map((t, i) => ({ tool: t, calls: Math.max(5, Math.floor(calls / (i + 1.5))) })),
    hourlyActivity: hourly,
  };
}

// Generate mock reviews for a listing
function mockReviews(agentId: string, listing: typeof MOCK_MARKETPLACE_LISTINGS[0]) {
  const names = ['CryptoTrader.eth', 'DeFiDegen', 'AlphaSeeker', 'OnchainPro', 'Web3Builder'];
  const titles = ['Excellent results', 'Very reliable', 'Great tool', 'Solid agent', 'Worth the price'];
  const comments = [
    'This agent consistently delivers high-quality results. Highly recommended for serious traders.',
    'Fast response times and accurate data. One of the best agents on the platform.',
    'Good performance overall. The tool integration is seamless and the output is actionable.',
    'Been using this for a few weeks now. Very stable and the accuracy is impressive.',
    'Great value for the USDT cost. Saves me hours of manual research.',
  ];
  return Array.from({ length: Math.min(listing.reviewCount, 5) }, (_, i) => ({
    id: `review-${agentId}-${i}`,
    agentId,
    reviewerAddress: `0x${(i + 1).toString(16).padStart(4, '0')}${'a'.repeat(36)}`,
    reviewerName: names[i % names.length],
    rating: Math.max(3, Math.min(5, Math.round(listing.rating + (i % 2 === 0 ? 0 : -0.5)))),
    title: titles[i % titles.length],
    comment: comments[i % comments.length],
    helpful: Math.floor(Math.random() * 20),
    timestamp: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString(),
  }));
}

/**
 * GET /api/marketplace/[agentId] - Get full agent detail with reviews and performance
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  try {
    const listing = await getListing(agentId);
    if (listing) {
      const reviews = await getReviews(agentId);
      const performance24h = await getPerformance(agentId, '24h');
      const performance7d = await getPerformance(agentId, '7d');
      const performance30d = await getPerformance(agentId, '30d');
      return NextResponse.json({
        listing, reviews,
        performance: { '24h': performance24h, '7d': performance7d, '30d': performance30d },
      });
    }
  } catch {
    // DB error - fall through to mock
  }

  // Fallback to mock marketplace listings
  const mock = MOCK_MARKETPLACE_LISTINGS.find((l) => l.agentId === agentId);
  if (!mock) {
    return NextResponse.json({ error: 'Agent not found in marketplace' }, { status: 404 });
  }

  return NextResponse.json({
    listing: mock,
    reviews: mockReviews(agentId, mock),
    performance: {
      '24h': mockPerformance(agentId, '24h', mock),
      '7d': mockPerformance(agentId, '7d', mock),
      '30d': mockPerformance(agentId, '30d', mock),
    },
  });
}
