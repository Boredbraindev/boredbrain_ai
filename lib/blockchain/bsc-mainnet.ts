/**
 * BSC Mainnet Constants for Agent Registration, Pro Subscription & Settlement
 *
 * This module provides BSC Mainnet-specific constants and helpers
 * for the three onchain functions:
 *   1. Agent Registration — signed message (EIP-712 style)
 *   2. Pro Subscription — $10 USDT payment verification
 *   3. Settlement — debate result recording
 *
 * Uses the existing chain config from ./config.ts for RPC/explorer settings.
 * No heavy dependencies — raw fetch() JSON-RPC only.
 */

import { BSC_MAINNET as BSC_MAINNET_CONFIG } from './config';

// ---------------------------------------------------------------------------
// BSC Mainnet token addresses
// ---------------------------------------------------------------------------

/** BSC-pegged USDT (BEP-20) — 18 decimals on BSC */
export const BSC_USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

/** Native BNB placeholder address */
export const BSC_BNB_ADDRESS = '0x0000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Platform wallet
// ---------------------------------------------------------------------------

/** Wallet that receives subscription payments and platform fees */
export const PLATFORM_WALLET = (
  process.env.BSC_PLATFORM_WALLET || '0x0000000000000000000000000000000000000000'
).toLowerCase();

// ---------------------------------------------------------------------------
// Subscription pricing
// ---------------------------------------------------------------------------

/** Pro subscription price: 10 USDT (18 decimals on BSC) */
export const PRO_SUBSCRIPTION_PRICE_RAW = '10000000000000000000'; // 10 * 10^18
export const PRO_SUBSCRIPTION_PRICE_USD = 10;

/** Minimum acceptable payment (9.9 USDT to allow for rounding) */
export const PRO_SUBSCRIPTION_MIN_RAW = '9900000000000000000'; // 9.9 * 10^18

// ---------------------------------------------------------------------------
// Gas estimates
// ---------------------------------------------------------------------------

/** Approximate BNB needed for a registration signature tx (informational) */
export const REGISTRATION_GAS_ESTIMATE = '0.001'; // ~$0.60

// ---------------------------------------------------------------------------
// ERC-20 Transfer event signature (for USDT log parsing)
// ---------------------------------------------------------------------------

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_EVENT_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ---------------------------------------------------------------------------
// Re-export chain config for convenience
// ---------------------------------------------------------------------------

export const BSC_MAINNET = {
  chainId: BSC_MAINNET_CONFIG.chainId,
  name: BSC_MAINNET_CONFIG.name,
  rpc: BSC_MAINNET_CONFIG.rpcUrl,
  explorer: BSC_MAINNET_CONFIG.blockExplorerUrl,
  usdt: BSC_USDT_ADDRESS,
  bnb: BSC_BNB_ADDRESS,
} as const;
