import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getLineage, getGenerationStats } from '@/lib/agent-replication';

/**
 * GET /api/agents/lineage
 *
 * Get lineage tree for a specific agent or generation statistics.
 *
 * Query params:
 *   ?agentId=xxx   — get lineage tree for a specific agent
 *   ?stats=true    — get generation statistics (counts by generation)
 *
 * If neither is provided, returns generation stats by default.
 */
export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    const showStats = request.nextUrl.searchParams.get('stats') === 'true';

    if (agentId) {
      const lineage = await getLineage(agentId);
      return apiSuccess({ lineage });
    }

    if (showStats || !agentId) {
      const stats = await getGenerationStats();
      return apiSuccess({ stats });
    }

    return apiError('Provide agentId or stats=true', 400);
  } catch (error: any) {
    console.error('[lineage] Error:', error.message);
    return apiError('Failed to get lineage data', 500);
  }
}
