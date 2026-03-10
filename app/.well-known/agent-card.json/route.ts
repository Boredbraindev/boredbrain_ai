import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /.well-known/agent-card.json
 * A2A (Agent-to-Agent) protocol Agent Card
 *
 * Enhanced version that exposes:
 *  - Full platform capabilities (agents, tools, protocols)
 *  - Agent discovery and invocation endpoints
 *  - Auto-pay and wallet endpoints
 *  - Authentication methods
 *  - Available skills catalog
 */
export async function GET() {
  const { getToolCatalog } = await import('@/lib/agent-api/tool-registry');
  let catalog: any[] = [];
  try {
    catalog = getToolCatalog();
  } catch {
    catalog = [];
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boredbrain.ai';

  // Unique tool names across all agents
  const uniqueTools = new Set(catalog.map((t) => t.name));

  const agentCard = {
    // -----------------------------------------------------------------------
    // Core identity
    // -----------------------------------------------------------------------
    name: 'BoredBrain AI',
    description:
      'Next-Generation Web 4.0 AI Utility Platform — Autonomous AI agent competitions & interactions with forecasting models. Deploy agents, compete in the Arena, and predict outcomes in a user-driven reward ecosystem.',
    url: baseUrl,
    version: '1.0.0',
    provider: {
      organization: 'BoredBrain',
      url: baseUrl,
    },

    // -----------------------------------------------------------------------
    // Platform capabilities
    // -----------------------------------------------------------------------
    capabilities: {
      agents: 6,
      tools: uniqueTools.size,
      protocols: ['a2a', 'mcp'],
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
      payment: {
        token: 'BBAI',
        chains: ['Base', 'BSC', 'ApeChain', 'Arbitrum'],
      },
    },

    // -----------------------------------------------------------------------
    // Endpoints
    // -----------------------------------------------------------------------
    endpoints: {
      discovery: '/api/agents/discover',
      invoke: '/api/agents/{agentId}/invoke',
      autopay: '/api/agent-autopay',
      batchAutopay: '/api/agent-autopay/batch',
      pricing: '/api/tools/pricing',
      a2a: '/api/a2a',
      mcp: '/api/mcp',
      wallets: '/api/agent-wallet',
      toolDiscovery: '/api/tools',
      toolExecution: '/api/tools/{toolName}',
      batchExecution: '/api/tools/batch',
      agentRegistry: '/api/agents',
      apiKeys: '/api/keys',
      arena: '/api/arena',
    },

    // -----------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------
    authentication: {
      methods: ['wallet-signature', 'api-key', 'a2a-protocol'],
      tokenStandard: 'ERC-20',
      schemes: ['bearer'],
      credentials: {
        type: 'apiKey',
        description: 'API key with bb_sk_ prefix. Get one at /api/keys',
        in: 'header',
        name: 'Authorization',
      },
    },

    // -----------------------------------------------------------------------
    // Available agents (summary)
    // -----------------------------------------------------------------------
    agents: [
      {
        id: 'agent-defi-oracle',
        name: 'DeFi Oracle',
        specialization: 'defi',
        tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
        invoke: `${baseUrl}/api/agents/agent-defi-oracle/invoke`,
      },
      {
        id: 'agent-alpha-hunter',
        name: 'Alpha Hunter',
        specialization: 'market',
        tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
        invoke: `${baseUrl}/api/agents/agent-alpha-hunter/invoke`,
      },
      {
        id: 'agent-research-bot',
        name: 'Research Bot',
        specialization: 'research',
        tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
        invoke: `${baseUrl}/api/agents/agent-research-bot/invoke`,
      },
      {
        id: 'agent-news-aggregator',
        name: 'News Aggregator',
        specialization: 'news',
        tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
        invoke: `${baseUrl}/api/agents/agent-news-aggregator/invoke`,
      },
      {
        id: 'agent-code-auditor',
        name: 'Code Auditor',
        specialization: 'security',
        tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
        invoke: `${baseUrl}/api/agents/agent-code-auditor/invoke`,
      },
      {
        id: 'agent-nft-analyst',
        name: 'NFT Analyst',
        specialization: 'nft',
        tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
        invoke: `${baseUrl}/api/agents/agent-nft-analyst/invoke`,
      },
    ],

    // -----------------------------------------------------------------------
    // Available skills (tools catalog)
    // -----------------------------------------------------------------------
    skills: catalog.map((tool) => ({
      id: tool.name,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      pricing: {
        amount: tool.pricePerCall,
        currency: 'BBAI',
        model: 'per_call',
      },
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    })),

    // Service modes
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],

    // -----------------------------------------------------------------------
    // Custom extensions for AI Agent Economy
    // -----------------------------------------------------------------------
    'x-bbai': {
      token: {
        symbol: 'BBAI',
        name: 'BoredBrain AI',
        chains: [
          { chainId: 8453, name: 'Base' },
          { chainId: 56, name: 'BNB Smart Chain' },
          { chainId: 33139, name: 'ApeChain' },
          { chainId: 42161, name: 'Arbitrum' },
        ],
      },
      onchain: {
        agentRegistry: 'Contract address set after deployment',
        paymentRouter: 'Contract address set after deployment',
        tokenContract: 'Contract address set after deployment',
      },
    },
  };

  return NextResponse.json(agentCard, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
