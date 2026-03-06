import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentWallet,
  deductBalance,
  createAgentWallet,
} from '@/lib/agent-wallet';
import { getToolInfo } from '@/lib/tool-pricing';

// ---------------------------------------------------------------------------
// Mock tool execution - generates descriptive results based on tool + args
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
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// POST /api/mcp/execute - Execute a tool via MCP protocol
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

  // Validate MCP method
  const method = body.method;
  if (method !== 'tools/call') {
    return NextResponse.json(
      {
        error: {
          code: -32601,
          message: `Method not supported: "${method}". Use "tools/call" to execute tools.`,
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
  const demoText = `[DEMO MODE] ${resultText.slice(0, 200)}... (Full results require an agent wallet with BBAI tokens. Register at /api/agents or provide meta.agentId)`;

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
// OPTIONS /api/mcp/execute - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
