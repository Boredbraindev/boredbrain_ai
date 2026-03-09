import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentWallet,
  deductBalance,
  createAgentWallet,
} from '@/lib/agent-wallet';
import { getToolInfo } from '@/lib/tool-pricing';
import { getPooledClient, releasePooledClient } from '@/lib/mcp/client';
import {
  getProviderConfig,
  isProviderConfigured,
  getStaticToolList,
} from '@/lib/mcp/providers';
import { getIntegrationById } from '@/lib/external-integrations';

// ---------------------------------------------------------------------------
// Mock tool execution - generates descriptive results based on tool + args
// (used for internal BoredBrain tools only)
// ---------------------------------------------------------------------------

function generateMockResult(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const query =
    typeof args?.query === 'string'
      ? args.query
      : typeof args?.text === 'string'
        ? args.text
        : typeof args?.code === 'string'
          ? args.code
          : toolName;

  const mockResults: Record<string, (q: string) => string> = {
    web_search: (q) =>
      `Found 12 results for "${q}". Top result: Latest analysis and market insights available. Sources include CoinDesk, CoinTelegraph, and Bloomberg. Key findings suggest growing institutional interest and regulatory developments.`,
    x_search: (q) =>
      `48 posts found for "${q}". Trending sentiment: Bullish (62%). Top influencer mentions: 5. Most retweeted post has 2.3k engagements. Key opinion leaders are largely optimistic.`,
    coin_data: (q) =>
      `${q.toUpperCase()}: Price $67,432.18 | 24h Change +2.4% | Market Cap $1.32T | Volume $28.5B | Circulating Supply 19.6M | All-time High $73,750.`,
    coin_ohlc: (q) =>
      `${q.toUpperCase()} last 24h candles: Open $66,100 | High $68,200 | Low $65,800 | Close $67,432 | 15 candles returned with ${args.timeframe || '1h'} intervals.`,
    wallet_analyzer: (q) =>
      `Address ${args.address || q}: 23 tokens held | Net worth ~$145K | 312 transactions (30d) | DeFi protocols: Uniswap, Aave, Compound | Risk score: Low.`,
    stock_chart: (q) =>
      `${q.toUpperCase()}: Current $187.45 | 52wk High $199.62 | 52wk Low $124.17 | P/E 28.3 | Volume 45.2M | 90-day OHLC data returned.`,
    academic_search: (q) =>
      `Found 8 papers on "${q}". Top cited: "A Comprehensive Survey" (2024, 145 citations). Journals: Nature, IEEE, arXiv. Key themes identified across the literature.`,
    reddit_search: (q) =>
      `34 posts found for "${q}" across r/cryptocurrency, r/bitcoin, r/defi. Top post: 1.2k upvotes, 89 comments. Overall community sentiment: cautiously optimistic.`,
    youtube_search: (q) =>
      `15 videos found for "${q}". Top result: "Complete Guide" by CryptoDaily (234K views, 45min). Average view count: 85K.`,
    code_interpreter: (q) =>
      `Executed ${args.language || 'auto-detected'} code. Output: Computation completed successfully. Result: { status: "ok", rows: 42, executionTime: "1.2s" }. Input: "${q.slice(0, 80)}..."`,
    retrieve: (q) =>
      `Fetched content from "${q}". Page title extracted, 2,450 words of content parsed. Main topics identified: 3. Structured data extracted successfully.`,
    text_translate: (q) =>
      `Translated "${q.slice(0, 100)}${q.length > 100 ? '...' : ''}". Source language: auto-detected. Target: ${args.targetLanguage || 'en'}. Translation completed with 98% confidence.`,
    currency_converter: (q) =>
      `Converted ${q}. Rate: 1 USD = 0.92 EUR | 1 USD = 149.8 JPY | 1 BTC = $67,432. Last updated: ${new Date().toISOString()}.`,
    token_retrieval: (q) =>
      `${q}: Contract verified | Holders: 12,450 | Liquidity: $2.3M | DEX Volume (24h): $890K | Security: No issues detected. Chain: Ethereum.`,
    nft_retrieval: (q) =>
      `Collection "${q}": Floor price 0.45 ETH | Total supply: 10,000 | Unique holders: 5,234 | 24h volume: 12.3 ETH | Listed: 823 items.`,
    extreme_search: (q) =>
      `Comprehensive analysis of "${q}" completed. 47 sources analyzed across 6 domains. Key findings synthesized into 3 main themes with supporting evidence and cross-referenced citations.`,
    smart_contract_audit: (q) =>
      `Audit of contract complete. 0 critical, 1 medium, 3 low severity issues found. Gas optimization suggestions: 4. Overall security score: 87/100. Code coverage: 94%.`,
    whale_alert: (q) =>
      `Monitoring "${q}": 3 large transactions detected in last 1h. Largest: 500 BTC ($33.7M) moved from exchange to cold wallet. Net flow: outbound. Alert level: elevated.`,
  };

  const generator = mockResults[toolName];
  if (generator) return generator(query);

  return `Tool "${toolName}" executed for query "${query}". Result generated successfully.`;
}

// ---------------------------------------------------------------------------
// In-memory usage tracking for external MCP calls
// ---------------------------------------------------------------------------

interface UsageEntry {
  integrationId: string;
  toolName: string;
  agentId: string | null;
  timestamp: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

const usageLog: UsageEntry[] = [];
const MAX_USAGE_LOG = 1000;

function trackUsage(entry: UsageEntry): void {
  usageLog.push(entry);
  if (usageLog.length > MAX_USAGE_LOG) {
    usageLog.splice(0, usageLog.length - MAX_USAGE_LOG);
  }
}

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// POST /api/mcp/execute - Execute a tool via MCP protocol
//
// Supports two modes:
//   1. Internal tools (method: "tools/call") - existing mock tool system
//   2. External MCP providers (integrationId in body) - connects to real MCP servers
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: {
    method?: string;
    params?: {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    meta?: {
      agentId?: string;
      paymentMethod?: string;
    };
    id?: string | number;
    // External MCP provider fields
    integrationId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: -32700,
          message: 'Parse error: Invalid JSON',
        },
        isError: true,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // ---------------------------------------------------------------------------
  // Route to external MCP provider execution if integrationId is present
  // ---------------------------------------------------------------------------
  if (body.integrationId) {
    return handleExternalMCPExecution(body);
  }

  // ---------------------------------------------------------------------------
  // Internal tool execution (existing behavior)
  // ---------------------------------------------------------------------------

  // Validate MCP method
  const method = body.method;
  if (method !== 'tools/call') {
    return NextResponse.json(
      {
        error: {
          code: -32601,
          message: `Method not supported: "${method}". Use "tools/call" to execute tools, or provide "integrationId" for external MCP providers.`,
        },
        isError: true,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate tool name
  const toolName = body.params?.name;
  if (!toolName || typeof toolName !== 'string') {
    return NextResponse.json(
      {
        error: {
          code: -32602,
          message: 'Missing required parameter: params.name (tool name)',
        },
        isError: true,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate tool exists
  const toolInfo = getToolInfo(toolName);
  if (!toolInfo) {
    return NextResponse.json(
      {
        error: {
          code: -32602,
          message: `Unknown tool: "${toolName}". Use GET /api/mcp to list available tools.`,
        },
        isError: true,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const args = body.params?.arguments || {};
  const agentId = body.meta?.agentId;
  const cost = toolInfo.price;

  // ---------------------------------------------------------------------------
  // Paid mode: agent wallet billing
  // ---------------------------------------------------------------------------
  if (agentId && typeof agentId === 'string') {
    // Ensure wallet exists (auto-create if new external agent)
    let wallet = await getAgentWallet(agentId);
    if (!wallet) {
      wallet = await createAgentWallet(agentId);
    }

    // Check balance
    if (wallet.balance < cost) {
      return NextResponse.json(
        {
          content: [
            {
              type: 'text',
              text: `Insufficient BBAI balance. Required: ${cost} BBAI, Available: ${wallet.balance} BBAI. Top up your agent wallet to continue.`,
            },
          ],
          isError: true,
          billing: {
            cost: 0,
            unit: 'BBAI',
            error: 'insufficient_balance',
            required: cost,
            available: wallet.balance,
          },
        },
        { status: 402, headers: corsHeaders },
      );
    }

    // Deduct balance
    const deductResult = await deductBalance(
      agentId,
      cost,
      `mcp-execute: ${toolName}`,
    );

    if (!deductResult.success) {
      return NextResponse.json(
        {
          content: [
            {
              type: 'text',
              text: 'Payment failed. Daily spending limit may have been exceeded or wallet is inactive.',
            },
          ],
          isError: true,
          billing: {
            cost: 0,
            unit: 'BBAI',
            error: 'payment_failed',
            remaining: deductResult.remaining,
          },
        },
        { status: 402, headers: corsHeaders },
      );
    }

    // Execute tool and return paid result
    const resultText = generateMockResult(toolName, args);

    return NextResponse.json(
      {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
        isError: false,
        billing: {
          cost,
          unit: 'BBAI',
          txId: deductResult.txId,
          remaining: deductResult.remaining,
          agentId,
        },
        _meta: {
          tool: toolName,
          category: toolInfo.category,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: corsHeaders },
    );
  }

  // ---------------------------------------------------------------------------
  // Demo mode: free, limited results (no agentId)
  // ---------------------------------------------------------------------------
  const resultText = generateMockResult(toolName, args);
  // In demo mode, truncate the result to indicate limited access
  const demoText = `[DEMO MODE] ${resultText.slice(0, 200)}... (Full results require an agent wallet with BBAI. Register at /api/agents or provide meta.agentId)`;

  return NextResponse.json(
    {
      content: [
        {
          type: 'text',
          text: demoText,
        },
      ],
      isError: false,
      billing: {
        cost: 0,
        unit: 'BBAI',
        mode: 'demo',
        note: 'Free demo mode - limited results. Provide meta.agentId for full access.',
      },
      _meta: {
        tool: toolName,
        category: toolInfo.category,
        mode: 'demo',
        timestamp: new Date().toISOString(),
      },
    },
    { headers: corsHeaders },
  );
}

// ---------------------------------------------------------------------------
// External MCP provider execution
// POST body: { integrationId, toolName, args, meta?: { agentId } }
// ---------------------------------------------------------------------------

async function handleExternalMCPExecution(body: {
  integrationId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  meta?: { agentId?: string };
}) {
  const { integrationId, toolName, args = {}, meta } = body;
  const agentId = meta?.agentId ?? null;
  const startTime = Date.now();

  // Validate integrationId
  if (!integrationId || typeof integrationId !== 'string') {
    return NextResponse.json(
      {
        error: { code: -32602, message: 'Missing required field: integrationId' },
        isError: true,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate toolName
  if (!toolName || typeof toolName !== 'string') {
    return NextResponse.json(
      {
        error: { code: -32602, message: 'Missing required field: toolName' },
        isError: true,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate the integration exists in our registry
  const integration = getIntegrationById(integrationId);
  if (!integration) {
    return NextResponse.json(
      {
        error: {
          code: -32602,
          message: `Unknown integration: "${integrationId}". Use GET /api/integrations to list available integrations.`,
        },
        isError: true,
      },
      { status: 404, headers: corsHeaders },
    );
  }

  // Validate the tool exists in the integration's tool list
  const knownTools = getStaticToolList(integrationId);
  const toolExists =
    integration.tools.includes(toolName) ||
    knownTools.some((t) => t.name === toolName);

  if (!toolExists) {
    return NextResponse.json(
      {
        error: {
          code: -32602,
          message: `Unknown tool "${toolName}" for integration "${integration.name}". Use GET /api/mcp/tools?integrationId=${integrationId} to list available tools.`,
        },
        isError: true,
        availableTools: integration.tools,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // Check provider config and env vars
  const providerConfig = getProviderConfig(integrationId);
  if (!providerConfig) {
    return NextResponse.json(
      {
        error: {
          code: -32603,
          message: `No MCP connection config found for "${integrationId}". Provider may not be fully configured.`,
        },
        isError: true,
      },
      { status: 501, headers: corsHeaders },
    );
  }

  if (!isProviderConfigured(integrationId)) {
    return NextResponse.json(
      {
        error: {
          code: -32603,
          message: `Provider "${integration.name}" is missing required environment variables. Contact the admin to configure MCP access.`,
        },
        isError: true,
        provider: {
          id: integrationId,
          name: integration.name,
          transport: providerConfig.transport,
          status: 'unconfigured',
        },
      },
      { status: 503, headers: corsHeaders },
    );
  }

  // ---------------------------------------------------------------------------
  // Billing for external MCP calls (2 BBAI per call)
  // ---------------------------------------------------------------------------
  const externalToolCost = 2;

  if (agentId && typeof agentId === 'string') {
    let wallet = await getAgentWallet(agentId);
    if (!wallet) {
      wallet = await createAgentWallet(agentId);
    }

    if (wallet.balance < externalToolCost) {
      return NextResponse.json(
        {
          content: [
            {
              type: 'text',
              text: `Insufficient BBAI balance for external MCP call. Required: ${externalToolCost} BBAI, Available: ${wallet.balance} BBAI.`,
            },
          ],
          isError: true,
          billing: {
            cost: 0,
            unit: 'BBAI',
            error: 'insufficient_balance',
            required: externalToolCost,
            available: wallet.balance,
          },
        },
        { status: 402, headers: corsHeaders },
      );
    }

    const deductResult = await deductBalance(
      agentId,
      externalToolCost,
      `mcp-external: ${integrationId}/${toolName}`,
    );

    if (!deductResult.success) {
      return NextResponse.json(
        {
          content: [
            {
              type: 'text',
              text: 'Payment failed for external MCP call.',
            },
          ],
          isError: true,
          billing: {
            cost: 0,
            unit: 'BBAI',
            error: 'payment_failed',
            remaining: deductResult.remaining,
          },
        },
        { status: 402, headers: corsHeaders },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Connect to MCP server and execute the tool
  // ---------------------------------------------------------------------------
  try {
    const client = await getPooledClient(providerConfig);

    const result = await client.executeTool(toolName, args);

    const durationMs = Date.now() - startTime;

    // Track usage
    trackUsage({
      integrationId,
      toolName,
      agentId,
      timestamp: new Date().toISOString(),
      durationMs,
      success: !result.isError,
      error: result.isError
        ? result.content?.[0]?.text ?? 'Unknown error'
        : undefined,
    });

    return NextResponse.json(
      {
        content: result.content,
        isError: result.isError ?? false,
        provider: {
          id: integrationId,
          name: integration.name,
          transport: providerConfig.transport,
        },
        billing: agentId
          ? {
              cost: externalToolCost,
              unit: 'BBAI',
              agentId,
            }
          : {
              cost: 0,
              unit: 'BBAI',
              mode: 'demo',
            },
        _meta: {
          tool: toolName,
          integration: integrationId,
          durationMs,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Track failed usage
    trackUsage({
      integrationId,
      toolName,
      agentId,
      timestamp: new Date().toISOString(),
      durationMs,
      success: false,
      error: errorMessage,
    });

    // Release the broken connection from the pool
    await releasePooledClient(integrationId).catch(() => {});

    console.error(
      `[mcp/execute] External MCP error for ${integrationId}/${toolName}:`,
      errorMessage,
    );

    return NextResponse.json(
      {
        content: [
          {
            type: 'text',
            text: `Failed to execute tool "${toolName}" on provider "${integration.name}": ${errorMessage}`,
          },
        ],
        isError: true,
        provider: {
          id: integrationId,
          name: integration.name,
          transport: providerConfig.transport,
          status: 'error',
        },
        _meta: {
          tool: toolName,
          integration: integrationId,
          durationMs,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 502, headers: corsHeaders },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/mcp/execute - Usage stats for external MCP calls
// ---------------------------------------------------------------------------

export async function GET() {
  const totalCalls = usageLog.length;
  const successCalls = usageLog.filter((e) => e.success).length;
  const failCalls = totalCalls - successCalls;

  // Group by integration
  const byIntegration: Record<string, number> = {};
  for (const entry of usageLog) {
    byIntegration[entry.integrationId] = (byIntegration[entry.integrationId] ?? 0) + 1;
  }

  // Average duration
  const avgDuration =
    totalCalls > 0
      ? Math.round(usageLog.reduce((s, e) => s + e.durationMs, 0) / totalCalls)
      : 0;

  return NextResponse.json(
    {
      usage: {
        totalCalls,
        successCalls,
        failCalls,
        successRate: totalCalls > 0 ? ((successCalls / totalCalls) * 100).toFixed(1) + '%' : 'N/A',
        averageDurationMs: avgDuration,
        byIntegration,
      },
      recentCalls: usageLog.slice(-20).reverse(),
    },
    { headers: corsHeaders },
  );
}

// ---------------------------------------------------------------------------
// OPTIONS /api/mcp/execute - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
