// External Blockchain/Crypto MCP Integration Registry
// Defines connectable MCP servers and skill providers for the BoredBrain AI agent platform

export interface ExternalIntegration {
  id: string;
  name: string;
  description: string;
  repo: string;
  stars: number;
  npm?: string;
  chains: string[];
  tools: string[];
  toolCount: number;
  category: 'defi' | 'blockchain' | 'trading' | 'marketplace' | 'storage' | 'multi-chain';
  status: 'available' | 'coming_soon' | 'beta';
  logo?: string;
  features: string[];
  pricing: 'free' | 'freemium' | 'paid';
  compatibility: ('mcp' | 'a2a' | 'sdk' | 'rest')[];
}

export const EXTERNAL_INTEGRATIONS: ExternalIntegration[] = [
  {
    id: 'bnb-chain-mcp',
    name: 'BNB Chain MCP',
    description:
      'Official BNB Chain MCP server providing blockchain queries, token and NFT operations, wallet management, ERC-8004 autonomous agent registration, and Greenfield decentralized storage access.',
    repo: 'bnb-chain/bnbchain-skills',
    stars: 0,
    npm: '@bnb-chain/mcp',
    chains: ['BNB Chain', 'BSC', 'opBNB', 'Greenfield'],
    tools: [
      'queryBlockNumber',
      'queryTransaction',
      'queryBalance',
      'transferBNB',
      'transferBEP20',
      'deployBEP20',
      'mintNFT',
      'queryNFTMetadata',
      'registerAgent',
      'resolveAgentAddress',
      'greenfieldUpload',
      'greenfieldDownload',
      'greenfieldCreateBucket',
      'walletCreate',
      'walletImport',
      'estimateGas',
    ],
    toolCount: 16,
    category: 'blockchain',
    status: 'available',
    logo: '🟡',
    features: [
      'Full BNB Chain ecosystem access',
      'ERC-8004 autonomous agent registration',
      'Greenfield decentralized storage integration',
      'BEP-20 and BEP-721 token operations',
      'opBNB L2 support for low-cost transactions',
      'Wallet creation and management',
    ],
    pricing: 'free',
    compatibility: ['mcp', 'sdk'],
  },
  {
    id: 'goat-sdk',
    name: 'GOAT SDK',
    description:
      'Multi-chain agentic finance toolkit with 200+ DeFi tools spanning payments, swaps, yield farming, prediction markets, and real-world asset tokenization across all major blockchain ecosystems.',
    repo: 'goat-sdk/goat',
    stars: 965,
    chains: [
      'Ethereum',
      'Polygon',
      'Arbitrum',
      'Optimism',
      'Base',
      'Avalanche',
      'Solana',
      'Aptos',
      'Cosmos',
      'Starknet',
      'BNB Chain',
      'Fantom',
      'Celo',
      'Gnosis',
    ],
    tools: [
      'swap',
      'addLiquidity',
      'removeLiquidity',
      'stake',
      'unstake',
      'claimRewards',
      'bridge',
      'sendPayment',
      'batchTransfer',
      'deployToken',
      'wrapToken',
      'unwrapToken',
      'farmYield',
      'harvestYield',
      'placePrediction',
      'resolvePrediction',
      'tokenizeAsset',
      'fractionalize',
      'getPrice',
      'getPoolInfo',
      'getAPY',
      'getPortfolioValue',
      'approveSpender',
      'revokeApproval',
    ],
    toolCount: 200,
    category: 'defi',
    status: 'available',
    logo: '🐐',
    features: [
      '200+ DeFi tools across major protocols',
      'Multi-chain support spanning EVM, Solana, Aptos, Cosmos, and Starknet',
      'Agentic payments and batch transfers',
      'DEX aggregation and swap routing',
      'Yield farming and staking automation',
      'Prediction market integration',
      'Real-world asset tokenization',
      'Plugin architecture for custom tool extensions',
    ],
    pricing: 'free',
    compatibility: ['mcp', 'sdk', 'rest'],
  },
  {
    id: 'solana-agent-kit',
    name: 'Solana Agent Kit',
    description:
      'Comprehensive Solana action toolkit with 60+ on-chain operations including SPL token management, NFT minting, Jupiter DEX swaps, Raydium and Orca liquidity, and Drift perpetual trading.',
    repo: 'sendaifun/solana-agent-kit',
    stars: 1600,
    chains: ['Solana'],
    tools: [
      'transferSOL',
      'transferSPL',
      'deploySPLToken',
      'mintSPLToken',
      'burnSPLToken',
      'createTokenAccount',
      'mintNFT',
      'mintCompressedNFT',
      'listNFT',
      'cancelNFTListing',
      'buyNFT',
      'jupiterSwap',
      'jupiterLimitOrder',
      'jupiterDCA',
      'raydiumAddLiquidity',
      'raydiumRemoveLiquidity',
      'raydiumSwap',
      'orcaOpenPosition',
      'orcaClosePosition',
      'orcaSwap',
      'driftOpenPerp',
      'driftClosePerp',
      'driftPlaceOrder',
      'driftCancelOrder',
      'stakeSOL',
      'unstakeSOL',
      'requestAirdrop',
      'getBalance',
      'getTokenAccounts',
      'getTransactionHistory',
      'registerDomain',
      'resolveDomain',
    ],
    toolCount: 60,
    category: 'defi',
    status: 'available',
    logo: '☀️',
    features: [
      '60+ native Solana actions',
      'SPL token creation, minting, and transfers',
      'NFT minting including compressed NFTs',
      'Jupiter aggregator swaps, limit orders, and DCA',
      'Raydium AMM liquidity management',
      'Orca concentrated liquidity positions',
      'Drift Protocol perpetual futures trading',
      'SOL staking and domain name registration',
    ],
    pricing: 'free',
    compatibility: ['mcp', 'sdk'],
  },
  {
    id: 'web3-mcp',
    name: 'Web3 MCP',
    description:
      'Multi-chain Web3 MCP server supporting 11 blockchains with balance queries, native and token transfers, Jupiter swaps on Solana, and THORChain cross-chain swaps.',
    repo: 'strangelove-ventures/web3-mcp',
    stars: 93,
    chains: [
      'Solana',
      'Ethereum',
      'Base',
      'Arbitrum',
      'Optimism',
      'Polygon',
      'Avalanche',
      'Bitcoin',
      'TON',
      'XRP',
      'Cosmos',
    ],
    tools: [
      'getBalance',
      'getTokenBalance',
      'transferNative',
      'transferERC20',
      'jupiterSwap',
      'jupiterQuote',
      'thorchainSwap',
      'thorchainQuote',
      'getTransactionStatus',
      'resolveENS',
      'getGasPrice',
    ],
    toolCount: 11,
    category: 'multi-chain',
    status: 'available',
    logo: '🌐',
    features: [
      '11 blockchain networks supported',
      'Unified balance and transfer interface',
      'Jupiter DEX swaps on Solana',
      'THORChain cross-chain swaps',
      'ERC-20 token transfer support',
      'ENS name resolution',
      'Bitcoin and non-EVM chain support',
    ],
    pricing: 'free',
    compatibility: ['mcp'],
  },
  {
    id: 'evm-mcp-server',
    name: 'EVM MCP Server',
    description:
      'Comprehensive EVM MCP server supporting 60+ EVM-compatible chains with 22 tools for smart contract interaction, token operations, ENS resolution, and transaction signing.',
    repo: 'mcpdotdirect/evm-mcp-server',
    stars: 367,
    chains: [
      'Ethereum',
      'Polygon',
      'Arbitrum',
      'Optimism',
      'Base',
      'Avalanche',
      'BNB Chain',
      'Fantom',
      'Gnosis',
      'Celo',
      'Cronos',
      'zkSync',
      'Linea',
      'Scroll',
      'Mantle',
      'Blast',
      'Mode',
      'Moonbeam',
      'Aurora',
      'Metis',
    ],
    tools: [
      'getBalance',
      'getTokenBalance',
      'transferETH',
      'transferERC20',
      'transferERC721',
      'transferERC1155',
      'approveERC20',
      'callContract',
      'readContract',
      'deployContract',
      'getTransactionReceipt',
      'getBlockByNumber',
      'estimateGas',
      'getGasPrice',
      'resolveENS',
      'lookupENS',
      'signMessage',
      'signTransaction',
      'getTokenMetadata',
      'getNFTMetadata',
      'getContractABI',
      'watchContractEvent',
    ],
    toolCount: 22,
    category: 'blockchain',
    status: 'available',
    logo: '⛓️',
    features: [
      '60+ EVM-compatible chains',
      '22 blockchain interaction tools',
      'Smart contract read, write, and deployment',
      'ERC-20, ERC-721, and ERC-1155 token operations',
      'ENS name resolution and reverse lookup',
      'Transaction signing and gas estimation',
      'Contract event monitoring',
      'ABI auto-detection',
    ],
    pricing: 'free',
    compatibility: ['mcp'],
  },
  {
    id: 'tatum-blockchain-mcp',
    name: 'Tatum Blockchain MCP',
    description:
      'Enterprise-grade blockchain data API and RPC gateway covering 130+ networks with tools for block and transaction queries, NFT metadata, wallet portfolios, and address reputation scoring.',
    repo: 'tatumio/blockchain-mcp',
    stars: 14,
    chains: [
      'Ethereum',
      'Polygon',
      'BNB Chain',
      'Solana',
      'Bitcoin',
      'Litecoin',
      'Dogecoin',
      'XRP',
      'Tron',
      'Cardano',
      'Avalanche',
      'Arbitrum',
      'Optimism',
      'Base',
      'Fantom',
      'Celo',
      'Cronos',
      'Algorand',
      'Stellar',
      'Near',
    ],
    tools: [
      'getBlock',
      'getTransaction',
      'getBalance',
      'getTokenBalances',
      'getNFTMetadata',
      'getNFTsByWallet',
      'getWalletPortfolio',
      'getAddressReputation',
      'getTokenPrice',
      'getExchangeRate',
      'getTransactionsByAddress',
      'subscribeToAddress',
      'broadcastTransaction',
      'estimateFee',
    ],
    toolCount: 14,
    category: 'blockchain',
    status: 'available',
    logo: '📊',
    features: [
      '130+ blockchain networks supported',
      'Unified blockchain data API',
      'RPC gateway for direct node access',
      'NFT metadata and ownership queries',
      'Wallet portfolio aggregation',
      'Address reputation and risk scoring',
      'Real-time address subscription webhooks',
      'Fee estimation across chains',
    ],
    pricing: 'freemium',
    compatibility: ['mcp', 'rest'],
  },
  {
    id: 'armor-crypto-mcp',
    name: 'Armor Crypto MCP',
    description:
      'Solana-focused trading MCP server with swap execution, DCA order scheduling, limit order placement, SOL staking, wallet management, and trending token discovery.',
    repo: 'armorwallet/armor-crypto-mcp',
    stars: 191,
    chains: ['Solana'],
    tools: [
      'swapToken',
      'getSwapQuote',
      'placeLimitOrder',
      'cancelLimitOrder',
      'getLimitOrders',
      'createDCAOrder',
      'cancelDCAOrder',
      'getDCAOrders',
      'stakeSOL',
      'unstakeSOL',
      'getStakingInfo',
      'createWallet',
      'importWallet',
      'getWalletBalance',
      'getTokenAccounts',
      'discoverTrending',
      'getTokenInfo',
      'getTokenPrice',
    ],
    toolCount: 18,
    category: 'trading',
    status: 'available',
    logo: '🛡️',
    features: [
      'Solana token swaps with routing',
      'DCA order scheduling and management',
      'Limit order placement and tracking',
      'SOL native staking',
      'Wallet creation and import',
      'Trending token discovery and analysis',
      'Real-time token price feeds',
      'Portfolio balance tracking',
    ],
    pricing: 'free',
    compatibility: ['mcp'],
  },
  {
    id: 'agoragentic',
    name: 'Agoragentic',
    description:
      'Agent-to-agent marketplace enabling autonomous task routing and execution with USDC settlement on Base L2. Supports intent-based discovery and multi-framework agent interoperability.',
    repo: 'rhein1/agoragentic-integrations',
    stars: 6,
    chains: ['Base'],
    tools: [
      'publishIntent',
      'discoverAgents',
      'requestTask',
      'submitResult',
      'settlePayment',
      'getMarketplaceListings',
      'registerAgent',
      'updateAgentProfile',
      'rateAgent',
      'getAgentReputation',
      'createEscrow',
      'releaseEscrow',
    ],
    toolCount: 12,
    category: 'marketplace',
    status: 'beta',
    logo: '🏛️',
    features: [
      'Agent-to-agent task marketplace',
      'Intent-based task routing and discovery',
      'USDC settlement on Base L2',
      'Multi-framework agent support',
      'Escrow-based payment security',
      'Agent reputation and rating system',
      'Autonomous task negotiation',
      'Cross-framework interoperability',
    ],
    pricing: 'freemium',
    compatibility: ['mcp', 'a2a', 'rest'],
  },
];

/**
 * Returns all integrations that support a given blockchain.
 * Case-insensitive matching is used.
 */
export function getIntegrationsByChain(chain: string): ExternalIntegration[] {
  const normalized = chain.toLowerCase();
  return EXTERNAL_INTEGRATIONS.filter((integration) =>
    integration.chains.some((c) => c.toLowerCase() === normalized)
  );
}

/**
 * Returns all integrations matching the given category.
 */
export function getIntegrationsByCategory(
  category: ExternalIntegration['category']
): ExternalIntegration[] {
  return EXTERNAL_INTEGRATIONS.filter((integration) => integration.category === category);
}

/**
 * Returns a deduplicated, sorted list of all chains across every integration.
 */
export function getAllChains(): string[] {
  const chainSet = new Set<string>();
  for (const integration of EXTERNAL_INTEGRATIONS) {
    for (const chain of integration.chains) {
      chainSet.add(chain);
    }
  }
  return Array.from(chainSet).sort();
}

/**
 * Finds a single integration by its unique ID, or undefined if not found.
 */
export function getIntegrationById(id: string): ExternalIntegration | undefined {
  return EXTERNAL_INTEGRATIONS.find((integration) => integration.id === id);
}
