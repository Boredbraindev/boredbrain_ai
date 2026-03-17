/**
 * Agent Fleet Templates
 *
 * 200+ diverse agent templates across 12 specialization categories.
 * Used by the seed API to bulk-register agents on the BoredBrain platform.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentTemplate {
  name: string;
  description: string;
  specialization: string;
  tools: string[];
  stakingAmount: number;
  rating: number;
  /** Base pricing per query in BBAI */
  pricePerQuery: number;
}

// ---------------------------------------------------------------------------
// Tool pool (available tools agents can use)
// ---------------------------------------------------------------------------

const TOOLS = {
  search: ['web_search', 'academic_search', 'reddit_search', 'x_search', 'youtube_search'],
  crypto: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval', 'whale_alert'],
  nft: ['nft_retrieval', 'nft_metadata', 'nft_rarity'],
  defi: ['defi_yield', 'liquidity_pool', 'swap_router', 'bridge_aggregator'],
  code: ['code_interpreter', 'smart_contract_audit', 'github_search'],
  media: ['image_gen', 'text_to_speech', 'video_summary'],
  data: ['retrieve', 'data_analysis', 'chart_gen', 'csv_parser'],
  social: ['sentiment_analysis', 'trend_tracker', 'influencer_finder'],
  travel: ['flight_search', 'hotel_search', 'restaurant_search', 'maps'],
  finance: ['stock_data', 'forex_data', 'economic_calendar'],
};

// ---------------------------------------------------------------------------
// Helper: pick random subset
// ---------------------------------------------------------------------------

function pickTools(categories: (keyof typeof TOOLS)[], min = 2, max = 5): string[] {
  const pool = categories.flatMap((c) => TOOLS[c]);
  const unique = [...new Set(pool)];
  const count = Math.min(min + Math.floor(Math.random() * (max - min + 1)), unique.length);
  const shuffled = unique.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// Category definitions with agent generators
// ---------------------------------------------------------------------------

interface CategoryDef {
  specialization: string;
  label: string;
  agents: AgentTemplate[];
}

function makeAgents(
  specialization: string,
  names: { name: string; desc: string; toolCats: (keyof typeof TOOLS)[]; price: number }[],
): AgentTemplate[] {
  return names.map((a) => ({
    name: a.name,
    description: a.desc,
    specialization,
    tools: pickTools(a.toolCats),
    stakingAmount: 100 + Math.floor(Math.random() * 400),
    rating: 3.5 + Math.round(Math.random() * 15) / 10,
    pricePerQuery: a.price,
  }));
}

// ---------------------------------------------------------------------------
// 12 Categories × ~20 agents each = ~240 agents
// ---------------------------------------------------------------------------

const DEFI_AGENTS = makeAgents('defi', [
  { name: 'Yield Maximizer Alpha', desc: 'Scans 200+ DeFi protocols for optimal yield farming strategies with auto-compound analysis.', toolCats: ['defi', 'crypto'], price: 45 },
  { name: 'Liquidity Pool Scout', desc: 'Monitors LP opportunities across Uniswap, Curve, Balancer with impermanent loss calculations.', toolCats: ['defi', 'crypto'], price: 40 },
  { name: 'Flash Loan Detector', desc: 'Real-time monitoring of flash loan attacks and MEV extraction across EVM chains.', toolCats: ['defi', 'crypto', 'code'], price: 55 },
  { name: 'Stablecoin Monitor', desc: 'Tracks depeg risks, reserve audits, and yield spreads across major stablecoins.', toolCats: ['defi', 'crypto', 'data'], price: 35 },
  { name: 'Bridge Aggregator Pro', desc: 'Finds cheapest cross-chain bridge routes with security scoring and gas optimization.', toolCats: ['defi', 'crypto'], price: 30 },
  { name: 'Lending Rate Optimizer', desc: 'Compares lending/borrowing rates across Aave, Compound, Morpho, and Spark.', toolCats: ['defi', 'data'], price: 35 },
  { name: 'DEX Volume Tracker', desc: 'Monitors decentralized exchange volumes, whale trades, and liquidity depth.', toolCats: ['defi', 'crypto'], price: 40 },
  { name: 'Restaking Analyzer', desc: 'Analyzes EigenLayer and restaking protocol risks, rewards, and operator performance.', toolCats: ['defi', 'crypto', 'data'], price: 50 },
  { name: 'Token Launch Scanner', desc: 'Screens new token launches for rug pull indicators, contract safety, and team analysis.', toolCats: ['defi', 'crypto', 'code'], price: 45 },
  { name: 'Gas Optimizer Bot', desc: 'Predicts optimal gas timing and batches transactions for maximum savings.', toolCats: ['defi', 'data'], price: 25 },
  { name: 'Vault Strategy Curator', desc: 'Curates and ranks automated vault strategies across Yearn, Beefy, and Convex.', toolCats: ['defi', 'crypto'], price: 40 },
  { name: 'Perp DEX Analyst', desc: 'Analyzes perpetual DEX funding rates, open interest, and liquidation cascades.', toolCats: ['defi', 'crypto', 'data'], price: 45 },
  { name: 'RWA Tokenizer Scout', desc: 'Tracks real-world asset tokenization projects and yield opportunities.', toolCats: ['defi', 'finance', 'data'], price: 50 },
  { name: 'MEV Protection Agent', desc: 'Routes transactions through private mempools to avoid sandwich attacks.', toolCats: ['defi', 'crypto'], price: 35 },
  { name: 'Cross-Chain Yield', desc: 'Identifies best yields across Ethereum, Arbitrum, Base, Solana, and Polygon.', toolCats: ['defi', 'crypto'], price: 40 },
  { name: 'DeFi Risk Scorer', desc: 'Scores DeFi protocols on smart contract risk, TVL stability, and audit history.', toolCats: ['defi', 'code', 'data'], price: 45 },
  { name: 'Airdrop Hunter Pro', desc: 'Identifies potential airdrop opportunities based on protocol activity patterns.', toolCats: ['defi', 'crypto', 'search'], price: 30 },
  { name: 'LP Position Manager', desc: 'Manages concentrated liquidity positions with auto-rebalancing signals.', toolCats: ['defi', 'crypto', 'data'], price: 50 },
]);

const TRADING_AGENTS = makeAgents('trading', [
  { name: 'Momentum Scalper', desc: 'Identifies short-term momentum plays using on-chain and technical indicators.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Whale Watcher Elite', desc: 'Tracks large wallet movements and exchange inflows/outflows for early signals.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Sentiment Trader', desc: 'Trades based on aggregated social sentiment from Twitter, Reddit, and Discord.', toolCats: ['social', 'crypto'], price: 35 },
  { name: 'Arbitrage Scanner', desc: 'Detects cross-exchange and cross-chain price discrepancies in real-time.', toolCats: ['crypto', 'defi'], price: 45 },
  { name: 'Volume Profile Bot', desc: 'Analyzes volume profiles and order book depth for support/resistance levels.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Funding Rate Arb', desc: 'Exploits funding rate differentials between perpetual exchanges.', toolCats: ['crypto', 'defi', 'data'], price: 40 },
  { name: 'News Impact Trader', desc: 'Instantly analyzes breaking news for tradeable crypto impact signals.', toolCats: ['search', 'crypto', 'social'], price: 45 },
  { name: 'Technical Analyst Pro', desc: 'Multi-timeframe technical analysis with pattern recognition and alerts.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Correlation Tracker', desc: 'Monitors BTC/altcoin correlations and identifies decoupling opportunities.', toolCats: ['crypto', 'data', 'finance'], price: 30 },
  { name: 'Options Flow Scanner', desc: 'Tracks unusual options activity on Deribit and identifies smart money positions.', toolCats: ['crypto', 'data', 'finance'], price: 50 },
  { name: 'Liquidation Hunter', desc: 'Monitors leverage positions and predicts liquidation cascade levels.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Grid Trading Bot', desc: 'Executes grid trading strategies with dynamic range adjustment.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Copy Trade Analyzer', desc: 'Identifies top-performing traders and analyzes their strategies for replication.', toolCats: ['crypto', 'data', 'social'], price: 40 },
  { name: 'Market Microstructure', desc: 'Analyzes order flow, market maker behavior, and execution quality.', toolCats: ['crypto', 'data'], price: 55 },
  { name: 'Pair Trading Agent', desc: 'Identifies mean-reverting pairs and generates statistical arbitrage signals.', toolCats: ['crypto', 'data', 'finance'], price: 45 },
  { name: 'Volatility Surface Bot', desc: 'Maps implied volatility surfaces and identifies mispriced options.', toolCats: ['crypto', 'data', 'finance'], price: 50 },
  { name: 'Smart Money Tracker', desc: 'Follows institutional and VC wallet movements for early alpha.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Exit Strategy Planner', desc: 'Calculates optimal take-profit and stop-loss levels using on-chain data.', toolCats: ['crypto', 'data'], price: 30 },
]);

const RESEARCH_AGENTS = makeAgents('research', [
  { name: 'Deep Research Pro', desc: 'Academic-grade research synthesis from papers, patents, and technical reports.', toolCats: ['search', 'data'], price: 35 },
  { name: 'Whitepaper Analyzer', desc: 'Reads and summarizes crypto whitepapers with tokenomics analysis.', toolCats: ['search', 'crypto', 'data'], price: 30 },
  { name: 'Competitive Intel', desc: 'Maps competitor landscapes with funding data, team analysis, and product comparisons.', toolCats: ['search', 'data', 'social'], price: 40 },
  { name: 'Patent Scout', desc: 'Searches patent databases for emerging technologies and innovation trends.', toolCats: ['search', 'data'], price: 35 },
  { name: 'Regulation Tracker', desc: 'Monitors global crypto regulations, compliance requirements, and legal developments.', toolCats: ['search', 'data'], price: 30 },
  { name: 'Protocol Governance', desc: 'Tracks DAO proposals, voting patterns, and governance participation metrics.', toolCats: ['search', 'crypto', 'data'], price: 35 },
  { name: 'Tokenomics Modeler', desc: 'Models token emission schedules, inflation rates, and value accrual mechanisms.', toolCats: ['crypto', 'data'], price: 45 },
  { name: 'Market Structure Report', desc: 'Produces weekly market structure reports with macro and micro analysis.', toolCats: ['crypto', 'data', 'finance'], price: 40 },
  { name: 'L2 Ecosystem Mapper', desc: 'Maps Layer 2 ecosystems, TVL flows, and developer activity across rollups.', toolCats: ['crypto', 'data', 'search'], price: 35 },
  { name: 'VC Deal Tracker', desc: 'Monitors venture capital deals, valuations, and investment thesis patterns.', toolCats: ['search', 'data', 'finance'], price: 40 },
  { name: 'On-Chain Forensics', desc: 'Traces transaction flows, identifies wallet clusters, and flags suspicious activity.', toolCats: ['crypto', 'data'], price: 50 },
  { name: 'Macro Economic Bot', desc: 'Analyzes macro indicators, central bank policies, and their crypto market impact.', toolCats: ['finance', 'data', 'search'], price: 35 },
  { name: 'Developer Activity', desc: 'Tracks GitHub commits, developer count, and code quality across crypto projects.', toolCats: ['code', 'data', 'search'], price: 30 },
  { name: 'Narrative Tracker', desc: 'Identifies emerging crypto narratives and sector rotation patterns.', toolCats: ['social', 'search', 'data'], price: 35 },
  { name: 'Cross-Chain Data', desc: 'Aggregates and normalizes data across 50+ blockchain networks.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'AI x Crypto Scout', desc: 'Tracks intersection of AI and crypto projects, compute networks, and AI tokens.', toolCats: ['search', 'crypto', 'data'], price: 35 },
  { name: 'Supply Chain Analyst', desc: 'Analyzes blockchain supply chain solutions and enterprise adoption metrics.', toolCats: ['search', 'data'], price: 30 },
]);

const SECURITY_AGENTS = makeAgents('security', [
  { name: 'Smart Contract Auditor', desc: 'Automated vulnerability scanning for Solidity, Vyper, and Rust smart contracts.', toolCats: ['code', 'crypto'], price: 55 },
  { name: 'Exploit Detector', desc: 'Real-time monitoring of exploit attempts across DeFi protocols and bridges.', toolCats: ['crypto', 'code', 'search'], price: 50 },
  { name: 'Phishing Guard', desc: 'Identifies phishing domains, fake tokens, and social engineering attacks.', toolCats: ['search', 'social', 'code'], price: 35 },
  { name: 'Rug Pull Screener', desc: 'Analyzes contract permissions, ownership, and liquidity locks for rug pull risk.', toolCats: ['code', 'crypto'], price: 40 },
  { name: 'MEV Watchdog', desc: 'Monitors for MEV attacks, sandwich bots, and front-running on user transactions.', toolCats: ['crypto', 'code'], price: 45 },
  { name: 'Wallet Security Score', desc: 'Scores wallet security based on approval history, interaction patterns, and exposure.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Bridge Security Monitor', desc: 'Audits cross-chain bridge security, validator sets, and collateral reserves.', toolCats: ['crypto', 'code', 'data'], price: 50 },
  { name: 'Oracle Integrity Check', desc: 'Validates price oracle reliability, manipulation resistance, and update frequency.', toolCats: ['crypto', 'code', 'data'], price: 45 },
  { name: 'Dependency Analyzer', desc: 'Scans project dependencies for known vulnerabilities and supply chain risks.', toolCats: ['code', 'search'], price: 35 },
  { name: 'Access Control Auditor', desc: 'Reviews smart contract access control patterns and privilege escalation risks.', toolCats: ['code', 'crypto'], price: 50 },
  { name: 'Incident Response Bot', desc: 'Automated incident response for detected exploits with alert routing.', toolCats: ['crypto', 'code', 'social'], price: 55 },
  { name: 'Privacy Leak Detector', desc: 'Identifies privacy leaks in transaction patterns and metadata exposure.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Governance Attack Monitor', desc: 'Detects flash loan governance attacks and malicious proposal patterns.', toolCats: ['crypto', 'code', 'defi'], price: 50 },
  { name: 'Token Approval Scanner', desc: 'Scans and flags risky token approvals with revocation recommendations.', toolCats: ['crypto', 'code'], price: 25 },
  { name: 'DNS Hijack Monitor', desc: 'Monitors DeFi frontend DNS records for potential hijacking attempts.', toolCats: ['search', 'code'], price: 40 },
]);

const NFT_AGENTS = makeAgents('nft', [
  { name: 'NFT Rarity Ranker', desc: 'Calculates rarity scores across traits using statistical and information-theoretic methods.', toolCats: ['nft', 'data'], price: 30 },
  { name: 'Floor Price Tracker', desc: 'Monitors floor prices, listings, and sales velocity across top NFT collections.', toolCats: ['nft', 'crypto'], price: 25 },
  { name: 'Whale NFT Tracker', desc: 'Follows NFT whale wallets and their accumulation/distribution patterns.', toolCats: ['nft', 'crypto'], price: 35 },
  { name: 'Mint Sniper Scout', desc: 'Identifies upcoming NFT mints with whitelist opportunities and team analysis.', toolCats: ['nft', 'search', 'social'], price: 30 },
  { name: 'Art Market Analyst', desc: 'Analyzes digital art market trends, artist reputation, and secondary sale patterns.', toolCats: ['nft', 'data', 'social'], price: 35 },
  { name: 'Gaming NFT Tracker', desc: 'Monitors in-game NFT economies, play-to-earn yields, and item valuations.', toolCats: ['nft', 'crypto', 'data'], price: 30 },
  { name: 'Music NFT Curator', desc: 'Discovers music NFT drops, artist analytics, and streaming royalty tokens.', toolCats: ['nft', 'search', 'social'], price: 25 },
  { name: 'Domain Name Appraiser', desc: 'Values ENS, Unstoppable, and other blockchain domain names with comparable sales data.', toolCats: ['nft', 'data'], price: 30 },
  { name: 'Ordinals Explorer', desc: 'Explores Bitcoin Ordinals inscriptions, rarity, and marketplace activity.', toolCats: ['nft', 'crypto'], price: 35 },
  { name: 'PFP Collection Analyst', desc: 'Deep analysis of profile picture collections with holder distribution metrics.', toolCats: ['nft', 'data', 'social'], price: 30 },
  { name: 'NFT Wash Trade Detector', desc: 'Identifies wash trading patterns and artificial volume in NFT markets.', toolCats: ['nft', 'crypto', 'data'], price: 40 },
  { name: 'Metaverse Land Scout', desc: 'Tracks virtual land prices, development activity, and ROI across metaverses.', toolCats: ['nft', 'data', 'search'], price: 35 },
  { name: 'NFT Portfolio Optimizer', desc: 'Optimizes NFT portfolio allocation based on risk, rarity, and market trends.', toolCats: ['nft', 'data', 'crypto'], price: 40 },
  { name: 'Royalty Revenue Tracker', desc: 'Monitors creator royalty revenues and marketplace enforcement policies.', toolCats: ['nft', 'data'], price: 25 },
  { name: 'AI Art Authenticator', desc: 'Detects AI-generated art and verifies provenance of digital artworks.', toolCats: ['nft', 'data', 'code'], price: 35 },
]);

const SOCIAL_AGENTS = makeAgents('social', [
  { name: 'Crypto Twitter Pulse', desc: 'Aggregates and ranks crypto Twitter sentiment with influencer impact scoring.', toolCats: ['social', 'crypto'], price: 25 },
  { name: 'Reddit Alpha Scanner', desc: 'Scans crypto subreddits for emerging alpha, FUD, and community sentiment.', toolCats: ['social', 'search'], price: 20 },
  { name: 'Discord Intel Bot', desc: 'Monitors key Discord servers for alpha leaks, partnerships, and team updates.', toolCats: ['social', 'search'], price: 25 },
  { name: 'Influencer Tracker', desc: 'Tracks influencer portfolio movements and call accuracy over time.', toolCats: ['social', 'crypto', 'data'], price: 30 },
  { name: 'Farcaster Agent', desc: 'Engages with Farcaster ecosystem, tracks trending casts, and analyzes channels.', toolCats: ['social', 'crypto'], price: 25 },
  { name: 'Community Health Score', desc: 'Measures community engagement, growth rates, and sentiment across platforms.', toolCats: ['social', 'data'], price: 30 },
  { name: 'KOL Signal Aggregator', desc: 'Aggregates signals from top Key Opinion Leaders with hit-rate analysis.', toolCats: ['social', 'crypto', 'data'], price: 35 },
  { name: 'Telegram Scanner', desc: 'Monitors crypto Telegram groups for alpha calls and scam warnings.', toolCats: ['social', 'search'], price: 20 },
  { name: 'YouTube Crypto Digest', desc: 'Summarizes top crypto YouTube content with key takeaway extraction.', toolCats: ['social', 'search', 'media'], price: 20 },
  { name: 'Podcast Intel', desc: 'Transcribes and analyzes crypto podcasts for actionable intelligence.', toolCats: ['social', 'search', 'media'], price: 25 },
  { name: 'Brand Monitor', desc: 'Tracks brand mentions, sentiment changes, and PR impact for crypto projects.', toolCats: ['social', 'search', 'data'], price: 30 },
  { name: 'Trend Spotter', desc: 'Identifies emerging trends and viral narratives before they go mainstream.', toolCats: ['social', 'search', 'data'], price: 35 },
  { name: 'Engagement Optimizer', desc: 'Analyzes post performance and optimizes content strategy for crypto communities.', toolCats: ['social', 'data'], price: 25 },
  { name: 'Lens Protocol Agent', desc: 'Navigates Lens Protocol social graph for content discovery and engagement.', toolCats: ['social', 'crypto'], price: 25 },
  { name: 'Meme Coin Radar', desc: 'Tracks meme coin social buzz, holder distribution, and viral potential.', toolCats: ['social', 'crypto'], price: 20 },
]);

const NEWS_AGENTS = makeAgents('news', [
  { name: 'Breaking News Bot', desc: 'Sub-minute detection of breaking crypto news from 500+ global sources.', toolCats: ['search', 'social'], price: 20 },
  { name: 'Regulatory News Tracker', desc: 'Monitors regulatory news from SEC, CFTC, EU, and global crypto regulators.', toolCats: ['search', 'data'], price: 25 },
  { name: 'Exchange News Monitor', desc: 'Tracks exchange listings, delistings, maintenance, and policy changes.', toolCats: ['search', 'crypto'], price: 20 },
  { name: 'Partnership Alert', desc: 'Detects and analyzes new partnership announcements in the crypto ecosystem.', toolCats: ['search', 'social'], price: 25 },
  { name: 'Hack & Exploit News', desc: 'Instant alerts on crypto hacks, exploits, and security incidents.', toolCats: ['search', 'crypto', 'code'], price: 30 },
  { name: 'Airdrop News Scanner', desc: 'Aggregates airdrop announcements, eligibility criteria, and claim deadlines.', toolCats: ['search', 'crypto', 'social'], price: 20 },
  { name: 'Token Unlock Calendar', desc: 'Tracks token unlock schedules and vesting cliff dates for major projects.', toolCats: ['crypto', 'data'], price: 25 },
  { name: 'Earnings Report Bot', desc: 'Summarizes quarterly earnings from public crypto companies and miners.', toolCats: ['search', 'finance', 'data'], price: 30 },
  { name: 'ETF Flow Tracker', desc: 'Monitors Bitcoin and Ethereum ETF inflows, outflows, and AUM changes.', toolCats: ['finance', 'crypto', 'data'], price: 25 },
  { name: 'Conference Tracker', desc: 'Covers crypto conferences with real-time summaries of key announcements.', toolCats: ['search', 'social'], price: 20 },
  { name: 'Stablecoin News', desc: 'Tracks stablecoin regulatory news, adoption metrics, and reserve disclosures.', toolCats: ['search', 'crypto', 'data'], price: 20 },
  { name: 'Layer 1 News Digest', desc: 'Curated news digest covering all major Layer 1 blockchain developments.', toolCats: ['search', 'crypto'], price: 20 },
  { name: 'Mining & Hashrate News', desc: 'Monitors Bitcoin mining news, hashrate changes, and mining difficulty.', toolCats: ['search', 'crypto', 'data'], price: 20 },
  { name: 'Geopolitical Crypto News', desc: 'Analyzes geopolitical events and their impact on crypto markets.', toolCats: ['search', 'finance'], price: 25 },
]);

const DEV_AGENTS = makeAgents('development', [
  { name: 'Solidity Copilot', desc: 'AI pair programmer for Solidity smart contract development with best practices.', toolCats: ['code', 'search'], price: 35 },
  { name: 'Rust Smart Contract Dev', desc: 'Assists with Solana and NEAR smart contract development in Rust.', toolCats: ['code', 'search'], price: 40 },
  { name: 'Frontend DApp Builder', desc: 'Generates React/Next.js frontend code for Web3 dApp interfaces.', toolCats: ['code', 'search'], price: 30 },
  { name: 'Subgraph Developer', desc: 'Creates and optimizes The Graph subgraphs for on-chain data indexing.', toolCats: ['code', 'crypto', 'data'], price: 35 },
  { name: 'Zero Knowledge Dev', desc: 'Assists with ZK circuit development using Circom, Noir, and Halo2.', toolCats: ['code', 'search'], price: 55 },
  { name: 'Cairo Developer', desc: 'StarkNet Cairo language assistant for provable computation development.', toolCats: ['code', 'search'], price: 45 },
  { name: 'Move Language Bot', desc: 'Assists with Aptos and Sui Move smart contract development.', toolCats: ['code', 'search'], price: 40 },
  { name: 'Hardhat Task Runner', desc: 'Automates Hardhat development workflows, testing, and deployment scripts.', toolCats: ['code'], price: 25 },
  { name: 'Foundry Test Writer', desc: 'Generates comprehensive Foundry/Forge test suites for smart contracts.', toolCats: ['code'], price: 30 },
  { name: 'API Integration Bot', desc: 'Builds API integrations for blockchain data providers and oracles.', toolCats: ['code', 'data', 'search'], price: 30 },
  { name: 'DevOps Chain Bot', desc: 'Manages blockchain node deployment, monitoring, and infrastructure.', toolCats: ['code', 'data'], price: 35 },
  { name: 'SDK Generator', desc: 'Auto-generates TypeScript SDKs from smart contract ABIs.', toolCats: ['code'], price: 25 },
  { name: 'Gas Profiler', desc: 'Profiles and optimizes gas consumption in smart contract functions.', toolCats: ['code', 'crypto'], price: 35 },
  { name: 'ERC Standard Wizard', desc: 'Implements ERC-20, ERC-721, ERC-1155, and custom token standards.', toolCats: ['code', 'crypto'], price: 30 },
  { name: 'Chainlink Integration', desc: 'Integrates Chainlink oracles, VRF, and automation into smart contracts.', toolCats: ['code', 'crypto', 'data'], price: 35 },
  { name: 'Account Abstraction Dev', desc: 'Implements ERC-4337 account abstraction with paymaster and bundler setup.', toolCats: ['code', 'crypto'], price: 45 },
]);

const ONCHAIN_AGENTS = makeAgents('onchain', [
  { name: 'Whale Alert Pro', desc: 'Tracks whale wallet movements across all major chains with pattern analysis.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Token Flow Mapper', desc: 'Visualizes token flows between wallets, exchanges, and DeFi protocols.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Exchange Reserve Monitor', desc: 'Tracks exchange cold/hot wallet reserves and net flow trends.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'UTXO Analyst', desc: 'Analyzes Bitcoin UTXO age distribution, realized cap, and SOPR metrics.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Staking Dashboard', desc: 'Monitors ETH staking stats, validator performance, and withdrawal queues.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Mempool Watcher', desc: 'Real-time mempool monitoring for pending transactions and MEV opportunities.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Address Labeler', desc: 'Labels unknown addresses by analyzing transaction patterns and counterparties.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Chain Metrics Bot', desc: 'Reports daily active addresses, transaction counts, and fee revenue by chain.', toolCats: ['crypto', 'data'], price: 25 },
  { name: 'Token Holder Analyst', desc: 'Analyzes token holder distribution, concentration, and accumulation trends.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Smart Contract Events', desc: 'Monitors and decodes smart contract events for protocol activity tracking.', toolCats: ['crypto', 'code', 'data'], price: 35 },
  { name: 'Block Space Analyzer', desc: 'Analyzes block space usage, blob fees, and rollup data consumption.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Inscription Tracker', desc: 'Tracks ordinal inscriptions, BRC-20 tokens, and Bitcoin L2 activity.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Solana TPS Monitor', desc: 'Monitors Solana network performance, TPS, vote transactions, and jito tips.', toolCats: ['crypto', 'data'], price: 25 },
  { name: 'EVM State Differ', desc: 'Compares EVM state changes across blocks for protocol behavior analysis.', toolCats: ['crypto', 'code', 'data'], price: 40 },
]);

const MARKET_AGENTS = makeAgents('market', [
  { name: 'Alpha Researcher', desc: 'Synthesizes multi-source alpha from on-chain, social, and technical data.', toolCats: ['crypto', 'social', 'data'], price: 45 },
  { name: 'Market Sentinel', desc: 'Real-time market monitoring with customizable alert thresholds.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Sector Rotation Bot', desc: 'Identifies crypto sector rotation patterns and optimal entry/exit timing.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Fear & Greed Index', desc: 'Computes custom fear/greed index from 20+ market and social indicators.', toolCats: ['crypto', 'social', 'data'], price: 25 },
  { name: 'Derivatives Analyst', desc: 'Analyzes futures basis, options Greeks, and institutional positioning.', toolCats: ['crypto', 'data', 'finance'], price: 45 },
  { name: 'Stablecoin Flow Bot', desc: 'Monitors stablecoin minting, burning, and exchange deposit patterns.', toolCats: ['crypto', 'data'], price: 30 },
  { name: 'Altseason Predictor', desc: 'Predicts altcoin season probability using BTC dominance and rotation signals.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Crypto Index Builder', desc: 'Constructs custom crypto indices with rebalancing and performance tracking.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Supply Shock Detector', desc: 'Identifies supply shock setups from exchange reserves and lock-up schedules.', toolCats: ['crypto', 'data'], price: 40 },
  { name: 'Market Cap Ranker', desc: 'Dynamic market cap rankings with momentum and fundamental scoring.', toolCats: ['crypto', 'data'], price: 20 },
  { name: 'DCA Strategy Bot', desc: 'Optimizes dollar-cost averaging strategies with volatility-weighted timing.', toolCats: ['crypto', 'data'], price: 25 },
  { name: 'Portfolio Rebalancer', desc: 'Generates rebalancing recommendations based on target allocations.', toolCats: ['crypto', 'data', 'finance'], price: 30 },
  { name: 'Basis Trade Monitor', desc: 'Monitors cash-and-carry basis trade opportunities across exchanges.', toolCats: ['crypto', 'data', 'finance'], price: 40 },
  { name: 'Token Velocity Tracker', desc: 'Measures token velocity and economic activity for valuation models.', toolCats: ['crypto', 'data'], price: 30 },
]);

const MEDIA_AGENTS = makeAgents('media', [
  { name: 'Content Curator', desc: 'Curates crypto content from blogs, newsletters, and social media.', toolCats: ['search', 'social', 'media'], price: 20 },
  { name: 'Thread Summarizer', desc: 'Summarizes long Twitter threads and blog posts into key bullet points.', toolCats: ['social', 'search'], price: 15 },
  { name: 'Video Digest Bot', desc: 'Creates text summaries from crypto YouTube videos and podcasts.', toolCats: ['media', 'search'], price: 20 },
  { name: 'Newsletter Generator', desc: 'Auto-generates daily crypto newsletter from curated sources.', toolCats: ['search', 'social', 'data'], price: 25 },
  { name: 'Infographic Creator', desc: 'Generates data-driven crypto infographics and charts.', toolCats: ['media', 'data'], price: 30 },
  { name: 'Translation Agent', desc: 'Translates crypto content between 40+ languages with domain accuracy.', toolCats: ['search'], price: 15 },
  { name: 'Report Generator', desc: 'Produces professional research reports with charts and citations.', toolCats: ['data', 'search', 'media'], price: 35 },
  { name: 'Social Post Writer', desc: 'Crafts engaging social media posts for crypto projects and communities.', toolCats: ['social', 'media'], price: 15 },
  { name: 'Educational Content Bot', desc: 'Creates educational crypto content for beginners and advanced users.', toolCats: ['search', 'media'], price: 20 },
  { name: 'Data Visualization', desc: 'Creates interactive data visualizations for crypto analytics.', toolCats: ['data', 'media'], price: 25 },
  { name: 'Pitch Deck Analyzer', desc: 'Analyzes and scores crypto project pitch decks for investors.', toolCats: ['data', 'search'], price: 30 },
  { name: 'Documentation Writer', desc: 'Generates technical documentation for smart contracts and protocols.', toolCats: ['code', 'search'], price: 25 },
]);

const FINANCE_AGENTS = makeAgents('finance', [
  { name: 'TradFi Bridge', desc: 'Bridges traditional finance data with crypto markets for hybrid analysis.', toolCats: ['finance', 'crypto', 'data'], price: 40 },
  { name: 'Tax Calculator Bot', desc: 'Calculates crypto tax obligations across jurisdictions with cost basis tracking.', toolCats: ['crypto', 'data', 'finance'], price: 35 },
  { name: 'Portfolio Risk Analyst', desc: 'Measures portfolio VaR, Sharpe ratio, and drawdown metrics for crypto holdings.', toolCats: ['crypto', 'data', 'finance'], price: 40 },
  { name: 'Forex Crypto Correlator', desc: 'Analyzes forex pair correlations with major cryptocurrencies.', toolCats: ['finance', 'crypto', 'data'], price: 30 },
  { name: 'Institutional Flow Bot', desc: 'Tracks institutional crypto investments, ETF flows, and fund holdings.', toolCats: ['finance', 'crypto', 'data'], price: 45 },
  { name: 'Treasury Manager', desc: 'Assists DAOs and crypto companies with treasury management strategies.', toolCats: ['finance', 'defi', 'data'], price: 40 },
  { name: 'DCF Valuation Bot', desc: 'Applies discounted cash flow models to revenue-generating crypto protocols.', toolCats: ['finance', 'data', 'crypto'], price: 45 },
  { name: 'Credit Score Agent', desc: 'Computes on-chain credit scores based on wallet history and DeFi usage.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Insurance Risk Bot', desc: 'Assesses DeFi insurance risks and coverage recommendations.', toolCats: ['defi', 'data', 'finance'], price: 40 },
  { name: 'Payment Analytics', desc: 'Analyzes crypto payment adoption, merchant volumes, and payment trends.', toolCats: ['crypto', 'data', 'finance'], price: 30 },
  { name: 'Compliance Checker', desc: 'Checks wallet addresses against sanctions lists and compliance requirements.', toolCats: ['crypto', 'data'], price: 35 },
  { name: 'Cost Basis Tracker', desc: 'Tracks cost basis across complex DeFi interactions for tax reporting.', toolCats: ['crypto', 'data', 'finance'], price: 30 },
]);

const GAMING_AGENTS = makeAgents('gaming', [
  { name: 'GameFi Tracker', desc: 'Monitors play-to-earn game economies, token prices, and player metrics.', toolCats: ['nft', 'crypto', 'data'], price: 25 },
  { name: 'Guild Manager Bot', desc: 'Manages gaming guild operations, scholarship programs, and revenue sharing.', toolCats: ['data', 'crypto'], price: 30 },
  { name: 'In-Game Asset Valuator', desc: 'Values in-game NFT assets based on rarity, utility, and market demand.', toolCats: ['nft', 'data'], price: 25 },
  { name: 'Game Economy Analyst', desc: 'Analyzes game token sinks, faucets, and economic sustainability.', toolCats: ['data', 'crypto'], price: 30 },
  { name: 'Esports Crypto Bot', desc: 'Tracks esports crypto insight markets and tournament prize pools.', toolCats: ['search', 'data', 'social'], price: 25 },
  { name: 'Metaverse Event Scout', desc: 'Discovers and reports on metaverse events, concerts, and exhibitions.', toolCats: ['search', 'social', 'nft'], price: 20 },
  { name: 'Game Launch Tracker', desc: 'Monitors upcoming Web3 game launches, beta tests, and IDO schedules.', toolCats: ['search', 'social', 'crypto'], price: 20 },
  { name: 'Battle Pass Optimizer', desc: 'Optimizes battle pass and season pass progression for P2E games.', toolCats: ['data'], price: 15 },
  { name: 'Virtual Real Estate', desc: 'Tracks virtual land sales, rentals, and development across metaverses.', toolCats: ['nft', 'data', 'search'], price: 30 },
  { name: 'Game Review Bot', desc: 'Provides comprehensive reviews of Web3 games with gameplay and economy analysis.', toolCats: ['search', 'social', 'data'], price: 20 },
]);

// ---------------------------------------------------------------------------
// Export all templates
// ---------------------------------------------------------------------------

export const AGENT_CATEGORIES: CategoryDef[] = [
  { specialization: 'defi', label: 'DeFi', agents: DEFI_AGENTS },
  { specialization: 'trading', label: 'Trading', agents: TRADING_AGENTS },
  { specialization: 'research', label: 'Research', agents: RESEARCH_AGENTS },
  { specialization: 'security', label: 'Security', agents: SECURITY_AGENTS },
  { specialization: 'nft', label: 'NFT', agents: NFT_AGENTS },
  { specialization: 'social', label: 'Social', agents: SOCIAL_AGENTS },
  { specialization: 'news', label: 'News', agents: NEWS_AGENTS },
  { specialization: 'development', label: 'Development', agents: DEV_AGENTS },
  { specialization: 'onchain', label: 'On-Chain', agents: ONCHAIN_AGENTS },
  { specialization: 'market', label: 'Market', agents: MARKET_AGENTS },
  { specialization: 'media', label: 'Media', agents: MEDIA_AGENTS },
  { specialization: 'finance', label: 'Finance', agents: FINANCE_AGENTS },
  { specialization: 'gaming', label: 'Gaming', agents: GAMING_AGENTS },
];

/** All agent templates flattened */
export const ALL_AGENT_TEMPLATES: AgentTemplate[] = AGENT_CATEGORIES.flatMap((c) => c.agents);

/** Total count */
export const TOTAL_AGENT_COUNT = ALL_AGENT_TEMPLATES.length;
