/**
 * Blockchain Configuration for BBAI Points / Future Token Operations
 *
 * HYBRID MODE:
 * - Betting: off-chain points (PostgreSQL)
 * - Settlement: on-chain via PredictionSettlement contract (BSC Testnet)
 * - Future: full on-chain migration (BSC Mainnet)
 *
 * Chains: Base (8453), Base Sepolia (84532), BSC (56), BSC Testnet (97)
 *
 * CURRENT STATUS (as of 2026-03):
 * ─────────────────────────────────────────────────────────────────────
 * All smart contracts are pending deployment. The platform currently
 * operates in SIMULATION MODE where on-chain interactions are mocked.
 * Contract addresses will be populated via environment variables once
 * deployed. Until then, `isSimulationMode()` returns true and all
 * settlement operations fall back to off-chain PostgreSQL logic.
 *
 * Required environment variables for production on-chain mode:
 *   BBAI_TOKEN_ADDRESS          – BBAI contract on Base (future)
 *   BBAI_PLATFORM_WALLET        – Platform fee recipient wallet
 *   SETTLEMENT_CONTRACT_BSC     – PredictionSettlement on BSC mainnet
 *   BASE_RPC_URL                – (optional) Alchemy/Infura Base RPC
 *   BSC_RPC_URL                 – (optional) Alchemy/Infura BSC RPC
 *   BASE_SEPOLIA_RPC_URL        – (optional) testnet RPC override
 *   BSC_TESTNET_RPC_URL         – (optional) testnet RPC override
 *   BBAI_TOKEN_ADDRESS_TESTNET  – testnet token address
 *   BBAI_PLATFORM_WALLET_TESTNET– testnet fee recipient
 *   SETTLEMENT_CONTRACT_BSC_TESTNET – PredictionSettlement on BSC testnet
 * ─────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Deployment Status — tracks what's deployed vs pending across chains
// ---------------------------------------------------------------------------

export const DEPLOYMENT_STATUS = {
  network: 'bsc-mainnet-v2',
  bbaiToken: { status: 'deployed', chain: 'bsc', address: '0x6a95F2C04c6C614fD84DBB127a1d0d15f439fA81', note: 'Supply 0 — mint at TGE' },
  agentRegistry: { status: 'deployed', chain: 'bsc', address: '0x587D11190AD4920CEE02e81fb98d285d5F66238d', note: 'ERC-721 agent NFT registry' },
  agentRegistry8004: { status: 'deployed', chain: 'bsc', address: '0x618a8D664EFDa1d49997ceA6DC0EBAE845b1E231', note: 'ERC-8004 agent registry' },
  predictionSettlement: { status: 'deployed', chain: 'bsc', address: '0x0ae8A0cE8A34155508F4C47b41B20A668A0a5600', note: 'On-chain settlement' },
  paymentRouter: { status: 'deployed', chain: 'bsc', address: '0x799f8ceA23DfaAe796113Fa12D975EB11Ea3bEa0', note: '85/15 split router' },
  bondingCurve: { status: 'deployed', chain: 'bsc', address: '0x0273FDbe5fc34C874AC1EE938EDC55b5cC4e360d', note: 'Agent token trading' },
  agentStaking: { status: 'deployed', chain: 'bsc', address: '0xd157d4A0030a1Ea220EB85257740d345C21C62E7', note: 'NFT-tier staking' },
  bbClawSubscription: { status: 'deployed', chain: 'bsc', address: '0x8D7f7349e9e81c28fad6155d7F6969C382abc326', note: '10 USDT/30d Pro' },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  bbaiTokenAddress: string | null; // null = simulation mode (points-only)
  platformFeeRecipient: string;
  isTestnet: boolean;
  avgBlockTimeMs: number;
}

export interface SettlementChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  settlementContract: string | null; // null = not yet deployed
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
// RPC Endpoints
// ---------------------------------------------------------------------------
// Public fallback RPCs are provided for each chain. For production use,
// set the corresponding env var to an Alchemy / Infura / QuickNode
// endpoint for higher rate limits and reliability.
//
//   BASE_RPC_URL          → default: https://mainnet.base.org
//   BASE_SEPOLIA_RPC_URL  → default: https://sepolia.base.org
//   BSC_RPC_URL           → default: https://bsc-dataseed1.binance.org
//   BSC_TESTNET_RPC_URL   → default: https://data-seed-prebsc-1-s1.binance.org:8545
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Chain configs — Base (BBAI token chain)
// ---------------------------------------------------------------------------

export const BASE_MAINNET: ChainConfig = {
  chainId: 8453,
  name: 'Base',
  // Falls back to public Base RPC; set BASE_RPC_URL for Alchemy/Infura
  rpcUrl: envOrDefault(
    'BASE_RPC_URL',
    'https://mainnet.base.org',
  ),
  blockExplorerUrl: 'https://basescan.org',
  // No on-chain contract deployed yet (points-only mode)
  bbaiTokenAddress: envOrDefault('BBAI_TOKEN_ADDRESS', '') || null,
  // Set BBAI_PLATFORM_WALLET once multisig is created
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
// BSC Settlement chains — PredictionSettlement contract
// ---------------------------------------------------------------------------

export const BSC_MAINNET: SettlementChainConfig = {
  chainId: 56,
  name: 'BNB Smart Chain',
  // Falls back to public BSC RPC; set BSC_RPC_URL for production endpoint
  rpcUrl: envOrDefault('BSC_RPC_URL', 'https://bsc-dataseed1.binance.org'),
  blockExplorerUrl: 'https://bscscan.com',
  settlementContract: envOrDefault('SETTLEMENT_CONTRACT_BSC', '0x0ae8A0cE8A34155508F4C47b41B20A668A0a5600'),
  isTestnet: false,
  avgBlockTimeMs: 3000,
};

export const BSC_TESTNET: SettlementChainConfig = {
  chainId: 97,
  name: 'BSC Testnet',
  rpcUrl: envOrDefault('BSC_TESTNET_RPC_URL', 'https://data-seed-prebsc-1-s1.binance.org:8545'),
  blockExplorerUrl: 'https://testnet.bscscan.com',
  // Testnet-ready: deploy via `npx hardhat run contracts/scripts/deploy-settlement.ts --network bscTestnet`
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
 * Defaults to BSC Testnet.
 */
export function getSettlementChainConfig(chainId?: SettlementChainId): SettlementChainConfig {
  if (chainId && SETTLEMENT_CHAIN_MAP[chainId]) {
    return SETTLEMENT_CHAIN_MAP[chainId];
  }
  return BSC_TESTNET; // default to testnet
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
// Simulation Mode
// ---------------------------------------------------------------------------

/**
 * Returns true when the platform is running in simulation mode.
 *
 * Simulation mode is active when:
 *   - No BBAI contract is deployed
 *   - No settlement contract is configured
 *   - Platform fee recipient is the zero address
 *
 * In simulation mode, all transfers, staking, and settlement
 * operations are handled off-chain via PostgreSQL mock balances.
 * This is the expected state while operating in points-only mode.
 */
export function isSimulationMode(): boolean {
  const chain = getChainConfig();
  const settlement = getSettlementChainConfig();

  const noToken = chain.bbaiTokenAddress === null;
  const noSettlement = settlement.settlementContract === null;
  const zeroFeeRecipient =
    chain.platformFeeRecipient === '0x0000000000000000000000000000000000000000';

  // Simulation if any critical contract is missing
  return noToken || noSettlement || zeroFeeRecipient;
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
