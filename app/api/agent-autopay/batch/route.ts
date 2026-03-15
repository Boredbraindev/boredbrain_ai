export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentWallet,
  deductBalance,
  createAgentWallet,
} from '@/lib/agent-wallet';
import { getToolPrice, getToolInfo, TOOL_PRICES } from '@/lib/tool-pricing';

// ---------------------------------------------------------------------------
// Mock tool execution (mirrors the single-tool endpoint)
// ---------------------------------------------------------------------------

function generateMockResult(
  toolName: string,
  params: Record<string, unknown>,
): string {
  const query =
    typeof params?.query === 'string' ? params.query : toolName;

  const mockResults: Record<string, (q: string) => string> = {
    web_search: (q) =>
      `[Web Search] Found 12 results for "${q}". Top result: Latest analysis and market insights available. Sources include CoinDesk, CoinTelegraph, and Bloomberg.`,
    x_search: (q) =>
      `[X/Twitter] 48 posts found for "${q}". Trending sentiment: Bullish (62%). Top influencer mentions: 5. Most retweeted post has 2.3k engagements.`,
    coin_data: (q) =>
      `[Coin Data] ${q.toUpperCase()}: Price $67,432.18 | 24h Change +2.4% | Market Cap $1.32T | Volume $28.5B | Circulating Supply 19.6M.`,
    coin_ohlc: (q) =>
      `[OHLC Data] ${q.toUpperCase()} last 24h candles: Open $66,100 | High $68,200 | Low $65,800 | Close $67,432 | 15 candles returned.`,
    wallet_analyzer: (q) =>
      `[Wallet Analysis] Address ${q}: 23 tokens held | Net worth ~$145K | 312 transactions (30d) | DeFi protocols: Uniswap, Aave, Compound | Risk score: Low.`,
    stock_chart: (q) =>
      `[Stock Chart] ${q.toUpperCase()}: Current $187.45 | 52wk High $199.62 | 52wk Low $124.17 | P/E 28.3 | 90-day OHLC data returned.`,
    academic_search: (q) =>
      `[Academic] Found 8 papers on "${q}". Top cited: "A Comprehensive Survey" (2024, 145 citations). Journals: Nature, IEEE, arXiv.`,
    reddit_search: (q) =>
      `[Reddit] 34 posts found for "${q}" across r/cryptocurrency, r/bitcoin, r/defi. Top post: 1.2k upvotes, 89 comments.`,
    youtube_search: (q) =>
      `[YouTube] 15 videos found for "${q}". Top result: "Complete Guide" by CryptoDaily (234K views, 45min). Average view count: 85K.`,
    code_interpreter: (q) =>
      `[Code Interpreter] Executed code for "${q}". Output: Computation completed successfully. Result: { status: "ok", rows: 42, executionTime: "1.2s" }.`,
    retrieve: (q) =>
      `[URL Retrieval] Fetched content from "${q}". Page title extracted, 2,450 words of content parsed. Main topics identified: 3.`,
    text_translate: (q) =>
      `[Translation] Translated "${q}". Source language: auto-detected (EN). Target: specified. Translation completed with 98% confidence.`,
    currency_converter: (q) =>
      `[Currency] Converted ${q}. Rate: 1 USD = 0.92 EUR | 1 USD = 149.8 JPY | Last updated: ${new Date().toISOString()}.`,
    token_retrieval: (q) =>
      `[Token Data] ${q}: Contract verified | Holders: 12,450 | Liquidity: $2.3M | DEX Volume (24h): $890K | Security: No issues detected.`,
    nft_retrieval: (q) =>
      `[NFT Data] Collection "${q}": Floor price 0.45 ETH | Total supply: 10,000 | Unique holders: 5,234 | 24h volume: 12.3 ETH.`,
    extreme_search: (q) =>
      `[Deep Research] Comprehensive analysis of "${q}" completed. 47 sources analyzed across 6 domains. Key findings synthesized into 3 main themes with supporting evidence.`,
    smart_contract_audit: (q) =>
      `[Contract Audit] Audit of "${q}" complete. 0 critical, 1 medium, 3 low severity issues found. Gas optimization suggestions: 4. Overall score: 87/100.`,
    whale_alert: (q) =>
      `[Whale Alert] Monitoring "${q}": 3 large transactions detected in last 1h. Largest: 500 BTC ($33.7M) moved from exchange to cold wallet. Net flow: outbound.`,
  };

  const generator = mockResults[toolName];
  if (generator) return generator(query);

  return `[${toolName}] Mock execution completed for query "${query}". Result generated successfully.`;
}

// ---------------------------------------------------------------------------
// POST /api/agent-autopay/batch
// ---------------------------------------------------------------------------

interface BatchToolRequest {
  toolName: string;
  params?: Record<string, unknown>;
}

/**
 * Batch Auto-pay Endpoint
 *
 * Allows AI agents to execute multiple tools in a single request with a
 * single BBAI deduction for the total cost.
 *
 * Body:
 *   {
 *     "agentId": "agent-defi-oracle",
 *     "tools": [
 *       { "toolName": "web_search", "params": { "query": "BTC" } },
 *       { "toolName": "coin_data", "params": { "query": "bitcoin" } }
 *     ],
 *     "signature": "mock-sig-xxx"
 *   }
 */
export async function POST(request: NextRequest) {
  // Parse body
  let body: {
    agentId?: string;
    tools?: BatchToolRequest[];
    signature?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { agentId, tools, signature } = body;

  // --- Validate required fields ---
  if (!agentId || typeof agentId !== 'string') {
    return NextResponse.json(
      { error: 'agentId is required' },
      { status: 400 },
    );
  }

  if (!signature || typeof signature !== 'string') {
    return NextResponse.json(
      { error: 'signature is required for wallet authentication' },
      { status: 400 },
    );
  }

  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return NextResponse.json(
      { error: 'tools array is required and must not be empty' },
      { status: 400 },
    );
  }

  if (tools.length > 10) {
    return NextResponse.json(
      { error: 'Maximum 10 tools per batch request' },
      { status: 400 },
    );
  }

  // --- Validate all tool names and calculate total cost upfront ---
  const unknownTools: string[] = [];
  let totalCost = 0;
  const toolCosts: Array<{ toolName: string; cost: number }> = [];

  for (const t of tools) {
    if (!t.toolName || typeof t.toolName !== 'string') {
      return NextResponse.json(
        { error: 'Each tool entry must have a valid toolName' },
        { status: 400 },
      );
    }

    const price = getToolPrice(t.toolName);
    if (price === null) {
      unknownTools.push(t.toolName);
    } else {
      totalCost += price;
      toolCosts.push({ toolName: t.toolName, cost: price });
    }
  }

  if (unknownTools.length > 0) {
    return NextResponse.json(
      {
        error: `Unknown tool(s): ${unknownTools.map((t) => `"${t}"`).join(', ')}`,
        hint: 'Use GET /api/tools/pricing to list available tools',
      },
      { status: 400 },
    );
  }

  // --- Resolve agent wallet (auto-create if unknown) ---
  let wallet = await getAgentWallet(agentId);

  if (!wallet) {
    wallet = await createAgentWallet(agentId);
  }

  // --- Check sufficient balance for total cost ---
  if (wallet.balance < totalCost) {
    return NextResponse.json(
      {
        error: 'Insufficient BBAI balance for batch',
        required: totalCost,
        currentBalance: wallet.balance,
        toolBreakdown: toolCosts,
        agentId,
      },
      { status: 402 },
    );
  }

  // --- Single deduction for total cost ---
  const toolNames = tools.map((t) => t.toolName).join(', ');
  const deductResult = await deductBalance(
    agentId,
    totalCost,
    `auto-pay batch: ${toolNames}`,
  );

  if (!deductResult.success) {
    return NextResponse.json(
      {
        error: 'Payment failed - could not deduct BBAI',
        reason: 'Daily limit may have been exceeded or wallet is inactive',
        required: totalCost,
        currentBalance: deductResult.remaining,
      },
      { status: 402 },
    );
  }

  // --- Execute all tools (mock) ---
  const results = tools.map((t, index) => {
    const params = t.params ?? {};
    const info = getToolInfo(t.toolName)!;
    return {
      index,
      toolName: t.toolName,
      cost: info.price,
      costUnit: 'BBAI',
      result: generateMockResult(t.toolName, params),
    };
  });

  // --- Return batch results ---
  return NextResponse.json({
    success: true,
    txId: deductResult.txId,
    agent: agentId,
    totalCost,
    costUnit: 'BBAI',
    toolsExecuted: tools.length,
    remainingBalance: deductResult.remaining,
    results,
    timestamp: new Date().toISOString(),
  });
}
