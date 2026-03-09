import { NextRequest, NextResponse } from 'next/server';
import { getAllTools } from '@/lib/tool-pricing';

// ---------------------------------------------------------------------------
// Input schemas for each tool
// ---------------------------------------------------------------------------

const TOOL_INPUT_SCHEMAS: Record<string, {
  type: 'object';
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}> = {
  web_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  x_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for X/Twitter posts' },
      timeframe: { type: 'string', description: 'Time range filter (e.g. "24h", "7d", "30d")' },
    },
    required: ['query'],
  },
  coin_data: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Coin name or symbol to look up' },
      symbol: { type: 'string', description: 'Coin ticker symbol (e.g. BTC, ETH)' },
    },
    required: ['query'],
  },
  coin_ohlc: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Coin name or symbol' },
      symbol: { type: 'string', description: 'Coin ticker symbol (e.g. BTC, ETH)' },
      timeframe: { type: 'string', description: 'Candle timeframe (e.g. "1h", "4h", "1d")' },
    },
    required: ['query'],
  },
  wallet_analyzer: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Description of the analysis to perform' },
      address: { type: 'string', description: 'Wallet address to analyze' },
    },
    required: ['query'],
  },
  stock_chart: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Stock symbol or company name' },
      symbol: { type: 'string', description: 'Stock ticker symbol (e.g. AAPL, TSLA)' },
      timeframe: { type: 'string', description: 'Chart timeframe (e.g. "1d", "1w", "1m", "1y")' },
    },
    required: ['query'],
  },
  academic_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Academic search query for papers and research' },
    },
    required: ['query'],
  },
  reddit_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Reddit search query' },
    },
    required: ['query'],
  },
  youtube_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'YouTube search query' },
    },
    required: ['query'],
  },
  code_interpreter: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code to execute or analyze' },
      language: { type: 'string', description: 'Programming language (e.g. "python", "javascript")' },
    },
    required: ['code'],
  },
  retrieve: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'URL to retrieve content from' },
    },
    required: ['query'],
  },
  text_translate: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to translate' },
      targetLanguage: { type: 'string', description: 'Target language code (e.g. "es", "fr", "ko", "ja")' },
    },
    required: ['text'],
  },
  currency_converter: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Conversion query (e.g. "100 USD to EUR")' },
    },
    required: ['query'],
  },
  token_retrieval: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Token name, symbol, or contract address' },
      address: { type: 'string', description: 'Token contract address' },
    },
    required: ['query'],
  },
  nft_retrieval: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'NFT collection name or contract address' },
      address: { type: 'string', description: 'NFT contract address' },
    },
    required: ['query'],
  },
  extreme_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Research topic for deep multi-source analysis' },
    },
    required: ['query'],
  },
  smart_contract_audit: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Smart contract source code or address to audit' },
      language: { type: 'string', description: 'Contract language (e.g. "solidity", "vyper")' },
    },
    required: ['code'],
  },
  whale_alert: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Asset or address to monitor for whale activity' },
      address: { type: 'string', description: 'Specific wallet address to track' },
    },
    required: ['query'],
  },
};

// ---------------------------------------------------------------------------
// Tool descriptions for MCP (more detailed than the short names)
// ---------------------------------------------------------------------------

const TOOL_DESCRIPTIONS: Record<string, string> = {
  web_search: 'Search the web for information on any topic. Returns relevant search results with titles, snippets, and URLs.',
  x_search: 'Search X/Twitter for posts, sentiment, and trending topics. Returns recent posts and engagement metrics.',
  coin_data: 'Get real-time cryptocurrency market data including price, market cap, volume, and price changes.',
  coin_ohlc: 'Get OHLC (Open-High-Low-Close) candlestick data for any cryptocurrency over a specified timeframe.',
  wallet_analyzer: 'Analyze any blockchain wallet address for holdings, transaction history, DeFi activity, and risk assessment.',
  stock_chart: 'Get stock market chart data with OHLC candles, volume, and key financial metrics for any ticker.',
  academic_search: 'Search academic papers, journals, and research databases. Returns papers with citations and summaries.',
  reddit_search: 'Search Reddit for posts and discussions across subreddits. Returns posts with upvotes and comments.',
  youtube_search: 'Search YouTube for videos on any topic. Returns video titles, view counts, and channel information.',
  code_interpreter: 'Execute and analyze code in multiple programming languages. Supports Python, JavaScript, and more.',
  retrieve: 'Retrieve and parse content from any URL. Extracts text, metadata, and structured data from web pages.',
  text_translate: 'Translate text between languages with high accuracy. Supports 100+ language pairs.',
  currency_converter: 'Convert between fiat currencies and cryptocurrencies with real-time exchange rates.',
  token_retrieval: 'Get on-chain token data including contract info, holder count, liquidity, and security analysis.',
  nft_retrieval: 'Get NFT collection data including floor price, supply, holder stats, and recent sales.',
  extreme_search: 'Deep research tool that synthesizes information from 40+ sources across multiple domains for comprehensive analysis.',
  smart_contract_audit: 'Audit smart contracts for security vulnerabilities, gas optimization, and best-practice compliance.',
  whale_alert: 'Monitor large cryptocurrency transactions and whale wallet movements in real-time.',
};

// ---------------------------------------------------------------------------
// Build the list of available agents for the manifest
// ---------------------------------------------------------------------------

const MANIFEST_AGENTS = [
  {
    id: 'agent-defi-oracle',
    name: 'DeFi Oracle',
    description: 'Analyzes DeFi protocols, yield farming, and liquidity pool data across chains.',
    tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
    specialization: 'defi',
    status: 'online',
  },
  {
    id: 'agent-alpha-hunter',
    name: 'Alpha Hunter',
    description: 'Hunts for market opportunities via whale movements, social sentiment, and on-chain signals.',
    tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
    specialization: 'market',
    status: 'online',
  },
  {
    id: 'agent-research-bot',
    name: 'Research Bot',
    description: 'Academic and deep-web research agent that synthesizes papers, code, and multi-source data.',
    tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
    specialization: 'research',
    status: 'online',
  },
  {
    id: 'agent-news-aggregator',
    name: 'News Aggregator',
    description: 'Compiles breaking news from web, social media, Reddit, and YouTube into structured briefings.',
    tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
    specialization: 'news',
    status: 'online',
  },
  {
    id: 'agent-code-auditor',
    name: 'Code Auditor',
    description: 'Audits smart contracts for vulnerabilities, gas optimization, and best-practice compliance.',
    tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
    specialization: 'security',
    status: 'online',
  },
  {
    id: 'agent-nft-analyst',
    name: 'NFT Analyst',
    description: 'Tracks NFT market trends, collection analytics, whale purchases, and social buzz.',
    tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
    specialization: 'nft',
    status: 'online',
  },
];

// ---------------------------------------------------------------------------
// GET /api/mcp - MCP Server Manifest
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  const allTools = getAllTools();

  // Build MCP-format tool list with full schemas
  const mcpTools = allTools.map((tool) => ({
    name: tool.id,
    description: TOOL_DESCRIPTIONS[tool.id] || tool.name,
    inputSchema: TOOL_INPUT_SCHEMAS[tool.id] || {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Query input' },
      },
      required: ['query'],
    },
    pricing: {
      cost: tool.price,
      unit: 'BBAI',
    },
    category: tool.category,
  }));

  const manifest = {
    name: 'boredbrain-mcp',
    version: '1.0.0',
    description: 'BoredBrain AI Agent Economy - MCP Tool Server',
    protocol: 'mcp',
    tools: mcpTools,
    agents: MANIFEST_AGENTS,
    authentication: {
      type: 'wallet-signature',
      token: 'BBAI',
      description: 'Authenticate via BBAI wallet signature. Demo mode available without authentication.',
    },
    endpoints: {
      execute: '/api/mcp/execute',
      resources: '/api/mcp/resources',
      discovery: '/api/agents/discover',
      autopay: '/api/agent-autopay',
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
      logging: false,
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}

// ---------------------------------------------------------------------------
// OPTIONS /api/mcp - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
