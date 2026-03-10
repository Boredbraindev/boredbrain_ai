/**
 * Blockchain Configuration for BBAI Points / Future Token Operations
 *
 * HYBRID MODE:
 * - Betting: off-chain points (PostgreSQL)
 * - Settlement: on-chain via PredictionSettlement contract (BSC Testnet)
 * - TGE: full on-chain migration (BSC Mainnet + BBAI Token)
 *
 * Chains: Base (8453), Base Sepolia (84532), BSC (56), BSC Testnet (97)
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

export interface SettlementChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  settlementContract: string | null;
  isTestnet: boolean;
  avgBlockTimeMs: number;
}

export type SupportedChainId = 8453 | 84532;
export type SettlementChainId = 56 | 97;

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
// BSC Settlement chains
// ---------------------------------------------------------------------------

export const BSC_MAINNET: SettlementChainConfig = {
  chainId: 56,
  name: 'BNB Smart Chain',
  rpcUrl: envOrDefault('BSC_RPC_URL', 'https://bsc-dataseed1.binance.org'),
  blockExplorerUrl: 'https://bscscan.com',
  settlementContract: envOrDefault('SETTLEMENT_CONTRACT_BSC', '') || null,
  isTestnet: false,
  avgBlockTimeMs: 3000,
};

export const BSC_TESTNET: SettlementChainConfig = {
  chainId: 97,
  name: 'BSC Testnet',
  rpcUrl: envOrDefault('BSC_TESTNET_RPC_URL', 'https://data-seed-prebsc-1-s1.binance.org:8545'),
  blockExplorerUrl: 'https://testnet.bscscan.com',
  settlementContract: envOrDefault('SETTLEMENT_CONTRACT_BSC_TESTNET', '') || null,
  isTestnet: true,
  avgBlockTimeMs: 3000,
};

const SETTLEMENT_CHAIN_MAP: Record<SettlementChainId, SettlementChainConfig> = {
  56: BSC_MAINNET,
  97: BSC_TESTNET,
};

/**
 * Get settlement chain config.
 * Defaults to BSC Testnet (pre-TGE).
 */
export function getSettlementChainConfig(chainId?: SettlementChainId): SettlementChainConfig {
  if (chainId && SETTLEMENT_CHAIN_MAP[chainId]) {
    return SETTLEMENT_CHAIN_MAP[chainId];
  }
  return BSC_TESTNET; // default to testnet until TGE
}

/**
 * Returns true when PredictionSettlement contract is deployed and configured.
 */
export function isSettlementEnabled(chainId?: SettlementChainId): boolean {
  const config = getSettlementChainConfig(chainId);
  return config.settlementContract !== null;
}

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

