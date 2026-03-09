import { NextRequest, NextResponse } from 'next/server';
import { getAllTools } from '@/lib/tool-pricing';
import { getAllWallets } from '@/lib/agent-wallet';

// ---------------------------------------------------------------------------
// MCP Resource definitions
// ---------------------------------------------------------------------------

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

const MCP_RESOURCES: McpResource[] = [
  {
    uri: 'bbai://agents',
    name: 'Available AI Agents',
    description:
      'List of all available BoredBrain AI agents with their capabilities, specializations, tools, and pricing. Use this to discover which agents can handle specific tasks.',
    mimeType: 'application/json',
  },
  {
    uri: 'bbai://tools',
    name: 'Available Tools & Pricing',
    description:
      'Complete list of tools available in the BoredBrain platform with their BBAI costs, categories, and input schemas.',
    mimeType: 'application/json',
  },
  {
    uri: 'bbai://prompts',
    name: 'Marketplace Prompts',
    description:
      'Community-created prompt templates available in the BoredBrain marketplace. Includes trading strategies, research templates, and analysis frameworks.',
    mimeType: 'application/json',
  },
  {
    uri: 'bbai://arena',
    name: 'Arena Match Data',
    description:
      'Data from the BoredBrain AI Arena where agents compete head-to-head. Includes match history, agent rankings, and performance metrics.',
    mimeType: 'application/json',
  },
  {
    uri: 'bbai://billing',
    name: 'Billing & Wallet Info',
    description:
      'Agent wallet balances, transaction history, and billing information. Requires agent authentication to access specific wallet data.',
    mimeType: 'application/json',
  },
];

// ---------------------------------------------------------------------------
// Resource content generators
// ---------------------------------------------------------------------------

function getAgentsResourceContent() {
  return {
    platform: 'BoredBrain AI',
    agents: [
      {
        id: 'agent-defi-oracle',
        name: 'DeFi Oracle',
        description: 'Analyzes DeFi protocols, yield farming, and liquidity pool data across chains.',
        tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
        specialization: 'defi',
        pricing: { averageCostPerQuery: 40, currency: 'BBAI' },
        status: 'online',
      },
      {
        id: 'agent-alpha-hunter',
        name: 'Alpha Hunter',
        description: 'Hunts for market opportunities via whale movements, social sentiment, and on-chain signals.',
        tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
        specialization: 'market',
        pricing: { averageCostPerQuery: 35, currency: 'BBAI' },
        status: 'online',
      },
      {
        id: 'agent-research-bot',
        name: 'Research Bot',
        description: 'Academic and deep-web research agent for papers, code, and multi-source data.',
        tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
        specialization: 'research',
        pricing: { averageCostPerQuery: 30, currency: 'BBAI' },
        status: 'online',
      },
      {
        id: 'agent-news-aggregator',
        name: 'News Aggregator',
        description: 'Compiles breaking news from web, social media, Reddit, and YouTube.',
        tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
        specialization: 'news',
        pricing: { averageCostPerQuery: 20, currency: 'BBAI' },
        status: 'online',
      },
      {
        id: 'agent-code-auditor',
        name: 'Code Auditor',
        description: 'Audits smart contracts for vulnerabilities, gas optimization, and compliance.',
        tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
        specialization: 'security',
        pricing: { averageCostPerQuery: 45, currency: 'BBAI' },
        status: 'online',
      },
      {
        id: 'agent-nft-analyst',
        name: 'NFT Analyst',
        description: 'Tracks NFT market trends, collection analytics, whale purchases, and social buzz.',
        tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
        specialization: 'nft',
        pricing: { averageCostPerQuery: 30, currency: 'BBAI' },
        status: 'online',
      },
    ],
    discoveryEndpoint: '/api/agents/discover',
  };
}

function getToolsResourceContent() {
  const allTools = getAllTools();
  return {
    platform: 'BoredBrain AI',
    totalTools: allTools.length,
    currency: 'BBAI',
    tools: allTools.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      price: t.price,
      unit: 'BBAI',
    })),
    executeEndpoint: '/api/mcp/execute',
  };
}

function getPromptsResourceContent() {
  return {
    platform: 'BoredBrain AI',
    totalPrompts: 5,
    prompts: [
      {
        id: 'prompt-defi-analysis',
        name: 'DeFi Protocol Analysis',
        description: 'Comprehensive analysis template for evaluating DeFi protocols including TVL, yield, risk, and smart contract security.',
        category: 'defi',
        author: 'BoredBrain',
        usageCount: 1243,
      },
      {
        id: 'prompt-alpha-signal',
        name: 'Alpha Signal Detection',
        description: 'Multi-source alpha signal detection combining on-chain data, social sentiment, and whale movements.',
        category: 'trading',
        author: 'BoredBrain',
        usageCount: 987,
      },
      {
        id: 'prompt-nft-valuation',
        name: 'NFT Collection Valuation',
        description: 'Framework for valuing NFT collections based on rarity, community, utility, and market dynamics.',
        category: 'nft',
        author: 'BoredBrain',
        usageCount: 654,
      },
      {
        id: 'prompt-smart-contract-review',
        name: 'Smart Contract Security Review',
        description: 'Step-by-step security audit template for Solidity smart contracts covering common vulnerabilities.',
        category: 'security',
        author: 'BoredBrain',
        usageCount: 432,
      },
      {
        id: 'prompt-market-brief',
        name: 'Daily Market Brief',
        description: 'Structured template for generating daily crypto market briefings with technical and fundamental analysis.',
        category: 'research',
        author: 'BoredBrain',
        usageCount: 2156,
      },
    ],
    marketplaceEndpoint: '/api/prompts',
  };
}

function getArenaResourceContent() {
  return {
    platform: 'BoredBrain AI',
    arena: {
      totalMatches: 1847,
      activeAgents: 6,
      recentMatches: [
        {
          id: 'match-001',
          agents: ['agent-defi-oracle', 'agent-alpha-hunter'],
          topic: 'ETH price prediction Q1 2026',
          winner: 'agent-defi-oracle',
          votes: { 'agent-defi-oracle': 156, 'agent-alpha-hunter': 132 },
          date: '2026-03-03T18:00:00Z',
        },
        {
          id: 'match-002',
          agents: ['agent-research-bot', 'agent-news-aggregator'],
          topic: 'Impact of Bitcoin ETF on retail adoption',
          winner: 'agent-research-bot',
          votes: { 'agent-research-bot': 198, 'agent-news-aggregator': 145 },
          date: '2026-03-02T14:00:00Z',
        },
        {
          id: 'match-003',
          agents: ['agent-code-auditor', 'agent-nft-analyst'],
          topic: 'Security analysis of top 5 NFT marketplaces',
          winner: 'agent-code-auditor',
          votes: { 'agent-code-auditor': 221, 'agent-nft-analyst': 189 },
          date: '2026-03-01T20:00:00Z',
        },
      ],
      rankings: [
        { agentId: 'agent-defi-oracle', wins: 342, losses: 128, elo: 1847 },
        { agentId: 'agent-code-auditor', wins: 298, losses: 102, elo: 1823 },
        { agentId: 'agent-research-bot', wins: 276, losses: 145, elo: 1756 },
        { agentId: 'agent-alpha-hunter', wins: 254, losses: 167, elo: 1698 },
        { agentId: 'agent-nft-analyst', wins: 189, losses: 156, elo: 1634 },
        { agentId: 'agent-news-aggregator', wins: 178, losses: 182, elo: 1589 },
      ],
    },
    arenaEndpoint: '/api/arena',
  };
}

async function getBillingResourceContent() {
  const wallets = await getAllWallets();
  return {
    platform: 'BoredBrain AI',
    currency: 'BBAI',
    wallets: wallets.map((w) => ({
      agentId: w.agentId,
      address: w.address,
      balance: w.balance,
      dailyLimit: w.dailyLimit,
      totalSpent: w.totalSpent,
      isActive: w.isActive,
    })),
    totalAgentWallets: wallets.length,
    billingEndpoints: {
      autopay: '/api/agent-autopay',
      wallet: '/api/agent-wallet',
    },
  };
}

// Map URIs to content generators
const RESOURCE_CONTENT_MAP: Record<string, () => unknown | Promise<unknown>> = {
  'bbai://agents': getAgentsResourceContent,
  'bbai://tools': getToolsResourceContent,
  'bbai://prompts': getPromptsResourceContent,
  'bbai://arena': getArenaResourceContent,
  'bbai://billing': getBillingResourceContent,
};

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// GET /api/mcp/resources - List or read MCP resources
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uri = searchParams.get('uri');

  // If a specific resource URI is requested, return its content
  if (uri) {
    const contentGenerator = RESOURCE_CONTENT_MAP[uri];
    if (!contentGenerator) {
      return NextResponse.json(
        {
          error: {
            code: -32602,
            message: `Unknown resource URI: "${uri}". Use GET /api/mcp/resources to list available resources.`,
          },
        },
        { status: 404, headers: corsHeaders },
      );
    }

    const content = await contentGenerator();
    return NextResponse.json(
      {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(content, null, 2),
          },
        ],
      },
      { headers: corsHeaders },
    );
  }

  // Otherwise, list all available resources
  return NextResponse.json(
    {
      resources: MCP_RESOURCES,
    },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
}

// ---------------------------------------------------------------------------
// OPTIONS /api/mcp/resources - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
