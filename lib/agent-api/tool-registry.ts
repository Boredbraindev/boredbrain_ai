import { z, ZodSchema } from 'zod';
import {
  stockChartTool,
  currencyConverterTool,
  xSearchTool,
  textTranslateTool,
  movieTvSearchTool,
  trendingMoviesTool,
  trendingTvTool,
  academicSearchTool,
  youtubeSearchTool,
  retrieveTool,
  weatherTool,
  codeInterpreterTool,
  findPlaceOnMapTool,
  nearbyPlacesSearchTool,
  flightTrackerTool,
  coinDataTool,
  coinDataByContractTool,
  coinOhlcTool,
  datetimeTool,
  nftRetrievalTool,
  tokenRetrievalTool,
  walletAnalyzerTool,
  redditSearchTool,
  webSearchTool,
  extremeSearchTool,
} from '@/lib/tools';

export interface ToolMeta {
  name: string;
  description: string;
  category: 'search' | 'finance' | 'location' | 'media' | 'utility';
  pricePerCall: number; // in USDT (not wei)
  rateLimit: number; // per minute
  tool: any; // Vercel AI SDK tool
  requiresStreaming: boolean;
}

// Tool registry with pricing and metadata
export const toolRegistry: Record<string, ToolMeta> = {
  stock_chart: {
    name: 'stock_chart',
    description: 'Get OHLC stock chart data for any ticker symbol',
    category: 'finance',
    pricePerCall: 10,
    rateLimit: 30,
    tool: stockChartTool,
    requiresStreaming: false,
  },
  currency_converter: {
    name: 'currency_converter',
    description: 'Convert between currencies with real-time exchange rates',
    category: 'finance',
    pricePerCall: 3,
    rateLimit: 60,
    tool: currencyConverterTool,
    requiresStreaming: false,
  },
  x_search: {
    name: 'x_search',
    description: 'Search Twitter/X for real-time posts and trends',
    category: 'search',
    pricePerCall: 20,
    rateLimit: 20,
    tool: xSearchTool,
    requiresStreaming: false,
  },
  text_translate: {
    name: 'text_translate',
    description: 'Translate text between languages',
    category: 'utility',
    pricePerCall: 5,
    rateLimit: 60,
    tool: textTranslateTool,
    requiresStreaming: false,
  },
  movie_or_tv_search: {
    name: 'movie_or_tv_search',
    description: 'Search for movies and TV shows with ratings and details',
    category: 'media',
    pricePerCall: 5,
    rateLimit: 30,
    tool: movieTvSearchTool,
    requiresStreaming: false,
  },
  trending_movies: {
    name: 'trending_movies',
    description: 'Get currently trending movies',
    category: 'media',
    pricePerCall: 3,
    rateLimit: 30,
    tool: trendingMoviesTool,
    requiresStreaming: false,
  },
  trending_tv: {
    name: 'trending_tv',
    description: 'Get currently trending TV shows',
    category: 'media',
    pricePerCall: 3,
    rateLimit: 30,
    tool: trendingTvTool,
    requiresStreaming: false,
  },
  academic_search: {
    name: 'academic_search',
    description: 'Search academic papers and research publications',
    category: 'search',
    pricePerCall: 15,
    rateLimit: 20,
    tool: academicSearchTool,
    requiresStreaming: false,
  },
  youtube_search: {
    name: 'youtube_search',
    description: 'Search YouTube videos with captions and metadata',
    category: 'search',
    pricePerCall: 10,
    rateLimit: 20,
    tool: youtubeSearchTool,
    requiresStreaming: false,
  },
  retrieve: {
    name: 'retrieve',
    description: 'Retrieve and extract content from any URL',
    category: 'utility',
    pricePerCall: 8,
    rateLimit: 30,
    tool: retrieveTool,
    requiresStreaming: false,
  },
  get_weather_data: {
    name: 'get_weather_data',
    description: 'Get current weather data for any location',
    category: 'location',
    pricePerCall: 3,
    rateLimit: 60,
    tool: weatherTool,
    requiresStreaming: false,
  },
  code_interpreter: {
    name: 'code_interpreter',
    description: 'Execute code in a sandboxed environment (Python, JS, etc.)',
    category: 'utility',
    pricePerCall: 25,
    rateLimit: 10,
    tool: codeInterpreterTool,
    requiresStreaming: false,
  },
  find_place_on_map: {
    name: 'find_place_on_map',
    description: 'Find places on a map with coordinates and details',
    category: 'location',
    pricePerCall: 5,
    rateLimit: 30,
    tool: findPlaceOnMapTool,
    requiresStreaming: false,
  },
  nearby_places_search: {
    name: 'nearby_places_search',
    description: 'Search for nearby places around a location',
    category: 'location',
    pricePerCall: 5,
    rateLimit: 30,
    tool: nearbyPlacesSearchTool,
    requiresStreaming: false,
  },
  track_flight: {
    name: 'track_flight',
    description: 'Track flight status and details',
    category: 'location',
    pricePerCall: 8,
    rateLimit: 20,
    tool: flightTrackerTool,
    requiresStreaming: false,
  },
  coin_data: {
    name: 'coin_data',
    description: 'Get comprehensive cryptocurrency data (price, market cap, etc.)',
    category: 'finance',
    pricePerCall: 5,
    rateLimit: 60,
    tool: coinDataTool,
    requiresStreaming: false,
  },
  coin_data_by_contract: {
    name: 'coin_data_by_contract',
    description: 'Get coin data by smart contract address',
    category: 'finance',
    pricePerCall: 5,
    rateLimit: 60,
    tool: coinDataByContractTool,
    requiresStreaming: false,
  },
  coin_ohlc: {
    name: 'coin_ohlc',
    description: 'Get OHLC candlestick chart data for cryptocurrencies',
    category: 'finance',
    pricePerCall: 5,
    rateLimit: 60,
    tool: coinOhlcTool,
    requiresStreaming: false,
  },
  datetime: {
    name: 'datetime',
    description: 'Get current date, time, and timezone information',
    category: 'utility',
    pricePerCall: 1,
    rateLimit: 120,
    tool: datetimeTool,
    requiresStreaming: false,
  },
  reddit_search: {
    name: 'reddit_search',
    description: 'Search Reddit posts and comments',
    category: 'search',
    pricePerCall: 10,
    rateLimit: 20,
    tool: redditSearchTool,
    requiresStreaming: false,
  },
  nft_retrieval: {
    name: 'nft_retrieval',
    description: 'Retrieve NFT collection data and metadata',
    category: 'finance',
    pricePerCall: 8,
    rateLimit: 30,
    tool: nftRetrievalTool,
    requiresStreaming: false,
  },
  token_retrieval: {
    name: 'token_retrieval',
    description: 'Retrieve token information and analytics',
    category: 'finance',
    pricePerCall: 8,
    rateLimit: 30,
    tool: tokenRetrievalTool,
    requiresStreaming: false,
  },
  wallet_analyzer: {
    name: 'wallet_analyzer',
    description: 'Analyze wallet on-chain activity, holdings, and persona',
    category: 'finance',
    pricePerCall: 30,
    rateLimit: 10,
    tool: walletAnalyzerTool,
    requiresStreaming: false,
  },
  web_search: {
    name: 'web_search',
    description: 'Search the web with multiple queries using parallel search engines (Exa, Tavily, Firecrawl)',
    category: 'search',
    pricePerCall: 10,
    rateLimit: 30,
    tool: webSearchTool(undefined, 'parallel'),
    requiresStreaming: false,
  },
  extreme_search: {
    name: 'extreme_search',
    description: 'Conduct deep research on a topic — plans research, runs multiple searches, synthesizes results with code execution',
    category: 'search',
    pricePerCall: 50,
    rateLimit: 5,
    tool: extremeSearchTool(undefined),
    requiresStreaming: false,
  },
};

/**
 * Get all available tools as a list for API discovery
 */
export function getToolCatalog() {
  return Object.entries(toolRegistry).map(([key, meta]) => ({
    name: meta.name,
    description: meta.description,
    category: meta.category,
    pricePerCall: meta.pricePerCall,
    rateLimit: meta.rateLimit,
    inputSchema: meta.tool.inputSchema
      ? JSON.parse(JSON.stringify(meta.tool.inputSchema))
      : null,
  }));
}

/**
 * Get a specific tool by name
 */
export function getTool(name: string): ToolMeta | undefined {
  return toolRegistry[name];
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return Object.keys(toolRegistry);
}

/**
 * Check if a tool exists
 */
export function hasTool(name: string): boolean {
  return name in toolRegistry;
}
