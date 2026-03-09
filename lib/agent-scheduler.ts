/**
 * Agent Scenario Engine
 *
 * Generates realistic agent-to-agent call scenarios based on specialization
 * compatibility. Used by the heartbeat cron to drive autonomous agent activity.
 */

import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { getAgentWallet } from '@/lib/agent-wallet';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Specialization pairing map
// ---------------------------------------------------------------------------

const SPECIALIZATION_PAIRS: Record<string, string[]> = {
  trading: ['defi', 'market', 'news', 'onchain'],
  defi: ['trading', 'research', 'onchain', 'security'],
  research: ['news', 'social', 'defi', 'development'],
  security: ['defi', 'development', 'onchain'],
  nft: ['social', 'market', 'onchain'],
  social: ['news', 'research', 'nft'],
  news: ['trading', 'market', 'social'],
  development: ['security', 'research', 'defi'],
  onchain: ['trading', 'defi', 'nft', 'security'],
  market: ['trading', 'defi', 'news', 'research'],
  media: ['social', 'news', 'research'],
  finance: ['trading', 'defi', 'market'],
  gaming: ['nft', 'social', 'market'],
};

// ---------------------------------------------------------------------------
// Variable pools for template interpolation
// ---------------------------------------------------------------------------

const CHAINS = ['Ethereum', 'Arbitrum', 'Base', 'Solana', 'Polygon'];
const TOKENS = ['BTC', 'ETH', 'SOL', 'ARB', 'OP'];
const TOPICS = ['DeFi', 'NFT', 'L2', 'AI tokens', 'stablecoins'];
const TIMEFRAMES = ['24h', '7d', '30d'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string): string {
  return template
    .replace(/\{chain\}/g, pick(CHAINS))
    .replace(/\{token\}/g, pick(TOKENS))
    .replace(/\{topic\}/g, pick(TOPICS))
    .replace(/\{timeframe\}/g, pick(TIMEFRAMES));
}

// ---------------------------------------------------------------------------
// Query templates by caller→provider specialization pair
// ---------------------------------------------------------------------------

const QUERY_TEMPLATES: Record<string, string[]> = {
  // trading → defi
  'trading:defi': [
    'What are the best {token} yield farming opportunities on {chain} right now?',
    'Compare DEX liquidity for {token} across {chain} over the last {timeframe}.',
    'Analyze impermanent loss risk for {token}/USDT LP on {chain}.',
    'Which {chain} DeFi protocols offer the highest APY for {token} staking?',
    'Evaluate lending rates for {token} across top {chain} protocols.',
  ],
  // trading → market
  'trading:market': [
    'Give me a {timeframe} technical analysis for {token} with support/resistance levels.',
    'What is the current order book depth for {token} on major exchanges?',
    'Analyze {token} price action relative to {topic} sector over {timeframe}.',
    'Identify momentum divergences for {token} on the {timeframe} chart.',
    'How does {token} market cap compare to the rest of {topic}?',
  ],
  // trading → news
  'trading:news': [
    'Summarize the latest {topic} news that could impact {token} price in the next {timeframe}.',
    'Are there any regulatory updates on {chain} that affect {token} trading?',
    'What is the current market sentiment around {topic} based on recent headlines?',
    'Report breaking news about {token} ecosystem developments.',
    'Aggregate social media buzz about {token} over the last {timeframe}.',
  ],
  // trading → onchain
  'trading:onchain': [
    'Track whale movements for {token} on {chain} over the last {timeframe}.',
    'What is the net flow of {token} into exchanges on {chain}?',
    'Identify large wallet accumulation patterns for {token} on {chain}.',
    'Show me the top {token} holders on {chain} and their recent activity.',
    'Analyze {token} gas usage trends on {chain} over {timeframe}.',
  ],
  // defi → trading
  'defi:trading': [
    'What is the best entry price for {token} based on {timeframe} moving averages?',
    'Provide a risk/reward analysis for longing {token} at current levels.',
    'How are {token} perpetual futures funding rates trending over {timeframe}?',
    'What is the current open interest for {token} derivatives?',
    'Suggest optimal DCA intervals for accumulating {token} over {timeframe}.',
  ],
  // defi → research
  'defi:research': [
    'Audit the smart contract security of the top {topic} protocols on {chain}.',
    'Research tokenomics comparison for leading {topic} projects.',
    'What are the emerging {topic} trends on {chain} for the next quarter?',
    'Evaluate governance mechanisms of top {topic} DAOs.',
    'Compare total value locked across {topic} protocols over {timeframe}.',
  ],
  // defi → onchain
  'defi:onchain': [
    'Monitor {chain} mempool for large {token} transactions.',
    'What smart contracts on {chain} have the highest {token} volume in {timeframe}?',
    'Trace the flow of {token} between DeFi protocols on {chain}.',
    'Identify newly deployed {topic} contracts on {chain} this week.',
    'Analyze gas optimization patterns for {topic} transactions on {chain}.',
  ],
  // defi → security
  'defi:security': [
    'Scan the latest {topic} protocol on {chain} for common vulnerabilities.',
    'Has any {topic} protocol on {chain} been exploited in the last {timeframe}?',
    'Rate the security posture of the top 5 {topic} protocols.',
    'Check for reentrancy risks in popular {chain} {topic} contracts.',
    'Review oracle dependency risks for {topic} protocols on {chain}.',
  ],
  // research → news
  'research:news': [
    'Compile a {timeframe} digest of {topic} developments across the ecosystem.',
    'What academic papers or research have been published about {topic} recently?',
    'Summarize key conference talks about {topic} from the last {timeframe}.',
    'What are analysts saying about {token} fundamentals this week?',
    'Track regulatory sentiment towards {topic} globally over {timeframe}.',
  ],
  // research → social
  'research:social': [
    'Analyze community sentiment around {topic} on crypto Twitter over {timeframe}.',
    'What are the most discussed {topic} projects in Discord communities?',
    'Track influencer mentions of {token} across social platforms.',
    'Measure social engagement metrics for top {topic} projects.',
    'Identify emerging narratives about {topic} from social media trends.',
  ],
  // research → defi
  'research:defi': [
    'Compare yield strategies for {token} across {chain} DeFi protocols.',
    'What are the risks of the new {topic} liquidity mining programs on {chain}?',
    'Analyze protocol revenue for top {topic} projects over {timeframe}.',
    'Evaluate the sustainability of current {topic} APY rates on {chain}.',
    'Map the dependency graph of {topic} protocols on {chain}.',
  ],
  // research → development
  'research:development': [
    'What is the GitHub commit activity for top {topic} projects over {timeframe}?',
    'Compare developer ecosystems across {chain} and competing L1/L2s.',
    'Identify the most active open-source {topic} repositories.',
    'Analyze developer retention rates for {topic} projects.',
    'What new developer tooling has been released for {chain} recently?',
  ],
  // security → defi
  'security:defi': [
    'List recent exploit incidents in {topic} protocols over the last {timeframe}.',
    'What are the common attack vectors for {topic} protocols on {chain}?',
    'Evaluate the insurance coverage available for {topic} protocols.',
    'Analyze the bug bounty programs of top {topic} projects.',
    'Check for flash loan vulnerabilities in {topic} protocols on {chain}.',
  ],
  // security → development
  'security:development': [
    'Review the latest Solidity security best practices for {topic} contracts.',
    'What static analysis tools are recommended for {chain} smart contracts?',
    'Identify common {topic} contract patterns that lead to vulnerabilities.',
    'Evaluate formal verification adoption in {topic} protocol development.',
    'What are the best testing frameworks for {chain} smart contract security?',
  ],
  // security → onchain
  'security:onchain': [
    'Monitor {chain} for suspicious contract deployments in the last {timeframe}.',
    'Track known exploit addresses interacting with {topic} protocols on {chain}.',
    'Analyze transaction patterns that indicate potential {topic} exploits on {chain}.',
    'Identify proxy upgrade patterns in {topic} contracts on {chain}.',
    'Check for admin key centralization in {topic} protocols on {chain}.',
  ],
  // nft → social
  'nft:social': [
    'What NFT collections are trending on social media over the last {timeframe}?',
    'Analyze community growth for top {chain} NFT projects.',
    'Track influencer NFT purchases and promotions this week.',
    'Measure Discord engagement for trending NFT collections on {chain}.',
    'What is the social sentiment around {chain} NFT marketplace activity?',
  ],
  // nft → market
  'nft:market': [
    'Compare floor prices of top NFT collections on {chain} over {timeframe}.',
    'What is the trading volume trend for {chain} NFTs in the last {timeframe}?',
    'Identify undervalued NFT collections on {chain} based on holder metrics.',
    'Analyze wash trading patterns in {chain} NFT marketplaces.',
    'Track royalty revenue trends for top NFT collections over {timeframe}.',
  ],
  // nft → onchain
  'nft:onchain': [
    'Track whale NFT purchases on {chain} over the last {timeframe}.',
    'What are the most active NFT smart contracts on {chain} this week?',
    'Analyze mint patterns for new NFT collections on {chain}.',
    'Identify airdrop-farming wallet clusters in {chain} NFT activity.',
    'Monitor bridge activity for NFTs moving to/from {chain}.',
  ],
  // social → news
  'social:news': [
    'What {topic} news is generating the most social media engagement?',
    'Cross-reference trending {topic} narratives with actual news events.',
    'Track how {token} news stories spread across social platforms.',
    'Identify misinformation about {topic} circulating on social media.',
    'Analyze the lag between news publication and social reaction for {topic}.',
  ],
  // social → research
  'social:research': [
    'What research topics are being most discussed in {topic} communities?',
    'Correlate social sentiment with {token} price movements over {timeframe}.',
    'Identify thought leaders driving {topic} discourse on social platforms.',
    'Analyze the accuracy of crowd predictions for {topic} outcomes.',
    'Map the information flow network for {topic} discussions online.',
  ],
  // social → nft
  'social:nft': [
    'Which NFT communities on {chain} have the most active social presence?',
    'Track social-driven NFT pumps on {chain} over the last {timeframe}.',
    'Analyze the correlation between social followers and NFT floor prices.',
    'What NFT projects are getting the most organic mentions this week?',
    'Identify upcoming NFT launches with the strongest social buzz.',
  ],
  // news → trading
  'news:trading': [
    'How has {token} price reacted to major news events over the last {timeframe}?',
    'Identify news-driven trading opportunities for {token} this week.',
    'What upcoming events could impact {token} price action?',
    'Correlate news sentiment scores with {token} volatility over {timeframe}.',
    'Track market reaction time to {topic} announcements.',
  ],
  // news → market
  'news:market': [
    'How is {topic} news affecting overall market capitalization trends?',
    'What market sectors are most impacted by recent {topic} headlines?',
    'Provide a market overview in context of this week\'s {topic} developments.',
    'How do {token} market metrics compare before and after recent news events?',
    'Analyze the market impact of regulatory news about {topic} over {timeframe}.',
  ],
  // news → social
  'news:social': [
    'What is the social media reaction to the latest {topic} news?',
    'Compare professional media coverage vs social media sentiment on {topic}.',
    'Track how {topic} news stories are being framed across different platforms.',
    'Identify social media accounts that break {topic} news earliest.',
    'Analyze the virality of recent {topic} news across platforms.',
  ],
  // development → security
  'development:security': [
    'Run a security review on this {topic} smart contract pattern for {chain}.',
    'What are the latest CVEs affecting {chain} development tooling?',
    'Review access control patterns in our {topic} contract deployment.',
    'Check for known vulnerabilities in common {chain} dependencies.',
    'Evaluate the security of our {topic} upgrade mechanism.',
  ],
  // development → research
  'development:research': [
    'What are the latest EIP/BIP proposals relevant to {topic} development?',
    'Research gas optimization techniques for {topic} operations on {chain}.',
    'Compare consensus mechanisms being adopted by {topic} protocols.',
    'What academic advances in {topic} could impact {chain} development?',
    'Analyze the performance benchmarks for {topic} implementations across chains.',
  ],
  // development → defi
  'development:defi': [
    'What SDK integrations are available for {topic} protocols on {chain}?',
    'Compare API documentation quality for top {topic} protocols.',
    'What are the best practices for integrating with {chain} {topic} contracts?',
    'Analyze the composability of {topic} protocol interfaces on {chain}.',
    'Evaluate webhook and event systems for {topic} protocols on {chain}.',
  ],
  // onchain → trading
  'onchain:trading': [
    'What does on-chain data suggest about {token} accumulation trends?',
    'Analyze exchange inflow/outflow for {token} on {chain} over {timeframe}.',
    'Track smart money wallets and their {token} positions.',
    'What does the MVRV ratio indicate for {token} right now?',
    'Identify supply squeeze signals for {token} from on-chain metrics.',
  ],
  // onchain → defi
  'onchain:defi': [
    'What is the TVL trend for {topic} protocols on {chain} over {timeframe}?',
    'Track large deposits and withdrawals from {topic} protocols on {chain}.',
    'Analyze liquidation cascades in {topic} lending protocols over {timeframe}.',
    'Monitor governance token flows for {topic} DAOs on {chain}.',
    'Identify yield farming rotation patterns from on-chain data on {chain}.',
  ],
  // onchain → nft
  'onchain:nft': [
    'Track the largest NFT transactions on {chain} in the last {timeframe}.',
    'Analyze mint-to-list patterns for NFT collections on {chain}.',
    'Identify wallets accumulating NFTs across multiple collections on {chain}.',
    'What is the on-chain royalty payout trend for {chain} NFTs?',
    'Monitor new NFT contract deployments on {chain} this week.',
  ],
  // onchain → security
  'onchain:security': [
    'Flag suspicious transactions on {chain} related to {topic} over {timeframe}.',
    'Monitor known exploit addresses for activity on {chain}.',
    'Detect anomalous gas patterns that might indicate an attack on {chain}.',
    'Track admin key usage for {topic} protocols on {chain}.',
    'Analyze {chain} mempool for potential sandwich attacks on {topic} trades.',
  ],
  // market → trading
  'market:trading': [
    'Provide a full market structure analysis for {token} over {timeframe}.',
    'What is the correlation between {token} and BTC over the last {timeframe}?',
    'Generate support and resistance levels for {token} based on volume profile.',
    'Analyze market depth and spread for {token} across top exchanges.',
    'What does the options market imply about {token} price in the next {timeframe}?',
  ],
  // market → defi
  'market:defi': [
    'How do DeFi TVL trends on {chain} correlate with {token} market moves?',
    'Compare stablecoin market cap changes with {topic} protocol activity.',
    'What is the market share breakdown for {topic} protocols on {chain}?',
    'Analyze the relationship between {token} staking ratios and market price.',
    'Track capital rotation between {topic} sub-sectors over {timeframe}.',
  ],
  // market → news
  'market:news': [
    'What upcoming events or catalysts could drive {topic} market movements?',
    'Correlate recent {topic} news with market volume changes.',
    'What is the market pricing in from recent {topic} regulatory updates?',
    'Track how market makers react to {topic} news in real-time.',
    'Analyze the impact of macro news on {topic} market dynamics over {timeframe}.',
  ],
  // market → research
  'market:research': [
    'Research institutional adoption metrics for {topic} over {timeframe}.',
    'What are the key fundamental metrics driving {token} valuation?',
    'Analyze market structure changes in {topic} after recent protocol upgrades.',
    'Compare retail vs institutional flows into {topic} over {timeframe}.',
    'What research reports have been published about {token} fundamentals recently?',
  ],
  // media → social
  'media:social': [
    'What {topic} content is performing best across social platforms?',
    'Analyze engagement patterns for {topic} media content over {timeframe}.',
    'Track viral {topic} narratives spreading across social media.',
    'Compare {topic} content reach across different social platforms.',
    'Identify top-performing media formats for {topic} content.',
  ],
  // media → news
  'media:news': [
    'Curate the most impactful {topic} news stories of the last {timeframe}.',
    'Analyze media bias in {topic} coverage across major outlets.',
    'Track press release activity for {token} ecosystem projects.',
    'What {topic} stories are underreported by mainstream media?',
    'Compile a media monitoring report for {topic} over {timeframe}.',
  ],
  // media → research
  'media:research': [
    'Research the impact of media narratives on {topic} adoption rates.',
    'Analyze the correlation between media coverage and {token} price over {timeframe}.',
    'What academic research exists on media influence in {topic} markets?',
    'Compare media sentiment analysis methods for {topic} content.',
    'Track the evolution of {topic} media narratives over {timeframe}.',
  ],
  // finance → trading
  'finance:trading': [
    'Provide a {timeframe} portfolio performance review for a {topic}-focused strategy.',
    'What is the optimal {token} allocation in a diversified crypto portfolio?',
    'Analyze risk-adjusted returns for {token} compared to {topic} index.',
    'Evaluate hedging strategies for {token} exposure over the next {timeframe}.',
    'Compare the Sharpe ratio of {token} vs {topic} basket over {timeframe}.',
  ],
  // finance → defi
  'finance:defi': [
    'Calculate the APY across {topic} yield strategies on {chain}.',
    'What is the risk-adjusted yield for {token} staking on {chain}?',
    'Compare treasury management approaches for {topic} protocols.',
    'Analyze fee revenue vs token incentives for {topic} protocols on {chain}.',
    'Evaluate the financial sustainability of {topic} liquidity mining on {chain}.',
  ],
  // finance → market
  'finance:market': [
    'Provide a {timeframe} financial summary of the {topic} market sector.',
    'Analyze market cap to revenue ratios for top {topic} projects.',
    'What is the total addressable market for {topic}?',
    'Compare token vesting schedules for major {topic} projects.',
    'Track treasury balances of top {topic} DAOs over {timeframe}.',
  ],
  // gaming → nft
  'gaming:nft': [
    'What gaming NFT collections on {chain} are gaining traction?',
    'Compare floor prices of top gaming NFTs over {timeframe}.',
    'Analyze utility and in-game value of NFT assets on {chain}.',
    'Track the cross-platform interoperability of gaming NFTs.',
    'Identify upcoming gaming NFT launches on {chain} with strong backing.',
  ],
  // gaming → social
  'gaming:social': [
    'What blockchain games are trending on social media this week?',
    'Compare community sizes for top gaming projects on {chain}.',
    'Track player acquisition trends for {chain} games over {timeframe}.',
    'Analyze social sentiment towards play-to-earn models.',
    'Identify gaming influencers driving the most engagement around {chain} games.',
  ],
  // gaming → market
  'gaming:market': [
    'Analyze the market cap trend for gaming tokens over {timeframe}.',
    'Compare trading volumes for top gaming tokens vs broader {topic} market.',
    'What is the market outlook for blockchain gaming tokens?',
    'Track investor interest in gaming projects based on funding rounds.',
    'Evaluate the market performance of recently launched gaming tokens.',
  ],
};

// Fallback templates when no specific pair template exists
const FALLBACK_TEMPLATES = [
  'Analyze {topic} activity on {chain} over the last {timeframe}.',
  'What are the key {token} metrics to watch in the next {timeframe}?',
  'Summarize the state of {topic} on {chain}.',
  'Provide insights on {token} movements related to {topic}.',
  'What trends are emerging in {topic} across {chain}?',
];

// ---------------------------------------------------------------------------
// Scenario types
// ---------------------------------------------------------------------------

export interface AgentScenario {
  callerId: string;
  callerName: string;
  providerId: string;
  providerName: string;
  query: string;
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Generate `count` realistic agent-to-agent call scenarios by:
 * 1. Querying active agents with wallet balance > 20
 * 2. Matching caller→provider pairs via SPECIALIZATION_PAIRS
 * 3. Filling query templates with random variables
 */
export async function generateScenarios(count: number): Promise<AgentScenario[]> {
  // Fetch all active/verified agents
  const agents = await db
    .select()
    .from(externalAgent)
    .where(
      sql`${externalAgent.status} IN ('active', 'verified')`,
    );

  if (agents.length < 2) return [];

  // Filter agents whose wallet balance > 20
  const eligible: typeof agents = [];
  for (const agent of agents) {
    const wallet = await getAgentWallet(agent.id);
    if (wallet && wallet.balance > 20) {
      eligible.push(agent);
    }
  }

  if (eligible.length < 2) return [];

  const scenarios: AgentScenario[] = [];

  for (let i = 0; i < count; i++) {
    // Pick a random caller
    const callerIdx = Math.floor(Math.random() * eligible.length);
    const caller = eligible[callerIdx];
    const callerSpec = caller.specialization.toLowerCase();

    // Find compatible provider specializations
    const compatibleSpecs = SPECIALIZATION_PAIRS[callerSpec] ?? Object.keys(SPECIALIZATION_PAIRS);

    // Find eligible providers matching one of the compatible specs
    const candidates = eligible.filter(
      (a) =>
        a.id !== caller.id &&
        compatibleSpecs.includes(a.specialization.toLowerCase()),
    );

    if (candidates.length === 0) {
      // Fall back to any other agent
      const others = eligible.filter((a) => a.id !== caller.id);
      if (others.length === 0) continue;
      const provider = others[Math.floor(Math.random() * others.length)];
      scenarios.push({
        callerId: caller.id,
        callerName: caller.name,
        providerId: provider.id,
        providerName: provider.name,
        query: fillTemplate(pick(FALLBACK_TEMPLATES)),
      });
      continue;
    }

    const provider = candidates[Math.floor(Math.random() * candidates.length)];
    const providerSpec = provider.specialization.toLowerCase();
    const pairKey = `${callerSpec}:${providerSpec}`;
    const templates = QUERY_TEMPLATES[pairKey] ?? FALLBACK_TEMPLATES;

    scenarios.push({
      callerId: caller.id,
      callerName: caller.name,
      providerId: provider.id,
      providerName: provider.name,
      query: fillTemplate(pick(templates)),
    });
  }

  return scenarios;
}

/**
 * Return agents with wallet balance < 50 USDT.
 * Used by the heartbeat for economic rebalancing.
 */
export async function getRebalanceCandidates(): Promise<
  Array<{ agentId: string; name: string; balance: number }>
> {
  const agents = await db
    .select()
    .from(externalAgent)
    .where(
      sql`${externalAgent.status} IN ('active', 'verified')`,
    );

  const candidates: Array<{ agentId: string; name: string; balance: number }> = [];

  for (const agent of agents) {
    const wallet = await getAgentWallet(agent.id);
    if (wallet && wallet.balance < 50) {
      candidates.push({
        agentId: agent.id,
        name: agent.name,
        balance: wallet.balance,
      });
    }
  }

  return candidates;
}
