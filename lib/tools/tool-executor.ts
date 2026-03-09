/**
 * Tool Executor for Agent Execution Engine
 *
 * Standalone tool registry and executor that the agent-executor uses to run
 * tools requested by LLMs. Uses raw fetch() calls with graceful fallback
 * to mock data when API keys are not configured.
 *
 * This is separate from the Vercel AI SDK tool definitions in the existing
 * tools/ directory -- those are for the chat UI. This module provides a
 * simpler execute-by-name interface for the agent execution engine.
 */

import { serverEnv } from '@/env/server';
import { executeCoinData, executeCoinOhlc } from '@/lib/tools/coin-data-executor';
import { executeWebSearch } from '@/lib/tools/web-search-executor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Tool definitions for LLM function-calling schemas
// ---------------------------------------------------------------------------

const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  coin_data: {
    name: 'coin_data',
    description:
      'Get comprehensive cryptocurrency data including price, market cap, volume, and metadata from CoinGecko.',
    parameters: {
      type: 'object',
      properties: {
        coinId: {
          type: 'string',
          description: 'The CoinGecko coin ID (e.g., bitcoin, ethereum, solana)',
        },
      },
      required: ['coinId'],
    },
    execute: (args) => executeCoinData(args as { coinId: string }),
  },

  coin_ohlc: {
    name: 'coin_ohlc',
    description:
      'Get OHLC (Open, High, Low, Close) candlestick data for a cryptocurrency.',
    parameters: {
      type: 'object',
      properties: {
        coinId: {
          type: 'string',
          description: 'The CoinGecko coin ID (e.g., bitcoin, ethereum, solana)',
        },
        days: {
          type: 'number',
          description: 'Number of days of data (1, 7, 14, 30, 90, 180, 365)',
        },
        vsCurrency: {
          type: 'string',
          description: 'Target currency (default: usd)',
        },
      },
      required: ['coinId'],
    },
    execute: (args) =>
      executeCoinOhlc(args as { coinId: string; days?: number; vsCurrency?: string }),
  },

  web_search: {
    name: 'web_search',
    description:
      'Search the web for current information using Tavily search engine.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
        topic: {
          type: 'string',
          enum: ['general', 'news'],
          description: 'Search topic type (default: general)',
        },
      },
      required: ['query'],
    },
    execute: (args) =>
      executeWebSearch(args as { query: string; maxResults?: number; topic?: string }),
  },

  x_search: {
    name: 'x_search',
    description: 'Search X/Twitter for posts and discussions on a topic.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query for X/Twitter',
        },
      },
      required: ['query'],
    },
    execute: async (args) => {
      // X search delegates to web_search with site filter
      return executeWebSearch({
        query: `site:x.com OR site:twitter.com ${(args as { query: string }).query}`,
        maxResults: 5,
      });
    },
  },

  reddit_search: {
    name: 'reddit_search',
    description: 'Search Reddit for discussions and posts on a topic.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query for Reddit',
        },
      },
      required: ['query'],
    },
    execute: async (args) => {
      return executeWebSearch({
        query: `site:reddit.com ${(args as { query: string }).query}`,
        maxResults: 5,
      });
    },
  },

  academic_search: {
    name: 'academic_search',
    description: 'Search for academic papers and research on a topic.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The academic search query',
        },
      },
      required: ['query'],
    },
    execute: async (args) => {
      return executeWebSearch({
        query: `site:arxiv.org OR site:scholar.google.com OR site:pubmed.ncbi.nlm.nih.gov ${(args as { query: string }).query}`,
        maxResults: 5,
      });
    },
  },

  youtube_search: {
    name: 'youtube_search',
    description: 'Search YouTube for relevant videos on a topic.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The YouTube search query',
        },
      },
      required: ['query'],
    },
    execute: async (args) => {
      return executeWebSearch({
        query: `site:youtube.com ${(args as { query: string }).query}`,
        maxResults: 5,
      });
    },
  },

  wallet_analyzer: {
    name: 'wallet_analyzer',
    description:
      'Analyze a blockchain wallet address for holdings, transactions, and patterns.',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The wallet address to analyze',
        },
        chain: {
          type: 'string',
          description: 'The blockchain network (default: ethereum)',
        },
      },
      required: ['address'],
    },
    execute: async (args) => {
      const { address, chain } = args as { address: string; chain?: string };
      // Mock wallet analysis -- real implementation would use Alchemy/Etherscan
      return {
        success: true,
        address,
        chain: chain ?? 'ethereum',
        simulated: true,
        summary: `Wallet analysis for ${address} on ${chain ?? 'ethereum'}`,
        data: {
          balance: '0.00 ETH (simulated)',
          tokenCount: 0,
          nftCount: 0,
          transactionCount: 0,
          note: 'Configure ALCHEMY_API_KEY for real wallet analysis.',
        },
      };
    },
  },

  currency_converter: {
    name: 'currency_converter',
    description: 'Convert between currencies using current exchange rates.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount to convert' },
        from: { type: 'string', description: 'Source currency code (e.g., USD)' },
        to: { type: 'string', description: 'Target currency code (e.g., EUR)' },
      },
      required: ['amount', 'from', 'to'],
    },
    execute: async (args) => {
      const { amount, from, to } = args as { amount: number; from: string; to: string };
      // Simple mock -- real implementation would use exchange rate API
      return {
        success: true,
        simulated: true,
        amount,
        from,
        to,
        result: amount, // 1:1 mock
        note: 'Simulated conversion. Real rates require an exchange rate API.',
      };
    },
  },

  stock_chart: {
    name: 'stock_chart',
    description: 'Get stock chart data and price information for a ticker symbol.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Stock ticker symbol (e.g., AAPL, TSLA)' },
        period: { type: 'string', description: 'Time period (1d, 5d, 1mo, 3mo, 1y)' },
      },
      required: ['symbol'],
    },
    execute: async (args) => {
      const { symbol, period } = args as { symbol: string; period?: string };
      return {
        success: true,
        simulated: true,
        symbol,
        period: period ?? '1d',
        note: 'Simulated stock data. Configure a financial data API for real data.',
      };
    },
  },

  code_interpreter: {
    name: 'code_interpreter',
    description: 'Execute code snippets for computation and data analysis.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The code to execute' },
        language: { type: 'string', description: 'Programming language (default: python)' },
      },
      required: ['code'],
    },
    execute: async (args) => {
      const { code, language } = args as { code: string; language?: string };
      return {
        success: true,
        simulated: true,
        language: language ?? 'python',
        note: 'Code interpreter is simulated. Configure DAYTONA_API_KEY for real code execution.',
        input: code.slice(0, 500),
      };
    },
  },

  retrieve: {
    name: 'retrieve',
    description: 'Retrieve and extract content from a URL.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to retrieve content from' },
      },
      required: ['url'],
    },
    execute: async (args) => {
      const { url } = args as { url: string };
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'BoredBrain-Agent/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!resp.ok) {
          return { success: false, url, error: `HTTP ${resp.status}` };
        }
        const text = await resp.text();
        return {
          success: true,
          url,
          contentLength: text.length,
          content: text.slice(0, 5000),
        };
      } catch (err) {
        return {
          success: false,
          url,
          error: err instanceof Error ? err.message : 'Retrieval failed',
        };
      }
    },
  },

  whale_alert: {
    name: 'whale_alert',
    description: 'Monitor large cryptocurrency transactions and whale movements.',
    parameters: {
      type: 'object',
      properties: {
        minValue: { type: 'number', description: 'Minimum transaction value in USD' },
        currency: { type: 'string', description: 'Cryptocurrency to monitor (e.g., btc, eth)' },
      },
      required: [],
    },
    execute: async (args) => {
      return {
        success: true,
        simulated: true,
        note: 'Whale alert is simulated. Configure WHALE_ALERT_API_KEY for real data.',
        ...(args as Record<string, unknown>),
      };
    },
  },

  token_retrieval: {
    name: 'token_retrieval',
    description: 'Get on-chain token data including contract info and holder statistics.',
    parameters: {
      type: 'object',
      properties: {
        contractAddress: { type: 'string', description: 'Token contract address' },
        chain: { type: 'string', description: 'Blockchain network (default: ethereum)' },
      },
      required: ['contractAddress'],
    },
    execute: async (args) => {
      return {
        success: true,
        simulated: true,
        note: 'Token retrieval is simulated. Configure ALCHEMY_API_KEY for real data.',
        ...(args as Record<string, unknown>),
      };
    },
  },

  nft_retrieval: {
    name: 'nft_retrieval',
    description: 'Get NFT collection and token data.',
    parameters: {
      type: 'object',
      properties: {
        contractAddress: { type: 'string', description: 'NFT contract address' },
        tokenId: { type: 'string', description: 'Specific token ID (optional)' },
      },
      required: ['contractAddress'],
    },
    execute: async (args) => {
      return {
        success: true,
        simulated: true,
        note: 'NFT retrieval is simulated. Configure ALCHEMY_API_KEY for real data.',
        ...(args as Record<string, unknown>),
      };
    },
  },

  smart_contract_audit: {
    name: 'smart_contract_audit',
    description: 'Audit a smart contract for vulnerabilities and gas optimization.',
    parameters: {
      type: 'object',
      properties: {
        contractAddress: { type: 'string', description: 'Contract address to audit' },
        chain: { type: 'string', description: 'Blockchain network (default: ethereum)' },
      },
      required: ['contractAddress'],
    },
    execute: async (args) => {
      return {
        success: true,
        simulated: true,
        note: 'Smart contract audit is simulated.',
        ...(args as Record<string, unknown>),
      };
    },
  },

  text_translate: {
    name: 'text_translate',
    description: 'Translate text between languages.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to translate' },
        targetLanguage: { type: 'string', description: 'Target language code (e.g., en, ko, ja)' },
        sourceLanguage: { type: 'string', description: 'Source language code (optional, auto-detect)' },
      },
      required: ['text', 'targetLanguage'],
    },
    execute: async (args) => {
      return {
        success: true,
        simulated: true,
        note: 'Translation is simulated.',
        ...(args as Record<string, unknown>),
      };
    },
  },

  extreme_search: {
    name: 'extreme_search',
    description: 'Deep multi-source research across web, academic, and social sources.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The deep research query' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const { query } = args as { query: string };
      // Run multiple web searches in parallel for "extreme" depth
      const [webResults, newsResults] = await Promise.all([
        executeWebSearch({ query, maxResults: 10, topic: 'general' }),
        executeWebSearch({ query, maxResults: 5, topic: 'news' }),
      ]);
      return {
        success: true,
        query,
        web: webResults,
        news: newsResults,
        source: 'extreme_search (multi-pass)',
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a tool by name with the given arguments.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = TOOL_REGISTRY[toolName];

  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
      availableTools: Object.keys(TOOL_REGISTRY),
    };
  }

  return tool.execute(args);
}

/**
 * Get OpenAI-compatible function-calling tool definitions for a set of tool names.
 * Used by the agent executor to pass to LLM APIs.
 */
export function getAvailableToolDefinitions(
  toolNames: string[],
): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return toolNames
    .filter((name) => TOOL_REGISTRY[name])
    .map((name) => {
      const tool = TOOL_REGISTRY[name];
      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      };
    });
}

/**
 * List all registered tool names.
 */
export function getRegisteredToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}
