/**
 * Tool Pricing Registry for Agent Auto-pay
 *
 * Defines BBAI costs for each tool that agents can invoke.
 * These prices are separate from the API-key-based tool registry pricing
 * and are specifically designed for wallet-signature-based auto-pay flows.
 */

export interface ToolPriceInfo {
  price: number;
  name: string;
  category: string;
}

export const TOOL_PRICES: Record<string, ToolPriceInfo> = {
  web_search: { price: 1, name: 'Web Search', category: 'search' },
  x_search: { price: 2, name: 'X/Twitter Search', category: 'social' },
  coin_data: { price: 3, name: 'Coin Market Data', category: 'finance' },
  coin_ohlc: { price: 5, name: 'Coin OHLC Data', category: 'finance' },
  wallet_analyzer: { price: 10, name: 'Wallet Analyzer', category: 'onchain' },
  stock_chart: { price: 5, name: 'Stock Chart Data', category: 'finance' },
  academic_search: { price: 3, name: 'Academic Search', category: 'research' },
  reddit_search: { price: 2, name: 'Reddit Search', category: 'social' },
  youtube_search: { price: 2, name: 'YouTube Search', category: 'social' },
  code_interpreter: { price: 8, name: 'Code Interpreter', category: 'compute' },
  retrieve: { price: 1, name: 'URL Retrieval', category: 'search' },
  text_translate: { price: 1, name: 'Text Translate', category: 'utility' },
  currency_converter: { price: 1, name: 'Currency Converter', category: 'utility' },
  token_retrieval: { price: 5, name: 'Token On-chain Data', category: 'onchain' },
  nft_retrieval: { price: 5, name: 'NFT Data', category: 'onchain' },
  extreme_search: { price: 50, name: 'Deep Research', category: 'premium' },
  smart_contract_audit: { price: 20, name: 'Smart Contract Audit', category: 'premium' },
  whale_alert: { price: 15, name: 'Whale Alert Scanner', category: 'onchain' },
};

/**
 * Get the BBAI price for a specific tool. Returns null if the tool is unknown.
 */
export function getToolPrice(toolName: string): number | null {
  const info = TOOL_PRICES[toolName];
  return info ? info.price : null;
}

/**
 * Get full pricing info for a specific tool. Returns null if the tool is unknown.
 */
export function getToolInfo(
  toolName: string,
): { price: number; name: string; category: string } | null {
  return TOOL_PRICES[toolName] ?? null;
}

/**
 * Get all available tools as an array with their IDs and pricing info.
 */
export function getAllTools(): Array<{
  id: string;
  price: number;
  name: string;
  category: string;
}> {
  return Object.entries(TOOL_PRICES).map(([id, info]) => ({
    id,
    price: info.price,
    name: info.name,
    category: info.category,
  }));
}
