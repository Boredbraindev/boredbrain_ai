/**
 * Blockchain Configuration for BBAI Token Operations
 *
 * Supports Base mainnet (chainId 8453) and Base Sepolia testnet (chainId 84532).
 * Contract addresses are placeholders until deployment; when no address is
 * configured the payment service falls back to simulation mode.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  bbaiTokenAddress: string | null; // null = simulation mode
  platformFeeRecipient: string;
  isTestnet: boolean;
  avgBlockTimeMs: number;
}

export type SupportedChainId = 8453 | 84532;

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function envOrDefault(key: string, fallback: string): string {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Chain configs
// ---------------------------------------------------------------------------

export const BASE_MAINNET: ChainConfig = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: envOrDefault(
    'BASE_RPC_URL',
    'https://mainnet.base.org',
  ),
  blockExplorerUrl: 'https://basescan.org',
  bbaiTokenAddress: envOrDefault('BBAI_TOKEN_ADDRESS', '') || null,
  platformFeeRecipient: envOrDefault(
    'BBAI_PLATFORM_WALLET',
    '0x0000000000000000000000000000000000000000',
  ),
  isTestnet: false,
  avgBlockTimeMs: 2000,
};

export const BASE_SEPOLIA: ChainConfig = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrl: envOrDefault(
    'BASE_SEPOLIA_RPC_URL',
    'https://sepolia.base.org',
  ),
  blockExplorerUrl: 'https://sepolia.basescan.org',
  bbaiTokenAddress: envOrDefault('BBAI_TOKEN_ADDRESS_TESTNET', '') || null,
  platformFeeRecipient: envOrDefault(
    'BBAI_PLATFORM_WALLET_TESTNET',
    '0x0000000000000000000000000000000000000000',
  ),
  isTestnet: true,
  avgBlockTimeMs: 2000,
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const CHAIN_MAP: Record<SupportedChainId, ChainConfig> = {
  8453: BASE_MAINNET,
  84532: BASE_SEPOLIA,
};

/**
 * Get chain configuration by chainId.
 * Defaults to Base Sepolia if the environment variable USE_TESTNET is truthy,
 * otherwise defaults to Base mainnet.
 */
export function getChainConfig(chainId?: SupportedChainId): ChainConfig {
  if (chainId && CHAIN_MAP[chainId]) {
    return CHAIN_MAP[chainId];
  }
  const useTestnet = envOrDefault('USE_TESTNET', 'true') === 'true';
  return useTestnet ? BASE_SEPOLIA : BASE_MAINNET;
}

/**
 * Returns true when the contract address is configured and we should
 * attempt real on-chain calls.  Returns false when we should use the
 * simulation / mock path.
 */
export function isOnChainEnabled(chainId?: SupportedChainId): boolean {
  const config = getChainConfig(chainId);
  return config.bbaiTokenAddress !== null;
}

// ---------------------------------------------------------------------------
// Token metadata
// ---------------------------------------------------------------------------

export const BBAI_TOKEN = {
  name: 'BoredBrain AI',
  symbol: 'BBAI',
  decimals: 18,
} as const;

/**
 * Convert a human-readable token amount to the smallest unit (wei-equivalent).
 * e.g. 1.5 BBAI -> 1500000000000000000n
 */
export function toTokenUnits(amount: number): bigint {
  // Avoid floating point issues by splitting integer & fractional parts
  const [intPart, fracPart = ''] = amount.toString().split('.');
  const paddedFrac = fracPart.padEnd(BBAI_TOKEN.decimals, '0').slice(0, BBAI_TOKEN.decimals);
  return BigInt(intPart + paddedFrac);
}

/**
 * Convert from smallest unit back to a human-readable number.
 */
export function fromTokenUnits(raw: bigint): number {
  const str = raw.toString().padStart(BBAI_TOKEN.decimals + 1, '0');
  const intPart = str.slice(0, str.length - BBAI_TOKEN.decimals) || '0';
  const fracPart = str.slice(str.length - BBAI_TOKEN.decimals);
  return parseFloat(`${intPart}.${fracPart}`);
}
