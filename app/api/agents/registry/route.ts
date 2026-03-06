import { NextRequest, NextResponse } from 'next/server';
import { getAllRegisteredAgents } from '@/lib/agent-registry';

/**
 * GET /api/agents/registry - Browse all registered agents with filters
 *
 * Query params:
 *   ?status=active          - filter by status (pending, verified, active, suspended)
 *   ?specialization=defi    - filter by specialization
 *   ?minRating=4            - minimum rating filter
 *   ?sort=rating|calls|earned - sort order (default: rating)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status') || undefined;
  const specialization = searchParams.get('specialization') || undefined;
  const minRatingParam = searchParams.get('minRating');
  const sort = searchParams.get('sort') || 'rating';

  const minRating = minRatingParam ? parseFloat(minRatingParam) : undefined;

  let agents = await getAllRegisteredAgents({
    status,
    specialization,
    minRating,
  });

  // Sort
  switch (sort) {
    case 'calls':
      agents = agents.sort((a, b) => b.totalCalls - a.totalCalls);
      break;
    case 'earned':
      agents = agents.sort((a, b) => b.totalEarned - a.totalEarned);
      break;
    case 'staked':
      agents = agents.sort((a, b) => b.stakingAmount - a.stakingAmount);
      break;
    case 'newest':
      agents = agents.sort(
        (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
      );
      break;
    case 'rating':
    default:
      agents = agents.sort((a, b) => b.rating - a.rating);
      break;
  }

  return NextResponse.json({
    agents,
    total: agents.length,
  });
}
