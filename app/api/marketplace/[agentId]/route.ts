import { NextRequest, NextResponse } from 'next/server';
import {
  getListing,
  getReviews,
  getPerformance,
} from '@/lib/agent-marketplace';

/**
 * GET /api/marketplace/[agentId] - Get full agent detail with reviews and performance
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const listing = await getListing(agentId);

  if (!listing) {
    return NextResponse.json(
      { error: 'Agent not found in marketplace' },
      { status: 404 },
    );
  }

  const reviews = await getReviews(agentId);
  const performance24h = await getPerformance(agentId, '24h');
  const performance7d = await getPerformance(agentId, '7d');
  const performance30d = await getPerformance(agentId, '30d');

  return NextResponse.json({
    listing,
    reviews,
    performance: {
      '24h': performance24h,
      '7d': performance7d,
      '30d': performance30d,
    },
  });
}
