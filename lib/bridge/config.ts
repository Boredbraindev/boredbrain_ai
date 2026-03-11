/**
 * Cross-Chain Bridge Configuration for BBAI (Legacy/Future)
 *
 * Defines supported chains, bridge protocol endpoints, and token addresses
 * for cross-chain BBAI transfers via LayerZero or Wormhole.
 *
 * All contract addresses are placeholders until deployment.
 * When addresses are not configured, the bridge service operates in
 * simulation mode.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BridgeChainId = 'base' | 'bsc' | 'arbitrum' | 'apechain';
export type BridgeProvider = 'layerzero' | 'wormhole';

export interface BridgeChainConfig {
  chainId: number;
  name: string;
  slug: BridgeChainId;
  rpcUrl: string;
  blockExplorerUrl: string;
  bbaiTokenAddress: string | null;
  /** LayerZero v2 endpoint contract */
  layerZeroEndpoint: string | null;
  /** LayerZero v2 endpoint ID (chain-specific) */
  layerZeroEid: number;
  /** Wormhole core bridge contract */
  wormholeBridge: string | null;
  /** Wormhole chain ID */
  wormholeChainId: number;
  /** Average block time in ms -- used for ETA estimates */
  avgBlockTimeMs: number;
  /** Estimated native gas cost for a bridge tx in USD */
  estimatedGasCostUsd: number;
}

export interface BridgeRoute {
  from: BridgeChainId;
  to: BridgeChainId;
  providers: BridgeProvider[];
  estimatedTimeMinutes: number;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function envOrDefault(key: string, fallback: string): string {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }
  return fallback;
}

function envOrNull(key: string): string | null {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Chain Configurations
// ---------------------------------------------------------------------------

export const BRIDGE_CHAINS: Record<BridgeChainId, BridgeChainConfig> = {
  base: {
    chainId: 8453,
    name: 'Base',
    slug: 'base',
    rpcUrl: envOrDefault('BASE_RPC_URL', 'https://mainnet.base.org'),
    blockExplorerUrl: 'https://basescan.org',
    bbaiTokenAddress: envOrNull('BBAI_TOKEN_BASE') ?? envOrNull('BBAI_TOKEN_ADDRESS'),
    layerZeroEndpoint: envOrNull('LAYERZERO_ENDPOINT_BASE') ?? '0x1a44076050125825900e736c501f859c50fE728c',
    layerZeroEid: 30184,
    wormholeBridge: envOrNull('WORMHOLE_BRIDGE_BASE') ?? '0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8239',
    wormholeChainId: 30,
    avgBlockTimeMs: 2000,
    estimatedGasCostUsd: 0.02,
  },

  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    slug: 'bsc',
    rpcUrl: envOrDefault('BSC_RPC_URL', 'https://bsc-dataseed1.binance.org'),
    blockExplorerUrl: 'https://bscscan.com',
    bbaiTokenAddress: envOrNull('BBAI_TOKEN_BSC'),
    layerZeroEndpoint: envOrNull('LAYERZERO_ENDPOINT_BSC') ?? '0x1a44076050125825900e736c501f859c50fE728c',
    layerZeroEid: 30102,
    wormholeBridge: envOrNull('WORMHOLE_BRIDGE_BSC') ?? '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
    wormholeChainId: 4,
    avgBlockTimeMs: 3000,
    estimatedGasCostUsd: 0.05,
  },

  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    slug: 'arbitrum',
    rpcUrl: envOrDefault('ARBITRUM_RPC_URL', 'https://arb1.arbitrum.io/rpc'),
    blockExplorerUrl: 'https://arbiscan.io',
    bbaiTokenAddress: envOrNull('BBAI_TOKEN_ARBITRUM'),
    layerZeroEndpoint: envOrNull('LAYERZERO_ENDPOINT_ARBITRUM') ?? '0x1a44076050125825900e736c501f859c50fE728c',
    layerZeroEid: 30110,
    wormholeBridge: envOrNull('WORMHOLE_BRIDGE_ARBITRUM') ?? '0xa5f208e072434bC67592E4C49C1B991BA79BCA46',
    wormholeChainId: 23,
    avgBlockTimeMs: 250,
    estimatedGasCostUsd: 0.01,
  },

  apechain: {
    chainId: 33139,
    name: 'ApeChain',
    slug: 'apechain',
    rpcUrl: envOrDefault('APECHAIN_RPC_URL', 'https://rpc.apechain.com'),
    blockExplorerUrl: 'https://apescan.io',
    bbaiTokenAddress: envOrNull('BBAI_TOKEN_APECHAIN'),
    layerZeroEndpoint: envOrNull('LAYERZERO_ENDPOINT_APECHAIN') ?? '0x1a44076050125825900e736c501f859c50fE728c',
    layerZeroEid: 33139,
    wormholeBridge: envOrNull('WORMHOLE_BRIDGE_APECHAIN'),
    wormholeChainId: 33139,
    avgBlockTimeMs: 1000,
    estimatedGasCostUsd: 0.03,
  },
};

// ---------------------------------------------------------------------------
// Supported Routes
// ---------------------------------------------------------------------------

/**
 * All supported bridge routes.
 * Each route specifies which providers can service it and the estimated time.
 */
export const BRIDGE_ROUTES: BridgeRoute[] = [
  // Base <-> BSC
  { from: 'base', to: 'bsc', providers: ['layerzero', 'wormhole'], estimatedTimeMinutes: 15, enabled: true },
  { from: 'bsc', to: 'base', providers: ['layerzero', 'wormhole'], estimatedTimeMinutes: 15, enabled: true },
  // Base <-> Arbitrum
  { from: 'base', to: 'arbitrum', providers: ['layerzero', 'wormhole'], estimatedTimeMinutes: 10, enabled: true },
  { from: 'arbitrum', to: 'base', providers: ['layerzero', 'wormhole'], estimatedTimeMinutes: 10, enabled: true },
  // Base <-> ApeChain
  { from: 'base', to: 'apechain', providers: ['layerzero'], estimatedTimeMinutes: 12, enabled: true },
  { from: 'apechain', to: 'base', providers: ['layerzero'], estimatedTimeMinutes: 12, enabled: true },
  // BSC <-> Arbitrum
  { from: 'bsc', to: 'arbitrum', providers: ['layerzero', 'wormhole'], estimatedTimeMinutes: 15, enabled: true },
  { from: 'arbitrum', to: 'bsc', providers: ['layerzero', 'wormhole'], estimatedTimeMinutes: 15, enabled: true },
  // BSC <-> ApeChain
  { from: 'bsc', to: 'apechain', providers: ['layerzero'], estimatedTimeMinutes: 18, enabled: true },
  { from: 'apechain', to: 'bsc', providers: ['layerzero'], estimatedTimeMinutes: 18, enabled: true },
  // Arbitrum <-> ApeChain
  { from: 'arbitrum', to: 'apechain', providers: ['layerzero'], estimatedTimeMinutes: 12, enabled: true },
  { from: 'apechain', to: 'arbitrum', providers: ['layerzero'], estimatedTimeMinutes: 12, enabled: true },
];

// ---------------------------------------------------------------------------
// Protocol fee config
// ---------------------------------------------------------------------------

/** Platform bridge fee in basis points (0.1% = 10 bps) */
export const BRIDGE_PLATFORM_FEE_BPS = 10;

/** Default bridge provider when none specified */
export const DEFAULT_BRIDGE_PROVIDER: BridgeProvider = envOrDefault(
  'DEFAULT_BRIDGE_PROVIDER',
  'layerzero',
) as BridgeProvider;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get chain config by slug. Throws if the chain slug is not recognised.
 */
export function getBridgeChainConfig(chain: BridgeChainId): BridgeChainConfig {
  const cfg = BRIDGE_CHAINS[chain];
  if (!cfg) {
    throw new Error(`Unsupported bridge chain: ${chain}`);
  }
  return cfg;
}

/**
 * Find a bridge route between two chains.
 * Returns null if no enabled route exists.
 */
export function findBridgeRoute(from: BridgeChainId, to: BridgeChainId): BridgeRoute | null {
  return BRIDGE_ROUTES.find((r) => r.from === from && r.to === to && r.enabled) ?? null;
}

/**
 * Returns true if bridge contracts are configured for a given chain.
 * When false, the bridge service should use simulation mode.
 */
export function isBridgeOnChainEnabled(chain: BridgeChainId): boolean {
  const cfg = BRIDGE_CHAINS[chain];
  return cfg?.bbaiTokenAddress !== null && cfg?.bbaiTokenAddress !== undefined;
}

/**
 * Returns true when both the source and destination chains have on-chain
 * bridge contracts configured.
 */
export function isBridgeRouteOnChain(from: BridgeChainId, to: BridgeChainId): boolean {
  return isBridgeOnChainEnabled(from) && isBridgeOnChainEnabled(to);
}

/**
 * All supported chain slugs.
 */
export const SUPPORTED_CHAINS: BridgeChainId[] = ['base', 'bsc', 'arbitrum', 'apechain'];
