/**
 * PredictionSettlement ABI — BSC Testnet / Mainnet
 *
 * Records prediction round results on-chain.
 * Hybrid model: bets = off-chain points, settlement = on-chain proof.
 */

export const PREDICTION_SETTLEMENT_ABI = [
  // ─── Settlement ─────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'settleRound',
    inputs: [
      { name: '_roundId', type: 'uint256' },
      { name: '_asset', type: 'string' },
      { name: '_startPrice', type: 'uint256' },
      { name: '_endPrice', type: 'uint256' },
      { name: '_outcome', type: 'uint8' },  // 0=UP, 1=DOWN
      { name: '_upPool', type: 'uint256' },
      { name: '_downPool', type: 'uint256' },
      { name: '_totalBets', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ─── Views ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getRound',
    inputs: [{ name: '_roundId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'roundId', type: 'uint256' },
          { name: 'asset', type: 'string' },
          { name: 'startPrice', type: 'uint256' },
          { name: 'endPrice', type: 'uint256' },
          { name: 'outcome', type: 'uint8' },
          { name: 'upPool', type: 'uint256' },
          { name: 'downPool', type: 'uint256' },
          { name: 'totalBets', type: 'uint256' },
          { name: 'settledAt', type: 'uint256' },
          { name: 'settledBy', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRecentRounds',
    inputs: [{ name: '_count', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'roundId', type: 'uint256' },
          { name: 'asset', type: 'string' },
          { name: 'startPrice', type: 'uint256' },
          { name: 'endPrice', type: 'uint256' },
          { name: 'outcome', type: 'uint8' },
          { name: 'upPool', type: 'uint256' },
          { name: 'downPool', type: 'uint256' },
          { name: 'totalBets', type: 'uint256' },
          { name: 'settledAt', type: 'uint256' },
          { name: 'settledBy', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRoundCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalRounds',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalVolume',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
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
    name: 'operator',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },

  // ─── Admin (Ownable2Step) ────────────────────────────────────────────────
  {
    type: 'function',
    name: 'setOperator',
    inputs: [{ name: '_operator', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pendingOwner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },

  // ─── Events ─────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'RoundSettled',
    inputs: [
      { name: 'roundId', type: 'uint256', indexed: true },
      { name: 'asset', type: 'string', indexed: false },
      { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'startPrice', type: 'uint256', indexed: false },
      { name: 'endPrice', type: 'uint256', indexed: false },
      { name: 'upPool', type: 'uint256', indexed: false },
      { name: 'downPool', type: 'uint256', indexed: false },
      { name: 'totalBets', type: 'uint256', indexed: false },
      { name: 'settledAt', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OperatorUpdated',
    inputs: [
      { name: 'oldOperator', type: 'address', indexed: true },
      { name: 'newOperator', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'oldOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
] as const;

/**
 * Pre-computed function selectors for raw RPC calls.
 */
export const SETTLEMENT_SELECTORS = {
  settleRound:     '0x5c975abb', // settleRound(uint256,string,uint256,uint256,uint8,uint256,uint256,uint256)
  getRound:        '0x6c0360eb', // getRound(uint256)
  getRecentRounds: '0x2b2e05c1', // getRecentRounds(uint256)
  getRoundCount:   '0x087a4a38', // getRoundCount()
  totalRounds:     '0x8b23ff4c', // totalRounds()
  totalVolume:     '0x4b94f50e', // totalVolume()
  owner:           '0x8da5cb5b', // owner()
  operator:        '0x570ca735', // operator()
} as const;
