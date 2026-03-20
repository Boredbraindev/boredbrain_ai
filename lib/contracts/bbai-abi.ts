/**
 * BBToken ABI — BSC Mainnet
 *
 * Contract: 0x6a95F2C04c6C614fD84DBB127a1d0d15f439fA81
 *
 * Standard ERC-20 + platform fee (85/15 split via chargePlatformFee),
 * agent staking (100 BBAI / 30-day lock), trade fees, pause, mint/burn.
 *
 * Token supply starts at 0 — owner calls mint() at TGE.
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
  // Platform Fee (15%) — authorized callers only
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'chargePlatformFee',
    inputs: [
      { name: 'payer', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // -------------------------------------------------------------------------
  // Staking for Agent Registration (100 BBAI, 30-day lock)
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'stakeForAgent',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unstakeFromAgent',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isStakeLocked',
    inputs: [
      { name: 'staker', type: 'address' },
      { name: 'agentId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUnlockTime',
    inputs: [
      { name: 'staker', type: 'address' },
      { name: 'agentId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalStaked',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // -------------------------------------------------------------------------
  // Owner: Mint / Burn
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'treasury',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_SUPPLY',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
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
    name: 'PlatformFeeCharged',
    inputs: [
      { name: 'payer', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'feeAmount', type: 'uint256', indexed: false },
      { name: 'netAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TokensStaked',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'unlockTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TokensUnstaked',
    inputs: [
      { name: 'staker', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TokensMinted',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Function selectors (first 4 bytes of keccak256 of signature)
// ---------------------------------------------------------------------------

export const FUNCTION_SELECTORS = {
  // ERC-20
  balanceOf: '0x70a08231',       // balanceOf(address)
  transfer: '0xa9059cbb',       // transfer(address,uint256)
  approve: '0x095ea7b3',        // approve(address,uint256)
  allowance: '0xdd62ed3e',      // allowance(address,address)
  totalSupply: '0x18160ddd',    // totalSupply()
  decimals: '0x313ce567',       // decimals()

  // BBToken custom
  chargePlatformFee: '0x0b4fcf87', // chargePlatformFee(address,address,uint256)
  stakeForAgent: '0x7acb7757',     // stakeForAgent(uint256)
  unstakeFromAgent: '0x2e17de78',  // unstakeFromAgent(uint256)
  isStakeLocked: '0x7e75e5e4',    // isStakeLocked(address,uint256)
  getUnlockTime: '0x19c3a3b4',   // getUnlockTime(address,uint256)
  mint: '0x40c10f19',             // mint(address,uint256)
} as const;

export type BBAIFunctionName = keyof typeof FUNCTION_SELECTORS;
