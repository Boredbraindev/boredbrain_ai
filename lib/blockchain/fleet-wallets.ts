/**
 * Fleet Wallet System — Real EVM Addresses for OpenClaw Agent Army
 *
 * Architecture:
 * - BBAI Points: off-chain (PostgreSQL agent_wallet table)
 * - BSC Wallets: real EVM addresses derived from a master HD seed
 *
 * Uses BIP-44 HD derivation: m/44'/60'/0'/0/{index}
 * - One master mnemonic (FLEET_MASTER_MNEMONIC env var) generates all agent wallets
 * - Deterministic: same seed always produces same addresses
 * - BSC uses same address format as Ethereum (EVM-compatible)
 *
 * Currently: addresses are generated and displayed (no funds)
 * Future: fund these addresses with BBAI for real on-chain operations
 */

import { mnemonicToAccount } from 'viem/accounts';
import { english, generateMnemonic } from 'viem/accounts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FleetWallet {
  index: number;
  address: string;
  derivationPath: string;
}

// ---------------------------------------------------------------------------
// Master seed management
// ---------------------------------------------------------------------------

/**
 * Get or generate the fleet master mnemonic.
 * In production, this MUST be set via FLEET_MASTER_MNEMONIC env var.
 * For demo/dev, a deterministic fallback is used.
 */
function getMasterMnemonic(): string {
  const envMnemonic = process.env.FLEET_MASTER_MNEMONIC;
  if (envMnemonic && envMnemonic.split(' ').length >= 12) {
    return envMnemonic;
  }
  // Fallback: deterministic demo mnemonic (NOT for production use)
  // This allows consistent addresses across restarts without env var
  return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
}

// ---------------------------------------------------------------------------
// Address derivation
// ---------------------------------------------------------------------------

/**
 * Derive a BSC wallet address for a fleet agent by index.
 * BIP-44: m/44'/60'/0'/0/{addressIndex}
 * BSC uses the same address space as Ethereum.
 */
export function deriveFleetAddress(index: number): FleetWallet {
  const mnemonic = getMasterMnemonic();
  const account = mnemonicToAccount(mnemonic, { addressIndex: index });

  return {
    index,
    address: account.address,
    derivationPath: `m/44'/60'/0'/0/${index}`,
  };
}

/**
 * Derive multiple fleet addresses in batch.
 */
export function deriveFleetAddresses(count: number, startIndex = 0): FleetWallet[] {
  const wallets: FleetWallet[] = [];
  for (let i = 0; i < count; i++) {
    wallets.push(deriveFleetAddress(startIndex + i));
  }
  return wallets;
}

/**
 * Get the BSC address for a specific agent by its sequential index in the fleet.
 */
export function getFleetBscAddress(agentIndex: number): string {
  return deriveFleetAddress(agentIndex).address;
}

// ---------------------------------------------------------------------------
// Fleet address cache (avoid re-deriving on every call)
// ---------------------------------------------------------------------------

const addressCache = new Map<number, string>();

/**
 * Cached version of getFleetBscAddress for performance.
 */
export function getFleetBscAddressCached(agentIndex: number): string {
  const cached = addressCache.get(agentIndex);
  if (cached) return cached;

  const address = getFleetBscAddress(agentIndex);
  addressCache.set(agentIndex, address);
  return address;
}

/**
 * Generate a new random mnemonic for fleet wallet setup.
 * Call this once to generate the FLEET_MASTER_MNEMONIC env var value.
 */
export function generateFleetMnemonic(): string {
  return generateMnemonic(english);
}
