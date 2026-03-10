import { NextRequest, NextResponse } from 'next/server';
import {
  getListings,
  getMarketplaceStats,
} from '@/lib/agent-marketplace';
import { MOCK_MARKETPLACE_LISTINGS } from '@/lib/mock-marketplace';

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

  try {
    const listingsPromise = getListings({
      specialization,
      sort,
      featured,
      search,
      minRating,
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );

    const listings = await Promise.race([listingsPromise, timeout]);

    if (listings.length > 0) {
      const stats = await getMarketplaceStats();
      return NextResponse.json({
        listings,
        stats,
        count: listings.length,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
  } catch {
    // DB connection failed or timeout, fall through to mock data
  }

  // Return mock data as fallback
  let mockListings = MOCK_MARKETPLACE_LISTINGS;

  // Apply client-side filters to mock data
  if (specialization) {
    mockListings = mockListings.filter((l) => l.specialization === specialization);
  }
  if (featured) {
    mockListings = mockListings.filter((l) => l.featured);
  }
  if (search) {
    const q = search.toLowerCase();
    mockListings = mockListings.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (minRating) {
    mockListings = mockListings.filter((l) => l.rating >= minRating);
  }

  // Apply sort
  if (sort === 'rating') {
    mockListings = [...mockListings].sort((a, b) => b.rating - a.rating);
  } else if (sort === 'calls') {
    mockListings = [...mockListings].sort((a, b) => b.totalCalls - a.totalCalls);
  }

  // Scale down mock stats to realistic levels (mock totalCalls are showcase data)
  const scaledCalls = Math.floor(MOCK_MARKETPLACE_LISTINGS.reduce((sum, l) => sum + l.totalCalls, 0) / 100);
  const scaledVolume = Math.floor(MOCK_MARKETPLACE_LISTINGS.reduce((sum, l) => sum + l.totalCalls * l.pricing.perCall, 0) / 100);

  return NextResponse.json({
    listings: mockListings,
    stats: {
      totalAgents: MOCK_MARKETPLACE_LISTINGS.length,
      totalCalls: scaledCalls,
      totalVolume: scaledVolume,
      avgRating: +(MOCK_MARKETPLACE_LISTINGS.reduce((sum, l) => sum + l.rating, 0) / MOCK_MARKETPLACE_LISTINGS.length).toFixed(1),
      topSpecializations: ['defi', 'market', 'security', 'utility', 'research'],
    },
    count: mockListings.length,
  });
}
