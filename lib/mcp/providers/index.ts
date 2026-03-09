// ---------------------------------------------------------------------------
// MCP Provider Registry
// Maps ExternalIntegration IDs to MCP connection configurations.
// Each entry defines how to connect to the provider's MCP server,
// what environment variables are required, and a static tool fallback.
// ---------------------------------------------------------------------------

import type { MCPConnectionConfig, MCPToolDefinition } from '../client';

// ---------------------------------------------------------------------------
// Provider connection configs
// ---------------------------------------------------------------------------

export const MCP_PROVIDER_CONFIGS: Record<string, MCPConnectionConfig> = {
  'bnb-chain-mcp': {
    providerId: 'bnb-chain-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@bnb-chain/mcp'],
    requiredEnvVars: ['BNB_RPC_URL'],
    env: {
      BNB_RPC_URL: process.env.BNB_RPC_URL ?? 'https://bsc-dataseed.binance.org/',
      BNB_PRIVATE_KEY: process.env.BNB_PRIVATE_KEY ?? '',
    },
    timeout: 30_000,
  },

  'goat-sdk': {
    providerId: 'goat-sdk',
    transport: 'http',
    url: process.env.GOAT_SDK_MCP_URL ?? 'http://localhost:3100/mcp',
    requiredEnvVars: [],
    headers: {
      Authorization: `Bearer ${process.env.GOAT_SDK_API_KEY ?? ''}`,
    },
    timeout: 45_000,
  },

  'solana-agent-kit': {
    providerId: 'solana-agent-kit',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'solana-agent-kit', 'mcp'],
    requiredEnvVars: ['SOLANA_RPC_URL'],
    env: {
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
      SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY ?? '',
    },
    timeout: 30_000,
  },

  'web3-mcp': {
    providerId: 'web3-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/web3-mcp-server'],
    requiredEnvVars: [],
    env: {
      ETH_RPC_URL: process.env.ETH_RPC_URL ?? '',
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? '',
      PRIVATE_KEY: process.env.WEB3_MCP_PRIVATE_KEY ?? '',
    },
    timeout: 30_000,
  },

  'evm-mcp-server': {
    providerId: 'evm-mcp-server',
    transport: 'sse',
    url: process.env.EVM_MCP_SERVER_URL ?? 'http://localhost:3101/sse',
    requiredEnvVars: [],
    headers: {
      Authorization: `Bearer ${process.env.EVM_MCP_API_KEY ?? ''}`,
    },
    timeout: 30_000,
  },

  'tatum-blockchain-mcp': {
    providerId: 'tatum-blockchain-mcp',
    transport: 'http',
    url: process.env.TATUM_MCP_URL ?? 'https://mcp.tatum.io/v1',
    requiredEnvVars: ['TATUM_API_KEY'],
    headers: {
      'x-api-key': process.env.TATUM_API_KEY ?? '',
    },
    timeout: 30_000,
  },

  'armor-crypto-mcp': {
    providerId: 'armor-crypto-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'armor-crypto-mcp'],
    requiredEnvVars: ['SOLANA_RPC_URL'],
    env: {
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
      ARMOR_WALLET_KEY: process.env.ARMOR_WALLET_KEY ?? '',
    },
    timeout: 30_000,
  },

  'agoragentic': {
    providerId: 'agoragentic',
    transport: 'http',
    url: process.env.AGORAGENTIC_MCP_URL ?? 'https://api.agoragentic.io/mcp',
    requiredEnvVars: [],
    headers: {
      Authorization: `Bearer ${process.env.AGORAGENTIC_API_KEY ?? ''}`,
    },
    timeout: 30_000,
  },

  'hyperliquid-mcp': {
    providerId: 'hyperliquid-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'hyperliquid-mcp-server'],
    requiredEnvVars: ['HYPERLIQUID_PRIVATE_KEY'],
    env: {
      HYPERLIQUID_PRIVATE_KEY: process.env.HYPERLIQUID_PRIVATE_KEY ?? '',
      HYPERLIQUID_TESTNET: process.env.HYPERLIQUID_TESTNET ?? 'false',
    },
    timeout: 30_000,
  },

  'dexpaprika-mcp': {
    providerId: 'dexpaprika-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@coinpaprika/dexpaprika-mcp'],
    requiredEnvVars: [],
    env: {
      DEXPAPRIKA_API_KEY: process.env.DEXPAPRIKA_API_KEY ?? '',
    },
    timeout: 30_000,
  },

  'free-crypto-news': {
    providerId: 'free-crypto-news',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'free-crypto-news'],
    requiredEnvVars: [],
    env: {},
    timeout: 20_000,
  },

  'memos-mcp': {
    providerId: 'memos-mcp',
    transport: 'http',
    url: process.env.MEMOS_MCP_URL ?? 'http://localhost:8484/mcp',
    requiredEnvVars: [],
    headers: {
      Authorization: `Bearer ${process.env.MEMOS_API_KEY ?? ''}`,
    },
    timeout: 15_000,
  },

  'lightning-mcp': {
    providerId: 'lightning-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'lightning-mcp'],
    requiredEnvVars: ['LND_REST_URL', 'LND_MACAROON'],
    env: {
      LND_REST_URL: process.env.LND_REST_URL ?? '',
      LND_MACAROON: process.env.LND_MACAROON ?? '',
      LND_TLS_CERT: process.env.LND_TLS_CERT ?? '',
    },
    timeout: 20_000,
  },

  'base-usdc-transfer': {
    providerId: 'base-usdc-transfer',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-free-usdc-transfer'],
    requiredEnvVars: ['BASE_PRIVATE_KEY'],
    env: {
      BASE_PRIVATE_KEY: process.env.BASE_PRIVATE_KEY ?? '',
      BASE_RPC_URL: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
    },
    timeout: 30_000,
  },

  'marinade-finance-mcp': {
    providerId: 'marinade-finance-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'marinade-finance-mcp-server'],
    requiredEnvVars: ['SOLANA_RPC_URL'],
    env: {
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
      SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY ?? '',
    },
    timeout: 30_000,
  },

  'solana-mcp': {
    providerId: 'solana-mcp',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@sendaifun/solana-mcp'],
    requiredEnvVars: ['SOLANA_RPC_URL'],
    env: {
      SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
      SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY ?? '',
    },
    timeout: 30_000,
  },
};

// ---------------------------------------------------------------------------
// Static tool fallbacks - used when the MCP server is unreachable
// ---------------------------------------------------------------------------

export const STATIC_TOOL_LISTS: Record<string, MCPToolDefinition[]> = {
  'bnb-chain-mcp': [
    { name: 'queryBlockNumber', description: 'Get the current block number on BNB Chain' },
    { name: 'queryTransaction', description: 'Look up a transaction by hash on BNB Chain' },
    { name: 'queryBalance', description: 'Query BNB or BEP-20 token balance for an address' },
    { name: 'transferBNB', description: 'Send BNB to a recipient address' },
    { name: 'transferBEP20', description: 'Transfer BEP-20 tokens on BNB Chain' },
    { name: 'deployBEP20', description: 'Deploy a new BEP-20 token contract' },
    { name: 'mintNFT', description: 'Mint an NFT on BNB Chain' },
    { name: 'queryNFTMetadata', description: 'Fetch metadata for an NFT on BNB Chain' },
    { name: 'registerAgent', description: 'Register an autonomous agent via ERC-8004' },
    { name: 'resolveAgentAddress', description: 'Resolve an agent name to its on-chain address' },
    { name: 'greenfieldUpload', description: 'Upload a file to Greenfield decentralized storage' },
    { name: 'greenfieldDownload', description: 'Download a file from Greenfield storage' },
    { name: 'greenfieldCreateBucket', description: 'Create a new storage bucket on Greenfield' },
    { name: 'walletCreate', description: 'Create a new BNB Chain wallet' },
    { name: 'walletImport', description: 'Import a wallet from private key or mnemonic' },
    { name: 'estimateGas', description: 'Estimate gas cost for a transaction on BNB Chain' },
  ],

  'goat-sdk': [
    { name: 'swap', description: 'Swap tokens via aggregated DEX routing' },
    { name: 'addLiquidity', description: 'Add liquidity to a DEX pool' },
    { name: 'removeLiquidity', description: 'Remove liquidity from a DEX pool' },
    { name: 'stake', description: 'Stake tokens in a protocol' },
    { name: 'unstake', description: 'Unstake tokens from a protocol' },
    { name: 'claimRewards', description: 'Claim staking or farming rewards' },
    { name: 'bridge', description: 'Bridge assets between chains' },
    { name: 'sendPayment', description: 'Send a token payment' },
    { name: 'batchTransfer', description: 'Send tokens to multiple recipients' },
    { name: 'deployToken', description: 'Deploy a new token contract' },
    { name: 'wrapToken', description: 'Wrap a native token (e.g. ETH to WETH)' },
    { name: 'unwrapToken', description: 'Unwrap a wrapped token' },
    { name: 'farmYield', description: 'Enter a yield farming position' },
    { name: 'harvestYield', description: 'Harvest yield farming rewards' },
    { name: 'placePrediction', description: 'Place a prediction on a market' },
    { name: 'resolvePrediction', description: 'Resolve a prediction market outcome' },
    { name: 'tokenizeAsset', description: 'Tokenize a real-world asset' },
    { name: 'fractionalize', description: 'Fractionalize a tokenized asset' },
    { name: 'getPrice', description: 'Get the current price of a token' },
    { name: 'getPoolInfo', description: 'Get pool information for a DEX pair' },
    { name: 'getAPY', description: 'Get current APY for a staking/farming position' },
    { name: 'getPortfolioValue', description: 'Get the total portfolio value for a wallet' },
    { name: 'approveSpender', description: 'Approve a spender for token transfers' },
    { name: 'revokeApproval', description: 'Revoke token spending approval' },
  ],

  'solana-agent-kit': [
    { name: 'transferSOL', description: 'Transfer SOL to a recipient' },
    { name: 'transferSPL', description: 'Transfer SPL tokens' },
    { name: 'deploySPLToken', description: 'Deploy a new SPL token' },
    { name: 'mintSPLToken', description: 'Mint SPL tokens to an address' },
    { name: 'burnSPLToken', description: 'Burn SPL tokens' },
    { name: 'createTokenAccount', description: 'Create an associated token account' },
    { name: 'mintNFT', description: 'Mint a Metaplex NFT on Solana' },
    { name: 'mintCompressedNFT', description: 'Mint a compressed NFT on Solana' },
    { name: 'listNFT', description: 'List an NFT for sale on a marketplace' },
    { name: 'cancelNFTListing', description: 'Cancel an NFT marketplace listing' },
    { name: 'buyNFT', description: 'Purchase an NFT from a marketplace' },
    { name: 'jupiterSwap', description: 'Swap tokens via Jupiter aggregator' },
    { name: 'jupiterLimitOrder', description: 'Place a limit order on Jupiter' },
    { name: 'jupiterDCA', description: 'Set up a DCA order on Jupiter' },
    { name: 'raydiumAddLiquidity', description: 'Add liquidity to a Raydium pool' },
    { name: 'raydiumRemoveLiquidity', description: 'Remove liquidity from Raydium' },
    { name: 'raydiumSwap', description: 'Swap tokens on Raydium AMM' },
    { name: 'orcaOpenPosition', description: 'Open a concentrated liquidity position on Orca' },
    { name: 'orcaClosePosition', description: 'Close an Orca liquidity position' },
    { name: 'orcaSwap', description: 'Swap tokens on Orca DEX' },
    { name: 'driftOpenPerp', description: 'Open a perpetual position on Drift' },
    { name: 'driftClosePerp', description: 'Close a Drift perpetual position' },
    { name: 'driftPlaceOrder', description: 'Place an order on Drift Protocol' },
    { name: 'driftCancelOrder', description: 'Cancel an order on Drift Protocol' },
    { name: 'stakeSOL', description: 'Stake SOL with a validator' },
    { name: 'unstakeSOL', description: 'Unstake SOL from a validator' },
    { name: 'requestAirdrop', description: 'Request SOL airdrop (devnet only)' },
    { name: 'getBalance', description: 'Get SOL balance for an address' },
    { name: 'getTokenAccounts', description: 'List all token accounts for a wallet' },
    { name: 'getTransactionHistory', description: 'Get transaction history for an address' },
    { name: 'registerDomain', description: 'Register a .sol domain name' },
    { name: 'resolveDomain', description: 'Resolve a .sol domain to an address' },
  ],

  'web3-mcp': [
    { name: 'getBalance', description: 'Get native token balance across chains' },
    { name: 'getTokenBalance', description: 'Get ERC-20/SPL token balance' },
    { name: 'transferNative', description: 'Transfer native tokens on any supported chain' },
    { name: 'transferERC20', description: 'Transfer ERC-20 tokens' },
    { name: 'jupiterSwap', description: 'Execute a Jupiter swap on Solana' },
    { name: 'jupiterQuote', description: 'Get a swap quote from Jupiter' },
    { name: 'thorchainSwap', description: 'Execute a cross-chain swap via THORChain' },
    { name: 'thorchainQuote', description: 'Get a cross-chain swap quote from THORChain' },
    { name: 'getTransactionStatus', description: 'Check status of a submitted transaction' },
    { name: 'resolveENS', description: 'Resolve an ENS name to an address' },
    { name: 'getGasPrice', description: 'Get current gas price for a chain' },
  ],

  'evm-mcp-server': [
    { name: 'getBalance', description: 'Get native balance on any EVM chain' },
    { name: 'getTokenBalance', description: 'Get ERC-20 token balance' },
    { name: 'transferETH', description: 'Transfer ETH or native token' },
    { name: 'transferERC20', description: 'Transfer ERC-20 tokens' },
    { name: 'transferERC721', description: 'Transfer an ERC-721 NFT' },
    { name: 'transferERC1155', description: 'Transfer ERC-1155 tokens' },
    { name: 'approveERC20', description: 'Approve ERC-20 spending' },
    { name: 'callContract', description: 'Call a smart contract function (write)' },
    { name: 'readContract', description: 'Read from a smart contract (view/pure)' },
    { name: 'deployContract', description: 'Deploy a smart contract to an EVM chain' },
    { name: 'getTransactionReceipt', description: 'Get receipt for a mined transaction' },
    { name: 'getBlockByNumber', description: 'Get block details by block number' },
    { name: 'estimateGas', description: 'Estimate gas for a transaction' },
    { name: 'getGasPrice', description: 'Get current gas price' },
    { name: 'resolveENS', description: 'Resolve ENS name to address' },
    { name: 'lookupENS', description: 'Reverse-lookup address to ENS name' },
    { name: 'signMessage', description: 'Sign a message with the connected wallet' },
    { name: 'signTransaction', description: 'Sign a transaction without broadcasting' },
    { name: 'getTokenMetadata', description: 'Get ERC-20 token metadata (name, symbol, decimals)' },
    { name: 'getNFTMetadata', description: 'Get NFT metadata and attributes' },
    { name: 'getContractABI', description: 'Auto-detect and fetch contract ABI' },
    { name: 'watchContractEvent', description: 'Subscribe to smart contract events' },
  ],

  'tatum-blockchain-mcp': [
    { name: 'getBlock', description: 'Get block details from any supported chain' },
    { name: 'getTransaction', description: 'Fetch transaction details by hash' },
    { name: 'getBalance', description: 'Get native balance for an address' },
    { name: 'getTokenBalances', description: 'Get all token balances for a wallet' },
    { name: 'getNFTMetadata', description: 'Fetch NFT metadata and attributes' },
    { name: 'getNFTsByWallet', description: 'List all NFTs owned by a wallet' },
    { name: 'getWalletPortfolio', description: 'Aggregate wallet portfolio value' },
    { name: 'getAddressReputation', description: 'Get risk and reputation score for an address' },
    { name: 'getTokenPrice', description: 'Get current token price in USD' },
    { name: 'getExchangeRate', description: 'Get exchange rate between token pairs' },
    { name: 'getTransactionsByAddress', description: 'List recent transactions for an address' },
    { name: 'subscribeToAddress', description: 'Set up webhook notifications for an address' },
    { name: 'broadcastTransaction', description: 'Broadcast a signed transaction to the network' },
    { name: 'estimateFee', description: 'Estimate transaction fee on a chain' },
  ],

  'armor-crypto-mcp': [
    { name: 'swapToken', description: 'Swap Solana tokens with routing' },
    { name: 'getSwapQuote', description: 'Get a swap quote for Solana tokens' },
    { name: 'placeLimitOrder', description: 'Place a limit order on Solana' },
    { name: 'cancelLimitOrder', description: 'Cancel an active limit order' },
    { name: 'getLimitOrders', description: 'List active limit orders' },
    { name: 'createDCAOrder', description: 'Create a dollar-cost-averaging order' },
    { name: 'cancelDCAOrder', description: 'Cancel a DCA order' },
    { name: 'getDCAOrders', description: 'List active DCA orders' },
    { name: 'stakeSOL', description: 'Stake SOL for yield' },
    { name: 'unstakeSOL', description: 'Unstake SOL' },
    { name: 'getStakingInfo', description: 'Get staking position details' },
    { name: 'createWallet', description: 'Create a new Solana wallet' },
    { name: 'importWallet', description: 'Import a wallet from private key' },
    { name: 'getWalletBalance', description: 'Get wallet SOL and token balances' },
    { name: 'getTokenAccounts', description: 'List token accounts for a wallet' },
    { name: 'discoverTrending', description: 'Discover trending Solana tokens' },
    { name: 'getTokenInfo', description: 'Get detailed token information' },
    { name: 'getTokenPrice', description: 'Get current token price' },
  ],

  'agoragentic': [
    { name: 'publishIntent', description: 'Publish a task intent to the marketplace' },
    { name: 'discoverAgents', description: 'Discover agents that can fulfill a task' },
    { name: 'requestTask', description: 'Request task execution from an agent' },
    { name: 'submitResult', description: 'Submit a completed task result' },
    { name: 'settlePayment', description: 'Settle USDC payment for a completed task' },
    { name: 'getMarketplaceListings', description: 'Browse marketplace task listings' },
    { name: 'registerAgent', description: 'Register an agent on the marketplace' },
    { name: 'updateAgentProfile', description: 'Update agent profile and capabilities' },
    { name: 'rateAgent', description: 'Rate an agent after task completion' },
    { name: 'getAgentReputation', description: 'Get reputation score for an agent' },
    { name: 'createEscrow', description: 'Create a payment escrow for a task' },
    { name: 'releaseEscrow', description: 'Release escrow payment to the provider' },
  ],

  'hyperliquid-mcp': [
    { name: 'placeOrder', description: 'Place a perpetual futures order on Hyperliquid' },
    { name: 'cancelOrder', description: 'Cancel an open order on Hyperliquid' },
    { name: 'cancelAllOrders', description: 'Cancel all open orders for a market' },
    { name: 'getOpenOrders', description: 'List all open orders on Hyperliquid' },
    { name: 'getPositions', description: 'Get all open perpetual positions' },
    { name: 'closePosition', description: 'Close a perpetual futures position' },
    { name: 'setLeverage', description: 'Set leverage for a trading pair' },
    { name: 'getAccountInfo', description: 'Get Hyperliquid account summary and margins' },
    { name: 'getFundingRates', description: 'Get current funding rates for perpetual markets' },
    { name: 'getOrderbook', description: 'Get real-time orderbook for a market' },
    { name: 'getMarketInfo', description: 'Get market metadata and trading parameters' },
    { name: 'getTradeHistory', description: 'Get recent trade history for an account' },
    { name: 'getTicker', description: 'Get 24h ticker data for a market' },
    { name: 'withdrawUSDC', description: 'Withdraw USDC from Hyperliquid to Arbitrum' },
    { name: 'getBalances', description: 'Get account balances on Hyperliquid' },
  ],

  'dexpaprika-mcp': [
    { name: 'getNetworks', description: 'List all supported blockchain networks' },
    { name: 'getTopDexes', description: 'Get top DEXes ranked by volume on a network' },
    { name: 'getPoolsByDex', description: 'List liquidity pools for a specific DEX' },
    { name: 'searchPools', description: 'Search for pools by token pair or name' },
    { name: 'getPoolDetails', description: 'Get detailed pool information and metrics' },
    { name: 'getPoolOHLCV', description: 'Get OHLCV candlestick data for a pool' },
    { name: 'getPoolTransactions', description: 'Get recent swap transactions for a pool' },
    { name: 'getTokenDetails', description: 'Get token metadata and market information' },
    { name: 'getTokenPools', description: 'List all pools containing a specific token' },
    { name: 'getTopPools', description: 'Get top pools by volume across all DEXes' },
    { name: 'getTopMovers', description: 'Get tokens with the largest price movements' },
    { name: 'getTokenPrice', description: 'Get current token price from DEX data' },
  ],

  'free-crypto-news': [
    { name: 'getLatestNews', description: 'Fetch the latest crypto news headlines' },
    { name: 'searchNews', description: 'Search crypto news articles by keyword' },
    { name: 'getSentiment', description: 'Get sentiment score for a token or topic' },
    { name: 'getTrendingTopics', description: 'Get currently trending crypto topics' },
    { name: 'getNewsByToken', description: 'Get news articles for a specific token' },
    { name: 'getNewsByCategory', description: 'Get news filtered by category (DeFi, NFT, etc.)' },
    { name: 'getSourceCredibility', description: 'Get credibility rating for a news source' },
    { name: 'getSentimentTimeline', description: 'Get historical sentiment data over time' },
  ],

  'memos-mcp': [
    { name: 'storeMemory', description: 'Store a new memory entry for the agent' },
    { name: 'recallMemory', description: 'Recall a specific memory by ID or key' },
    { name: 'searchMemories', description: 'Semantic search across stored memories' },
    { name: 'deleteMemory', description: 'Delete a memory entry by ID' },
    { name: 'updateMemory', description: 'Update an existing memory entry' },
    { name: 'getMemoryGraph', description: 'Get the relationship graph of stored memories' },
    { name: 'createMemoryCollection', description: 'Create a new memory collection namespace' },
    { name: 'listCollections', description: 'List all memory collections' },
    { name: 'getSessionContext', description: 'Get aggregated context for the current session' },
    { name: 'mergeMemories', description: 'Merge duplicate or related memories' },
  ],

  'lightning-mcp': [
    { name: 'createInvoice', description: 'Create a Lightning Network BOLT11 invoice' },
    { name: 'payInvoice', description: 'Pay a Lightning Network invoice' },
    { name: 'getBalance', description: 'Get Lightning node channel and on-chain balance' },
    { name: 'getChannels', description: 'List active Lightning payment channels' },
    { name: 'decodeInvoice', description: 'Decode a BOLT11 invoice to view details' },
    { name: 'getPaymentStatus', description: 'Check the status of a Lightning payment' },
  ],

  'base-usdc-transfer': [
    { name: 'transferUSDC', description: 'Transfer USDC to a recipient on Base' },
    { name: 'batchTransferUSDC', description: 'Send USDC to multiple recipients on Base' },
    { name: 'getUSDCBalance', description: 'Get USDC balance for an address on Base' },
    { name: 'getTransactionStatus', description: 'Check status of a USDC transfer on Base' },
  ],

  'marinade-finance-mcp': [
    { name: 'stakeSOL', description: 'Stake SOL via Marinade to receive mSOL' },
    { name: 'unstakeSOL', description: 'Unstake mSOL back to SOL via Marinade' },
    { name: 'getStakeInfo', description: 'Get current Marinade staking position details' },
    { name: 'getmSOLBalance', description: 'Get mSOL balance for a wallet' },
    { name: 'getValidators', description: 'List Marinade validator set and performance' },
    { name: 'getRewards', description: 'Get accumulated staking rewards' },
    { name: 'convertNativeStake', description: 'Convert native stake account to Marinade' },
    { name: 'getAPY', description: 'Get current Marinade staking APY' },
  ],

  'solana-mcp': [
    { name: 'getBalance', description: 'Get SOL balance for an address' },
    { name: 'getTokenBalance', description: 'Get SPL token balance for an address' },
    { name: 'transferSOL', description: 'Transfer SOL to a recipient' },
    { name: 'transferSPL', description: 'Transfer SPL tokens to a recipient' },
    { name: 'getTransaction', description: 'Get transaction details by signature' },
    { name: 'getBlock', description: 'Get block details by slot number' },
    { name: 'getAccountInfo', description: 'Get account info for a Solana address' },
    { name: 'getTokenAccounts', description: 'List all token accounts for a wallet' },
    { name: 'createToken', description: 'Create a new SPL token mint' },
    { name: 'mintToken', description: 'Mint SPL tokens to an address' },
    { name: 'burnToken', description: 'Burn SPL tokens from an account' },
    { name: 'freezeAccount', description: 'Freeze a token account' },
    { name: 'thawAccount', description: 'Thaw a frozen token account' },
    { name: 'mintNFT', description: 'Mint an NFT on Solana via Metaplex' },
    { name: 'getSignaturesForAddress', description: 'Get recent transaction signatures for an address' },
    { name: 'simulateTransaction', description: 'Simulate a transaction without sending' },
    { name: 'sendTransaction', description: 'Send a signed transaction to the network' },
    { name: 'getProgramAccounts', description: 'Get all accounts owned by a program' },
    { name: 'getSlot', description: 'Get the current slot number' },
    { name: 'getEpochInfo', description: 'Get current epoch information' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the MCP connection config for a provider ID.
 * Returns undefined if the provider is not registered.
 */
export function getProviderConfig(providerId: string): MCPConnectionConfig | undefined {
  return MCP_PROVIDER_CONFIGS[providerId];
}

/**
 * Get the static tool list fallback for a provider.
 */
export function getStaticToolList(providerId: string): MCPToolDefinition[] {
  return STATIC_TOOL_LISTS[providerId] ?? [];
}

/**
 * Check whether a provider has all required env vars set.
 */
export function isProviderConfigured(providerId: string): boolean {
  const config = MCP_PROVIDER_CONFIGS[providerId];
  if (!config) return false;
  for (const key of config.requiredEnvVars ?? []) {
    if (!process.env[key]) return false;
  }
  return true;
}

/**
 * List all registered provider IDs.
 */
export function getAllProviderIds(): string[] {
  return Object.keys(MCP_PROVIDER_CONFIGS);
}

/**
 * Get a summary of provider status (configured vs not).
 */
export function getProviderStatus(): Array<{
  providerId: string;
  transport: string;
  configured: boolean;
  missingEnvVars: string[];
}> {
  return Object.entries(MCP_PROVIDER_CONFIGS).map(([id, config]) => {
    const missing = (config.requiredEnvVars ?? []).filter((key) => !process.env[key]);
    return {
      providerId: id,
      transport: config.transport,
      configured: missing.length === 0,
      missingEnvVars: missing,
    };
  });
}
