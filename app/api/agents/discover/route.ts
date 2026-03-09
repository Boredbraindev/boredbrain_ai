import { NextRequest, NextResponse } from 'next/server';
import { MOCK_AGENTS } from '@/lib/mock-data';
import { getToolPrice } from '@/lib/tool-pricing';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

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
}

// ---------------------------------------------------------------------------
// Agent specialization mapping (for mock agents)
// ---------------------------------------------------------------------------

const AGENT_SPECIALIZATIONS: Record<string, string> = {
  'agent-defi-oracle': 'defi',
  'agent-alpha-hunter': 'market',
  'agent-research-bot': 'research',
  'agent-news-aggregator': 'news',
  'agent-code-auditor': 'security',
  'agent-nft-analyst': 'nft',
  'agent-alpha-researcher': 'market',
  'agent-market-sentinel': 'market',
  'agent-news-hunter': 'news',
  'agent-code-wizard': 'development',
  'agent-whale-tracker': 'onchain',
  'agent-content-scout': 'media',
  'agent-travel-planner': 'travel',
  'agent-extreme-searcher': 'research',
  'agent-movie-buff': 'media',
  'agent-polyglot': 'translation',
  'agent-academic-mind': 'research',
};

// ---------------------------------------------------------------------------
// Build full agent list: DB agents + mock agents (deduped)
// ---------------------------------------------------------------------------

async function buildFullAgentList(): Promise<DiscoveryAgent[]> {
  const merged: DiscoveryAgent[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  // 1. Try DB first — get all active agents
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

      merged.push({
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
      });
      seenIds.add(a.id);
      seenNames.add(a.name);
    }
  } catch {
    // DB unavailable — continue with mock data
  }

  // 2. Supplement from MOCK_AGENTS (marketplace agents not already in the list)
  for (const mock of MOCK_AGENTS) {
    if (seenIds.has(mock.id) || seenNames.has(mock.name)) continue;

    const tools = (mock.tools as string[]) || [];
    const avgCost =
      tools.reduce((sum, t) => sum + (getToolPrice(t) ?? 5), 0) ||
      Number(mock.pricePerQuery) ||
      10;

    merged.push({
      id: mock.id,
      name: mock.name,
      description: mock.description,
      tools,
      specialization: AGENT_SPECIALIZATIONS[mock.id] ?? 'general',
      pricing: { averageCostPerQuery: avgCost, currency: 'BBAI' },
      status: mock.status === 'active' ? 'online' : 'offline',
      endpoint: `/api/agents/${mock.id}/invoke`,
    });
    seenIds.add(mock.id);
  }

  return merged;
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
