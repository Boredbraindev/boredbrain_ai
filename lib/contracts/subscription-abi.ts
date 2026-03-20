/**
 * BBClawSubscription ABI — BSC Mainnet
 *
 * Pro subscription: 10 USDT (BEP-20) for 30-day access.
 * Deploy via Hardhat then update SUBSCRIPTION_CONTRACT_ADDRESS below.
 */

// ── Contract address (update after deployment) ─────────────────────────────
// Set to null until contract is deployed — UI will show "coming soon" state
export const SUBSCRIPTION_CONTRACT_ADDRESS: `0x${string}` | null =
  '0x8D7f7349e9e81c28fad6155d7F6969C382abc326';

/** Returns true when the subscription contract is deployed and ready */
export function isContractDeployed(): boolean {
  return SUBSCRIPTION_CONTRACT_ADDRESS !== null &&
    SUBSCRIPTION_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

// ── BSC USDT (BEP-20) ──────────────────────────────────────────────────────
export const BSC_USDT_ADDRESS =
  '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`;

// ── ERC-20 approve ABI (minimal) ────────────────────────────────────────────
export const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ── BBClawSubscription ABI ──────────────────────────────────────────────────
export const SUBSCRIPTION_ABI = [
  // ─── Subscribe ──────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'subscribe',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ─── Views ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'isActive',
    inputs: [{ name: '_subscriber', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'expiresAt',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'SUBSCRIPTION_PRICE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // ─── Owner-only ─────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'withdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ─── Events ─────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'Subscribed',
    inputs: [
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'expiry', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
