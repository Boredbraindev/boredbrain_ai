import { NextRequest, NextResponse } from 'next/server';
import { getToolPrice } from '@/lib/tool-pricing';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Agent Discovery Endpoint
 *
 * GET /api/agents/discover
 *
 * Returns a list of all available BoredBrain agents with their capabilities,
 * pricing, and endpoint URLs. Pulls from DB first (fleet + external agents),
 * falls back to mock data.
 *
 * Query params:
 *   ?specialization=defi   - Filter by agent specialization
 *   ?tool=web_search        - Filter by tool availability
 *   ?status=online          - Filter by status (default: all)
 *   ?limit=50               - Max results (default: 50, max: 500)
 *   ?offset=0               - Pagination offset
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoveryAgent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  specialization: string;
  pricing: { averageCostPerQuery: number; currency: string };
  status: 'online' | 'offline';
  endpoint: string;
  rating?: number;
  totalCalls?: number;
  badge?: 'verified' | 'community';
  bscAddress?: string;
  chainId?: number;
}

// ---------------------------------------------------------------------------
// Build agent list from DB only (no mock/fleet inflation)
// ---------------------------------------------------------------------------

async function buildFullAgentList(): Promise<DiscoveryAgent[]> {
  const agents: DiscoveryAgent[] = [];

  try {
    const dbPromise = db
      .select()
      .from(externalAgent)
      .where(eq(externalAgent.status, 'active'));
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const dbAgents = await Promise.race([dbPromise, timeout]);

    for (const a of dbAgents) {
      const pricePerQuery =
        (a.metadata as any)?.pricePerQuery ??
        (a.tools as string[]).reduce(
          (sum, t) => sum + (getToolPrice(t) ?? 5),
          0,
        ) ??
        10;
      const currency = (a.metadata as any)?.currency ?? 'BBAI';

      const badge: 'verified' | 'community' =
        a.ownerAddress === 'platform-fleet' || a.verifiedAt != null
          ? 'verified'
          : 'community';

      const meta = a.metadata as Record<string, any> | null;

      agents.push({
        id: a.id,
        name: a.name,
        description: a.description ?? '',
        tools: (a.tools as string[]) ?? [],
        specialization: a.specialization,
        pricing: { averageCostPerQuery: pricePerQuery, currency },
        status: 'online',
        endpoint: `/api/agents/${a.id}/invoke`,
        rating: a.rating,
        totalCalls: a.totalCalls,
        badge,
        bscAddress: meta?.bscAddress ?? undefined,
        chainId: meta?.chainId ?? undefined,
      });
    }
  } catch {
    // DB unavailable — return empty list (no fake agents)
  }

  return agents;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const specialization = searchParams.get('specialization')?.toLowerCase();
  const tool = searchParams.get('tool')?.toLowerCase();
  const status = searchParams.get('status')?.toLowerCase() as
    | 'online'
    | 'offline'
    | null;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
    500,
  );
  const offset = Math.max(
    parseInt(searchParams.get('offset') || '0', 10) || 0,
    0,
  );

  let agents = await buildFullAgentList();

  // Filter by specialization
  if (specialization) {
    agents = agents.filter(
      (a) => a.specialization.toLowerCase() === specialization,
    );
  }

  // Filter by tool availability
  if (tool) {
    agents = agents.filter((a) =>
      a.tools.some((t) => t.toLowerCase() === tool),
    );
  }

  // Filter by status
  if (status === 'online' || status === 'offline') {
    agents = agents.filter((a) => a.status === status);
  }

  const total = agents.length;
  const paginated = agents.slice(offset, offset + limit);

  return NextResponse.json(
    {
      platform: 'BoredBrain AI',
      protocol: 'a2a',
      totalAgents: total,
      returned: paginated.length,
      offset,
      limit,
      agents: paginated,
      meta: {
        discoveryEndpoint: '/api/agents/discover',
        invokePattern: '/api/agents/{agentId}/invoke',
        agentCardUrl: '/.well-known/agent-card.json',
        paymentToken: 'BBAI',
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
}
