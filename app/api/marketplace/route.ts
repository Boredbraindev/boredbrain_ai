import { NextRequest, NextResponse } from 'next/server';
import {
  getListings,
  getMarketplaceStats,
} from '@/lib/agent-marketplace';

/**
 * GET /api/marketplace - List marketplace agents with optional filters
 *
 * Query params:
 *   ?specialization=defi    - Filter by specialization
 *   ?sort=rating|calls|earned - Sort order
 *   ?featured=true          - Featured agents only
 *   ?search=query           - Search by name, description, tags
 *   ?minRating=4            - Minimum rating filter
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const specialization = searchParams.get('specialization') ?? undefined;
  const sort = searchParams.get('sort') as 'rating' | 'calls' | 'earned' | undefined;
  const featured = searchParams.get('featured') === 'true' ? true : undefined;
  const search = searchParams.get('search') ?? undefined;
  const minRatingStr = searchParams.get('minRating');
  const minRating = minRatingStr ? parseFloat(minRatingStr) : undefined;

  const listings = await getListings({
    specialization,
    sort,
    featured,
    search,
    minRating,
  });

  const stats = await getMarketplaceStats();

  return NextResponse.json({
    listings,
    stats,
    count: listings.length,
  });
}
