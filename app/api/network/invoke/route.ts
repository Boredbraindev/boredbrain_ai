import { NextRequest, NextResponse } from 'next/server';
import {
  getNode,
  invokeExternalAgent,
  type NetworkNode,
} from '@/lib/agent-network';
import { getToolPrice } from '@/lib/tool-pricing';

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// Built-in default nodes — used as fallback when a node is not in the DB.
// These mirror the platform's core agent lineup so invoke always works.
// ---------------------------------------------------------------------------

const BUILTIN_NODES: Record<string, NetworkNode> = {
  'agent-defi-oracle': {
    id: 'agent-defi-oracle',
    name: 'DeFi Oracle',
    platform: 'boredbrain',
    endpoint: '/api/a2a',
    agentCardUrl: '/.well-known/agent.json',
    capabilities: ['text-generation', 'tool-use'],
    tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
    status: 'online',
    lastSeen: new Date().toISOString(),
    latency: 50,
    totalInteractions: 0,
    trustScore: 95,
    chain: null,
    walletAddress: null,
  },
  'agent-alpha-hunter': {
    id: 'agent-alpha-hunter',
    name: 'Alpha Hunter',
    platform: 'boredbrain',
    endpoint: '/api/a2a',
    agentCardUrl: '/.well-known/agent.json',
    capabilities: ['text-generation', 'tool-use'],
    tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
    status: 'online',
    lastSeen: new Date().toISOString(),
    latency: 50,
    totalInteractions: 0,
    trustScore: 95,
    chain: null,
    walletAddress: null,
  },
  'agent-research-bot': {
    id: 'agent-research-bot',
    name: 'Research Bot',
    platform: 'boredbrain',
    endpoint: '/api/a2a',
    agentCardUrl: '/.well-known/agent.json',
    capabilities: ['text-generation', 'tool-use'],
    tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
    status: 'online',
    lastSeen: new Date().toISOString(),
    latency: 50,
    totalInteractions: 0,
    trustScore: 95,
    chain: null,
    walletAddress: null,
  },
  'agent-news-aggregator': {
    id: 'agent-news-aggregator',
    name: 'News Aggregator',
    platform: 'boredbrain',
    endpoint: '/api/a2a',
    agentCardUrl: '/.well-known/agent.json',
    capabilities: ['text-generation', 'tool-use'],
    tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
    status: 'online',
    lastSeen: new Date().toISOString(),
    latency: 50,
    totalInteractions: 0,
    trustScore: 95,
    chain: null,
    walletAddress: null,
  },
  'agent-code-auditor': {
    id: 'agent-code-auditor',
    name: 'Code Auditor',
    platform: 'boredbrain',
    endpoint: '/api/a2a',
    agentCardUrl: '/.well-known/agent.json',
    capabilities: ['text-generation', 'tool-use'],
    tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
    status: 'online',
    lastSeen: new Date().toISOString(),
    latency: 50,
    totalInteractions: 0,
    trustScore: 95,
    chain: null,
    walletAddress: null,
  },
  'agent-nft-analyst': {
    id: 'agent-nft-analyst',
    name: 'NFT Analyst',
    platform: 'boredbrain',
    endpoint: '/api/a2a',
    agentCardUrl: '/.well-known/agent.json',
    capabilities: ['text-generation', 'tool-use'],
    tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
    status: 'online',
    lastSeen: new Date().toISOString(),
    latency: 50,
    totalInteractions: 0,
    trustScore: 95,
    chain: null,
    walletAddress: null,
  },
};

// ---------------------------------------------------------------------------
// Simulated invocation for built-in nodes (no DB required)
// ---------------------------------------------------------------------------

function invokeBuiltinNode(
  node: NetworkNode,
  query: string,
  tools?: string[],
): { response: string; cost: number; latency: number } {
  const toolsToUse = tools && tools.length > 0 ? tools : node.tools.slice(0, 2);
  let totalCost = 0;
  for (const tool of toolsToUse) {
    const price = getToolPrice(tool);
    totalCost += price ?? 5;
  }
  const latency = 50 + Math.floor(Math.random() * 100);
  const response = `[BoredBrain ${node.name}] Processed query: "${query}". Used tools: ${toolsToUse.join(', ')}. Analysis complete with ${toolsToUse.length} data sources cross-referenced.`;
  return { response, cost: totalCost, latency };
}

// ---------------------------------------------------------------------------
// POST /api/network/invoke - Invoke an agent on any network node
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: {
    targetNodeId?: string;
    query?: string;
    tools?: string[];
    maxBudget?: number;
    callerNodeId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    );
  }

  const { targetNodeId, query, tools, maxBudget, callerNodeId } = body;

  if (!targetNodeId || !query) {
    return NextResponse.json(
      {
        error: 'Missing required fields: targetNodeId, query',
        required: ['targetNodeId', 'query'],
        optional: ['tools', 'maxBudget', 'callerNodeId'],
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // Resolve the target node from DB first, then fall back to built-in nodes
  let targetNode: NetworkNode | undefined;
  try {
    targetNode = await getNode(targetNodeId);
  } catch {
    // DB error — continue to fallback
  }

  if (!targetNode) {
    targetNode = BUILTIN_NODES[targetNodeId];
  }

  if (!targetNode) {
    return NextResponse.json(
      { error: `Node not found: ${targetNodeId}` },
      { status: 404, headers: corsHeaders },
    );
  }

  if (targetNode.status === 'offline') {
    return NextResponse.json(
      {
        error: `Node is offline: ${targetNode.name}`,
        node: {
          id: targetNode.id,
          name: targetNode.name,
          status: targetNode.status,
          lastSeen: targetNode.lastSeen,
        },
      },
      { status: 503, headers: corsHeaders },
    );
  }

  try {
    // For built-in nodes, invoke directly without DB round-trips
    const isBuiltin = targetNodeId in BUILTIN_NODES;
    let result: { response: string; cost: number; latency: number };

    if (isBuiltin) {
      result = invokeBuiltinNode(targetNode, query, tools);
    } else {
      result = await invokeExternalAgent(
        targetNodeId,
        query,
        tools,
        callerNodeId,
      );
    }

    // Check budget
    if (maxBudget !== undefined && result.cost > maxBudget) {
      return NextResponse.json(
        {
          error: 'Invocation cost exceeds max budget',
          cost: result.cost,
          maxBudget,
          currency: 'BBAI',
        },
        { status: 402, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        success: true,
        result: {
          response: result.response,
          cost: result.cost,
          currency: 'BBAI',
          latency: result.latency,
        },
        node: {
          id: targetNode.id,
          name: targetNode.name,
          platform: targetNode.platform,
          trustScore: targetNode.trustScore,
        },
        billing: callerNodeId
          ? {
              callerNodeId,
              targetNodeId,
              totalCost: result.cost,
              status: 'settled',
            }
          : null,
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Invocation failed',
        targetNodeId,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

// ---------------------------------------------------------------------------
// OPTIONS /api/network/invoke - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
