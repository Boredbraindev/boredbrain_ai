/**
 * GET /api/topics/[topicId]
 *
 * Get topic debate details with all opinions, ranked by score.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getDebateResults } from '@/lib/topic-debate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const { topicId } = await params;

    const results = await getDebateResults(topicId);

    if (!results.debate) {
      return apiError('Topic debate not found', 404);
    }

    return apiSuccess({
      debate: results.debate,
      opinions: results.opinions,
      totalOpinions: results.opinions.length,
    });
  } catch (err) {
    console.error('[api/topics/[topicId]] GET error:', err);
    return apiError('Failed to fetch debate details', 500);
  }
}
