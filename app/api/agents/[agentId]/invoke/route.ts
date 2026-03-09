import { NextRequest, NextResponse } from 'next/server';
import { MOCK_AGENTS } from '@/lib/mock-data';
import {
  getAgentWallet,
  createAgentWallet,
  deductBalance,
} from '@/lib/agent-wallet';
import { getToolPrice, getToolInfo } from '@/lib/tool-pricing';

/**
 * POST /api/agents/[agentId]/invoke
 *
 * Invoke a BoredBrain agent on behalf of an external (or internal) caller.
 *
 * Request body:
 * {
 *   "query": "Analyze Bitcoin DeFi ecosystem",
 *   "callerAgentId": "external-agent-123",   // optional - for inter-agent billing
 *   "maxBudget": 50,                          // max USDT to spend
 *   "tools": ["coin_data", "web_search"]      // optional - restrict to specific tools
 * }
 *
 * Flow:
 *   1. Validate the target agent exists
 *   2. If callerAgentId is provided, look up / create their wallet and validate budget
 *   3. Execute the agent's tools (mock execution with descriptive results)
 *   4. Deduct USDT from the caller's wallet (free in demo mode if no callerAgentId)
 *   5. Return structured response
 */

// ---------------------------------------------------------------------------
// Discovery agent registry (matches the discover endpoint)
// ---------------------------------------------------------------------------

interface AgentRecord {
  id: string;
  name: string;
  description: string;
  tools: string[];
  pricePerQuery: number;
}

const DISCOVERY_AGENTS: AgentRecord[] = [
  {
    id: 'agent-defi-oracle',
    name: 'DeFi Oracle',
    description: 'Analyzes DeFi protocols, yield farming, and liquidity data.',
    tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
    pricePerQuery: 40,
  },
  {
    id: 'agent-alpha-hunter',
    name: 'Alpha Hunter',
    description: 'Hunts market opportunities via whale monitoring and signals.',
    tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
    pricePerQuery: 35,
  },
  {
    id: 'agent-research-bot',
    name: 'Research Bot',
    description: 'Academic and deep-web research with code execution.',
    tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
    pricePerQuery: 30,
  },
  {
    id: 'agent-news-aggregator',
    name: 'News Aggregator',
    description: 'Compiles news from web, Reddit, YouTube, and X/Twitter.',
    tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
    pricePerQuery: 20,
  },
  {
    id: 'agent-code-auditor',
    name: 'Code Auditor',
    description: 'Smart contract vulnerability and gas auditing.',
    tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
    pricePerQuery: 45,
  },
  {
    id: 'agent-nft-analyst',
    name: 'NFT Analyst',
    description: 'NFT market analysis, collection tracking, and social buzz.',
    tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
    pricePerQuery: 30,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findAgent(agentId: string): AgentRecord | null {
  // Check canonical discovery agents first
  const discovery = DISCOVERY_AGENTS.find((a) => a.id === agentId);
  if (discovery) return discovery;

  // Fallback to MOCK_AGENTS from the marketplace
  const mock = MOCK_AGENTS.find((a) => a.id === agentId);
  if (mock) {
    return {
      id: mock.id,
      name: mock.name,
      description: mock.description,
      tools: (mock.tools as string[]) || [],
      pricePerQuery: Number(mock.pricePerQuery) || 10,
    };
  }

  return null;
}

/**
 * Simulate tool execution. In production this would call the real tool
 * pipeline, but for the discovery/invocation layer we return descriptive
 * mock results so external agents get a realistic payload shape.
 */
function mockExecuteTool(
  toolName: string,
  query: string,
  agentName: string,
): { tool: string; success: boolean; result: Record<string, unknown>; cost: number } {
  const price = getToolPrice(toolName) ?? 5;
  const info = getToolInfo(toolName);
  const displayName = info?.name ?? toolName;

  return {
    tool: toolName,
    success: true,
    result: {
      summary: `[${agentName}] Executed ${displayName} for query: "${query}"`,
      data: {
        source: toolName,
        query,
        timestamp: new Date().toISOString(),
        sampleInsight: `Analysis result from ${displayName} — processed by ${agentName} agent on the BoredBrain platform.`,
      },
    },
    cost: price,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  // -----------------------------------------------------------------------
  // 1. Validate agent exists
  // -----------------------------------------------------------------------
  const agentRecord = findAgent(agentId);
  if (!agentRecord) {
    return NextResponse.json(
      {
        error: 'Agent not found',
        message: `No agent with id "${agentId}" exists. Use GET /api/agents/discover to list available agents.`,
      },
      { status: 404 },
    );
  }

  // -----------------------------------------------------------------------
  // Parse body
  // -----------------------------------------------------------------------
  let body: {
    query?: string;
    callerAgentId?: string;
    maxBudget?: number;
    tools?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.query || typeof body.query !== 'string') {
    return NextResponse.json(
      { error: 'query is required and must be a string' },
      { status: 400 },
    );
  }

  const query = body.query;
  const callerAgentId = body.callerAgentId ?? null;
  const maxBudget = body.maxBudget ?? Infinity;
  const requestedTools = body.tools ?? null;

  // -----------------------------------------------------------------------
  // 2. Resolve tools to execute
  // -----------------------------------------------------------------------
  let toolsToRun = agentRecord.tools;

  // If the caller restricts to specific tools, intersect with agent's tools
  if (requestedTools && requestedTools.length > 0) {
    const agentToolSet = new Set(agentRecord.tools);
    toolsToRun = requestedTools.filter((t) => agentToolSet.has(t));

    if (toolsToRun.length === 0) {
      return NextResponse.json(
        {
          error: 'No matching tools',
          message: `Requested tools [${requestedTools.join(', ')}] do not overlap with agent tools [${agentRecord.tools.join(', ')}].`,
        },
        { status: 400 },
      );
    }
  }

  // -----------------------------------------------------------------------
  // 3. Estimate cost up-front
  // -----------------------------------------------------------------------
  const estimatedCost = toolsToRun.reduce(
    (sum, t) => sum + (getToolPrice(t) ?? 5),
    0,
  );

  if (estimatedCost > maxBudget) {
    return NextResponse.json(
      {
        error: 'Budget exceeded',
        message: `Estimated cost ${estimatedCost} USDT exceeds maxBudget ${maxBudget} USDT.`,
        estimatedCost,
        maxBudget,
      },
      { status: 402 },
    );
  }

  // -----------------------------------------------------------------------
  // 4. If callerAgentId provided, manage wallet
  // -----------------------------------------------------------------------
  let walletDeduction: { txId: string; remaining: number } | null = null;

  if (callerAgentId) {
    // Ensure the caller has a wallet (auto-create if first invocation)
    let wallet = await getAgentWallet(callerAgentId);
    if (!wallet) {
      wallet = await createAgentWallet(callerAgentId, 500);
    }

    // Check sufficient balance
    if (wallet.balance < estimatedCost) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          message: `Caller wallet has ${wallet.balance} USDT but estimated cost is ${estimatedCost} USDT.`,
          balance: wallet.balance,
          estimatedCost,
        },
        { status: 402 },
      );
    }

    // Deduct
    const deductResult = await deductBalance(
      callerAgentId,
      estimatedCost,
      `Invoke ${agentRecord.name} (${agentId}) — query: "${query.slice(0, 80)}"`,
    );

    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: 'Payment failed',
          message:
            'Wallet deduction failed. This may be caused by a daily spend limit.',
        },
        { status: 402 },
      );
    }

    walletDeduction = {
      txId: deductResult.txId,
      remaining: deductResult.remaining,
    };
  }

  // -----------------------------------------------------------------------
  // 5. Execute tools (mock)
  // -----------------------------------------------------------------------
  const startTime = Date.now();
  const results = toolsToRun.map((toolName) =>
    mockExecuteTool(toolName, query, agentRecord.name),
  );
  const latencyMs = Date.now() - startTime;

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

  // -----------------------------------------------------------------------
  // 6. Return response
  // -----------------------------------------------------------------------
  return NextResponse.json(
    {
      agentId: agentRecord.id,
      agentName: agentRecord.name,
      response: `${agentRecord.name} processed your query using ${results.length} tool(s). See results[] for detailed output.`,
      toolsUsed: results.map((r) => r.tool),
      cost: totalCost,
      costUnit: 'USDT',
      results,
      billing: callerAgentId
        ? {
            callerAgentId,
            charged: totalCost,
            txId: walletDeduction?.txId ?? null,
            remainingBalance: walletDeduction?.remaining ?? null,
          }
        : {
            mode: 'demo',
            note: 'No callerAgentId provided — executed in free demo mode. Provide callerAgentId for inter-agent billing.',
          },
      meta: {
        latencyMs,
        timestamp: new Date().toISOString(),
        query,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
