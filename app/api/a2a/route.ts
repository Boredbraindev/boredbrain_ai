import { NextRequest, NextResponse } from 'next/server';
import { getAllTools, getToolPrice, getToolInfo } from '@/lib/tool-pricing';
import { getAllNodes, getNode, getNetworkStats, invokeExternalAgent, registerNode } from '@/lib/agent-network';
import { settleBilling, getRevenueStats } from '@/lib/inter-agent-billing';

/**
 * A2A (Agent-to-Agent) Protocol Endpoint
 * JSON-RPC 2.0 compatible
 *
 * Supports methods:
 * - agent/discover   - Returns agent capabilities and available tools
 * - agent/invoke     - Execute an agent task
 * - agent/status     - Check agent availability
 * - tools/list       - List available tools with pricing
 * - tools/call       - Execute a specific tool
 * - billing/quote    - Get a price quote for a set of tools
 * - billing/settle   - Settle a payment between agents
 */

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// Agent definitions for discovery
// ---------------------------------------------------------------------------

const BOREDBRAIN_AGENTS = [
  {
    id: 'agent-defi-oracle',
    name: 'DeFi Oracle',
    description: 'Analyzes DeFi protocols, yield farming, and liquidity pool data across chains.',
    tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
    specialization: 'defi',
  },
  {
    id: 'agent-alpha-hunter',
    name: 'Alpha Hunter',
    description: 'Hunts for market opportunities via whale movements, social sentiment, and on-chain signals.',
    tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
    specialization: 'market',
  },
  {
    id: 'agent-research-bot',
    name: 'Research Bot',
    description: 'Academic and deep-web research agent for papers, code, and multi-source data.',
    tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
    specialization: 'research',
  },
  {
    id: 'agent-news-aggregator',
    name: 'News Aggregator',
    description: 'Compiles breaking news from web, social media, Reddit, and YouTube into structured briefings.',
    tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
    specialization: 'news',
  },
  {
    id: 'agent-code-auditor',
    name: 'Code Auditor',
    description: 'Audits smart contracts for vulnerabilities, gas optimization, and best-practice compliance.',
    tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
    specialization: 'security',
  },
  {
    id: 'agent-nft-analyst',
    name: 'NFT Analyst',
    description: 'Tracks NFT market trends, collection analytics, whale purchases, and social buzz.',
    tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
    specialization: 'nft',
  },
];

// ---------------------------------------------------------------------------
// Mock tool execution
// ---------------------------------------------------------------------------

function executeMockTool(toolName: string, args: Record<string, unknown>): string {
  const query =
    typeof args?.query === 'string'
      ? args.query
      : typeof args?.text === 'string'
        ? args.text
        : typeof args?.code === 'string'
          ? args.code
          : toolName;

  const results: Record<string, (q: string) => string> = {
    web_search: (q) => `Found 12 results for "${q}". Top sources: CoinDesk, Bloomberg, CoinTelegraph.`,
    x_search: (q) => `48 posts found for "${q}". Sentiment: Bullish (62%). Top engagement: 2.3k.`,
    coin_data: (q) => `${q.toUpperCase()}: $67,432.18 | +2.4% (24h) | MCap $1.32T | Vol $28.5B.`,
    coin_ohlc: (q) => `${q.toUpperCase()} OHLC: O $66,100 | H $68,200 | L $65,800 | C $67,432.`,
    wallet_analyzer: (q) => `Address analysis: 23 tokens, ~$145K net worth, 312 txns (30d), Risk: Low.`,
    stock_chart: (q) => `${q.toUpperCase()}: $187.45 | 52wk H $199.62 | L $124.17 | P/E 28.3.`,
    academic_search: (q) => `8 papers found for "${q}". Top cited: 145 citations (2024). Sources: Nature, IEEE.`,
    reddit_search: (q) => `34 posts for "${q}". Top: 1.2k upvotes, 89 comments. Sentiment: cautiously optimistic.`,
    youtube_search: (q) => `15 videos for "${q}". Top: 234K views. Avg view count: 85K.`,
    code_interpreter: (q) => `Code executed successfully. Result: { status: "ok", executionTime: "1.2s" }.`,
    retrieve: (q) => `Fetched "${q}": 2,450 words parsed, 3 topics identified.`,
    text_translate: (q) => `Translation complete. Confidence: 98%.`,
    currency_converter: (q) => `Converted: 1 USD = 0.92 EUR | 1 BTC = $67,432.`,
    token_retrieval: (q) => `${q}: Verified contract | 12,450 holders | Liquidity $2.3M | No issues.`,
    nft_retrieval: (q) => `"${q}": Floor 0.45 ETH | Supply 10K | 5,234 holders | 24h vol 12.3 ETH.`,
    extreme_search: (q) => `Deep analysis of "${q}": 47 sources across 6 domains synthesized.`,
    smart_contract_audit: (q) => `Audit: 0 critical, 1 medium, 3 low issues. Score: 87/100.`,
    whale_alert: (q) => `"${q}": 3 large txns in 1h. Largest: 500 BTC ($33.7M). Net flow: outbound.`,
  };

  const gen = results[toolName];
  return gen ? gen(query) : `Tool "${toolName}" executed for "${query}". Done.`;
}

// ---------------------------------------------------------------------------
// GET /api/a2a - A2A protocol info + supported methods
// ---------------------------------------------------------------------------

export async function GET() {
  let stats = { totalNodes: 0, onlineNodes: 0, totalMessages: 0 };
  try {
    stats = await getNetworkStats();
  } catch {
    // DB not available — return defaults
  }

  return NextResponse.json(
    {
      protocol: 'a2a',
      version: '1.0.0',
      name: 'BoredBrain A2A Gateway',
      description:
        'Agent-to-Agent protocol endpoint for the BoredBrain AI Agent Economy. JSON-RPC 2.0 compatible.',
      methods: [
        {
          name: 'agent/discover',
          description: 'Returns agent capabilities, available agents, and tools.',
          params: '(none)',
        },
        {
          name: 'agent/invoke',
          description: 'Execute an agent task with specified tools.',
          params: '{ agentId, query, tools?, callerAgentId? }',
        },
        {
          name: 'agent/status',
          description: 'Check agent and network availability.',
          params: '{ agentId? }',
        },
        {
          name: 'tools/list',
          description: 'List all available tools with pricing.',
          params: '{ category? }',
        },
        {
          name: 'tools/call',
          description: 'Execute a specific tool with arguments.',
          params: '{ tool, arguments, agentId? }',
        },
        {
          name: 'billing/quote',
          description: 'Get a price quote for a set of tools.',
          params: '{ tools }',
        },
        {
          name: 'billing/settle',
          description: 'Settle a payment between two agents.',
          params: '{ callerAgentId, providerAgentId, tools, totalCost }',
        },
      ],
      network: {
        totalNodes: stats.totalNodes,
        onlineNodes: stats.onlineNodes,
        totalMessages: stats.totalMessages,
      },
      authentication: {
        type: 'wallet-signature',
        token: 'USDT',
        note: 'Demo mode available without authentication.',
      },
      endpoints: {
        mcp: '/api/mcp',
        a2a: '/api/a2a',
        network: '/api/network',
        agents: '/api/agents/discover',
      },
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
// POST /api/a2a - Handle A2A protocol messages (JSON-RPC 2.0)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let rpcRequest: {
    jsonrpc: string;
    method: string;
    params: any;
    id: string | number;
  };

  try {
    rpcRequest = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
        id: null,
      },
      { headers: corsHeaders },
    );
  }

  if (rpcRequest.jsonrpc !== '2.0') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
        id: rpcRequest.id,
      },
      { headers: corsHeaders },
    );
  }

  const params = rpcRequest.params || {};

  switch (rpcRequest.method) {
    // -------------------------------------------------------------------
    // agent/discover - Returns agent capabilities
    // -------------------------------------------------------------------
    case 'agent/discover': {
      const allTools = getAllTools();

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            platform: 'BoredBrain AI',
            agents: BOREDBRAIN_AGENTS,
            totalTools: allTools.length,
            capabilities: {
              streaming: true,
              batchExecution: true,
              crossPlatform: true,
              protocols: ['mcp', 'a2a'],
            },
            payment: {
              token: 'USDT',
              chains: [8453, 56],
              acceptedMethods: ['wallet-signature', 'agent-wallet'],
            },
            endpoints: {
              mcp: '/api/mcp',
              mcpExecute: '/api/mcp/execute',
              a2a: '/api/a2a',
              network: '/api/network',
              agentCard: '/.well-known/agent.json',
            },
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // agent/invoke - Execute an agent task
    // Supports both built-in BoredBrain agents and external network nodes.
    // -------------------------------------------------------------------
    case 'agent/invoke': {
      const { agentId, query, tools, callerAgentId } = params;

      if (!agentId || !query) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Missing required params: agentId, query',
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      // First check built-in BoredBrain agents
      const builtInAgent = BOREDBRAIN_AGENTS.find((a) => a.id === agentId);

      // If not a built-in agent, check external network nodes
      let externalNode = null;
      if (!builtInAgent) {
        try {
          externalNode = await getNode(agentId);
        } catch {
          // Ignore DB errors during lookup
        }
      }

      if (!builtInAgent && !externalNode) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: `Unknown agent: "${agentId}". Available built-in: ${BOREDBRAIN_AGENTS.map((a) => a.id).join(', ')}. External agents can be discovered via the network.`,
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      // Determine agent metadata for the response
      const agentMeta = builtInAgent
        ? {
            id: builtInAgent.id,
            name: builtInAgent.name,
            specialization: builtInAgent.specialization,
            type: 'built-in' as const,
          }
        : {
            id: externalNode!.id,
            name: externalNode!.name,
            specialization: externalNode!.platform,
            type: 'external' as const,
          };

      const effectiveTools = tools
        || (builtInAgent ? builtInAgent.tools : externalNode!.tools);

      try {
        const result = await invokeExternalAgent(
          agentId,
          query,
          effectiveTools,
          callerAgentId,
        );

        return NextResponse.json(
          {
            jsonrpc: '2.0',
            result: {
              taskId: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              status: 'completed',
              agent: agentMeta,
              response: result.response,
              billing: {
                cost: result.cost,
                currency: 'USDT',
                latency: result.latency,
              },
              timestamp: new Date().toISOString(),
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Agent invocation failed';

        // Categorize errors for better client-side handling
        let errorCode = -32603; // Internal error (default)
        if (errMsg.includes('offline') || errMsg.includes('unreachable')) {
          errorCode = -32001; // Agent unreachable
        } else if (errMsg.includes('timeout') || errMsg.includes('aborted') || errMsg.includes('abort')) {
          errorCode = -32002; // Agent timeout
        } else if (errMsg.includes('not found') || errMsg.includes('Node not found')) {
          errorCode = -32003; // Agent not found
        }

        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: errorCode,
              message: errMsg,
              data: {
                agentId,
                type: builtInAgent ? 'built-in' : 'external',
              },
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }
    }

    // -------------------------------------------------------------------
    // agent/status - Check agent availability
    // -------------------------------------------------------------------
    case 'agent/status': {
      const { agentId: statusAgentId } = params;

      if (statusAgentId) {
        const agent = BOREDBRAIN_AGENTS.find((a) => a.id === statusAgentId);
        if (!agent) {
          return NextResponse.json(
            {
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: `Unknown agent: "${statusAgentId}"`,
              },
              id: rpcRequest.id,
            },
            { headers: corsHeaders },
          );
        }

        return NextResponse.json(
          {
            jsonrpc: '2.0',
            result: {
              agentId: agent.id,
              name: agent.name,
              status: 'online',
              tools: agent.tools,
              specialization: agent.specialization,
              uptime: '99.8%',
              lastChecked: new Date().toISOString(),
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      // Return all agents' status
      const stats = await getNetworkStats();
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            platform: 'online',
            agents: BOREDBRAIN_AGENTS.map((a) => ({
              id: a.id,
              name: a.name,
              status: 'online',
              specialization: a.specialization,
            })),
            network: {
              totalNodes: stats.totalNodes,
              onlineNodes: stats.onlineNodes,
              avgLatency: stats.avgLatency,
            },
            timestamp: new Date().toISOString(),
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // tools/list - List available tools
    // -------------------------------------------------------------------
    case 'tools/list': {
      const allTools = getAllTools();
      const { category } = params;

      const filtered = category
        ? allTools.filter((t) => t.category === category)
        : allTools;

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            totalTools: filtered.length,
            currency: 'USDT',
            tools: filtered.map((t) => ({
              id: t.id,
              name: t.name,
              category: t.category,
              price: t.price,
              unit: 'USDT',
            })),
            categories: [...new Set(allTools.map((t) => t.category))],
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // tools/call - Execute a tool
    // -------------------------------------------------------------------
    case 'tools/call': {
      const { tool, arguments: toolArgs, agentId: callerAgent } = params;

      if (!tool) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Missing required param: tool',
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      const toolInfo = getToolInfo(tool);
      if (!toolInfo) {
        const allTools = getAllTools();
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: `Unknown tool: "${tool}". Available: ${allTools.map((t) => t.id).join(', ')}`,
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      const result = executeMockTool(tool, toolArgs || {});

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            tool,
            output: result,
            billing: {
              cost: toolInfo.price,
              currency: 'USDT',
              agentId: callerAgent || null,
            },
            timestamp: new Date().toISOString(),
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // billing/quote - Get price quote
    // -------------------------------------------------------------------
    case 'billing/quote': {
      const { tools: quoteTools } = params;

      if (!quoteTools || !Array.isArray(quoteTools) || quoteTools.length === 0) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Missing required param: tools (array of tool names)',
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      const breakdown = quoteTools.map((toolName: string) => {
        const price = getToolPrice(toolName);
        return {
          tool: toolName,
          price: price ?? null,
          available: price !== null,
        };
      });

      const totalCost = breakdown.reduce(
        (sum: number, item: { price: number | null }) => sum + (item.price ?? 0),
        0,
      );

      const platformFee = Number(((totalCost * 15) / 100).toFixed(4));

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            quote: {
              tools: breakdown,
              subtotal: totalCost,
              platformFee,
              total: Number((totalCost + platformFee).toFixed(4)),
              currency: 'USDT',
            },
            validFor: '5 minutes',
            timestamp: new Date().toISOString(),
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // billing/settle - Settle a payment
    // -------------------------------------------------------------------
    case 'billing/settle': {
      const {
        callerAgentId,
        providerAgentId,
        tools: settleTools,
        totalCost,
      } = params;

      if (!callerAgentId || !providerAgentId || !settleTools || !totalCost) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message:
                'Missing required params: callerAgentId, providerAgentId, tools, totalCost',
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      const settlement = await settleBilling(
        callerAgentId,
        providerAgentId,
        settleTools,
        totalCost,
      );

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            success: settlement.success,
            billingId: settlement.billingId,
            breakdown: settlement.breakdown,
            timestamp: new Date().toISOString(),
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // Default - Method not found
    // -------------------------------------------------------------------
    default:
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: "${rpcRequest.method}". Supported methods: agent/discover, agent/invoke, agent/status, tools/list, tools/call, billing/quote, billing/settle`,
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
  }
}

// ---------------------------------------------------------------------------
// OPTIONS /api/a2a - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
