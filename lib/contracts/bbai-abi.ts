/**
 * BBAI ABI - Custom Staking & Payment Functions (Legacy/Future)
 *
 * Standard ERC-20 interface plus custom extensions for the BoredBrain AI
 * platform: tool fee payments with automatic 85/15 split, and staking
 * for agent registration.
 *
 * Contract: BBAI on Base (L2) — Legacy/Future
 */

export const BBAI_TOKEN_ABI = [
  // -------------------------------------------------------------------------
  // ERC-20 Standard: Read
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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

  // -------------------------------------------------------------------------
  // ERC-20 Standard: Write
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
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
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },

  // -------------------------------------------------------------------------
  // Custom: Tool Fee Payment (85/15 split handled on-chain)
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'payToolFee',
    inputs: [
      { name: 'provider', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'toolId', type: 'bytes32' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },

  // -------------------------------------------------------------------------
  // Custom: Staking for Agent Registration
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'stakeBBAI',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unstakeBBAI',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getStakeInfo',
    inputs: [{ name: 'staker', type: 'address' }],
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'stakedAt', type: 'uint256' },
      { name: 'lockUntil', type: 'uint256' },
      { name: 'isLocked', type: 'bool' },
    ],
    stateMutability: 'view',
  },

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ToolFeePaid',
    inputs: [
      { name: 'payer', type: 'address', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'platformFee', type: 'uint256', indexed: false },
      { name: 'toolId', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Staked',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'lockUntil', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Unstaked',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// ABI helper: encode function selector (first 4 bytes of keccak256)
// ---------------------------------------------------------------------------

/**
 * Minimal keccak256 is not available without a dependency, so we use a
 * pre-computed lookup of function selectors for the functions we call via
 * raw RPC.  These are the first 4 bytes of keccak256("<signature>").
 */
export const FUNCTION_SELECTORS = {
  // ERC-20
  balanceOf: '0x70a08231',       // balanceOf(address)
  transfer: '0xa9059cbb',       // transfer(address,uint256)
  approve: '0x095ea7b3',        // approve(address,uint256)
  allowance: '0xdd62ed3e',      // allowance(address,address)
  totalSupply: '0x18160ddd',    // totalSupply()
  decimals: '0x313ce567',       // decimals()

  // Custom
  payToolFee: '0x8f6b2784',     // payToolFee(address,uint256,bytes32)
  stakeBBAI: '0xa694fc3a',      // stakeBBAI(uint256)  -- matches stake(uint256)
  unstakeBBAI: '0x2def6620',    // unstakeBBAI()       -- matches unstake()
  getStakeInfo: '0x3e491d47',   // getStakeInfo(address)
} as const;

export type BBAIFunctionName = keyof typeof FUNCTION_SELECTORS;
