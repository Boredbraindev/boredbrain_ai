import { NextRequest, NextResponse } from 'next/server';
import { MOCK_AGENTS } from '@/lib/mock-data';
import { getToolPrice } from '@/lib/tool-pricing';

/**
 * Agent Discovery Endpoint
 *
 * GET /api/agents/discover
 *
 * Returns a list of all available BoredBrain agents with their capabilities,
 * pricing, and endpoint URLs. External AI agents use this to discover which
 * agents are available for invocation.
 *
 * Query params:
 *   ?specialization=defi   - Filter by agent specialization
 *   ?tool=web_search        - Filter by tool availability
 *   ?status=online          - Filter by status (default: all)
 */

// ---------------------------------------------------------------------------
// Agent specialization mapping
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
// Canonical discovery agents (the 6 primary agents for A2A discovery)
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
}

const DISCOVERY_AGENTS: DiscoveryAgent[] = [
  {
    id: 'agent-defi-oracle',
    name: 'DeFi Oracle',
    description:
      'Analyzes DeFi protocols, yield farming opportunities, and liquidity pool data across chains.',
    tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
    specialization: 'defi',
    pricing: { averageCostPerQuery: 40, currency: 'BBAI' },
    status: 'online',
    endpoint: '/api/agents/agent-defi-oracle/invoke',
  },
  {
    id: 'agent-alpha-hunter',
    name: 'Alpha Hunter',
    description:
      'Hunts for market opportunities by monitoring whale movements, social sentiment, and on-chain signals.',
    tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
    specialization: 'market',
    pricing: { averageCostPerQuery: 35, currency: 'BBAI' },
    status: 'online',
    endpoint: '/api/agents/agent-alpha-hunter/invoke',
  },
  {
    id: 'agent-research-bot',
    name: 'Research Bot',
    description:
      'Academic and deep-web research agent capable of synthesizing papers, code, and multi-source data.',
    tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
    specialization: 'research',
    pricing: { averageCostPerQuery: 30, currency: 'BBAI' },
    status: 'online',
    endpoint: '/api/agents/agent-research-bot/invoke',
  },
  {
    id: 'agent-news-aggregator',
    name: 'News Aggregator',
    description:
      'Compiles breaking news from web, social media, Reddit, and YouTube into structured briefings.',
    tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
    specialization: 'news',
    pricing: { averageCostPerQuery: 20, currency: 'BBAI' },
    status: 'online',
    endpoint: '/api/agents/agent-news-aggregator/invoke',
  },
  {
    id: 'agent-code-auditor',
    name: 'Code Auditor',
    description:
      'Audits smart contracts for vulnerabilities, gas optimization, and best-practice compliance.',
    tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
    specialization: 'security',
    pricing: { averageCostPerQuery: 45, currency: 'BBAI' },
    status: 'online',
    endpoint: '/api/agents/agent-code-auditor/invoke',
  },
  {
    id: 'agent-nft-analyst',
    name: 'NFT Analyst',
    description:
      'Tracks NFT market trends, collection analytics, whale purchases, and social buzz around NFTs.',
    tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
    specialization: 'nft',
    pricing: { averageCostPerQuery: 30, currency: 'BBAI' },
    status: 'online',
    endpoint: '/api/agents/agent-nft-analyst/invoke',
  },
];

// ---------------------------------------------------------------------------
// Merge discovery agents with mock data from the marketplace
// ---------------------------------------------------------------------------

function buildFullAgentList(): DiscoveryAgent[] {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boredbrain.ai';

  // Start with the 6 canonical discovery agents
  const discoveryIds = new Set(DISCOVERY_AGENTS.map((a) => a.id));
  const merged: DiscoveryAgent[] = [...DISCOVERY_AGENTS];

  // Supplement from MOCK_AGENTS (marketplace agents not already in the list)
  for (const mock of MOCK_AGENTS) {
    if (discoveryIds.has(mock.id)) continue;

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

  let agents = buildFullAgentList();

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

  return NextResponse.json(
    {
      platform: 'BoredBrain AI',
      protocol: 'a2a',
      totalAgents: agents.length,
      agents,
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
