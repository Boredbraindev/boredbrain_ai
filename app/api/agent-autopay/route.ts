export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentWallet,
  deductBalance,
  createAgentWallet,
} from '@/lib/agent-wallet';
import { getToolPrice, getToolInfo } from '@/lib/tool-pricing';

// ---------------------------------------------------------------------------
// Mock tool execution
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
// POST /api/agent-autopay
// ---------------------------------------------------------------------------

/**
 * Agent Auto-pay Endpoint
 *
 * Allows AI agents to call tools and automatically pay with their BBAI
 * wallet balance. No API key needed - agents authenticate with their
 * wallet signature.
 *
 * Body:
 *   {
 *     "agentId": "agent-defi-oracle",
 *     "toolName": "web_search",
 *     "params": { "query": "Bitcoin price analysis" },
 *     "signature": "mock-sig-xxx"
 *   }
 */
export async function POST(request: NextRequest) {
  // Parse body
  let body: {
    agentId?: string;
    toolName?: string;
    params?: Record<string, unknown>;
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

  const { agentId, toolName, params = {}, signature } = body;

  // --- Validate required fields ---
  if (!agentId || typeof agentId !== 'string') {
    return NextResponse.json(
      { error: 'agentId is required' },
      { status: 400 },
    );
  }

  if (!toolName || typeof toolName !== 'string') {
    return NextResponse.json(
      { error: 'toolName is required' },
      { status: 400 },
    );
  }

  if (!signature || typeof signature !== 'string') {
    return NextResponse.json(
      { error: 'signature is required for wallet authentication' },
      { status: 400 },
    );
  }

  // --- Validate tool exists ---
  const toolInfo = getToolInfo(toolName);

  if (!toolInfo) {
    return NextResponse.json(
      {
        error: `Unknown tool: "${toolName}"`,
        hint: 'Use GET /api/tools/pricing to list available tools',
      },
      { status: 400 },
    );
  }

  const cost = toolInfo.price;

  // --- Resolve agent wallet (auto-create if unknown) ---
  let wallet = await getAgentWallet(agentId);

  if (!wallet) {
    wallet = await createAgentWallet(agentId);
  }

  // --- Check sufficient balance ---
  if (wallet.balance < cost) {
    return NextResponse.json(
      {
        error: 'Insufficient BBAI balance',
        required: cost,
        currentBalance: wallet.balance,
        toolName,
        agentId,
      },
      { status: 402 },
    );
  }

  // --- Deduct balance ---
  const deductResult = await deductBalance(
    agentId,
    cost,
    `auto-pay: ${toolName}`,
  );

  if (!deductResult.success) {
    return NextResponse.json(
      {
        error: 'Payment failed - could not deduct BBAI',
        reason: 'Daily limit may have been exceeded or wallet is inactive',
        currentBalance: deductResult.remaining,
      },
      { status: 402 },
    );
  }

  // --- Execute tool (mock) ---
  const result = generateMockResult(toolName, params);

  // --- Return success ---
  return NextResponse.json({
    success: true,
    txId: deductResult.txId,
    toolName,
    cost,
    costUnit: 'BBAI',
    result,
    remainingBalance: deductResult.remaining,
    agent: agentId,
    timestamp: new Date().toISOString(),
  });
}
