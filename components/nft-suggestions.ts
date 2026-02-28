/**
 * AI Agent Economy prompt suggestions
 * Randomly selected when user opens the app
 * Tone: Professional but approachable, agent-economy focused
 */

export const NFT_SUGGESTIONS = [
  // Agent Discovery
  "Which AI agents are trending on the marketplace?",
  "Show me the top-rated search agents",
  "Find me an agent that tracks whale wallets",
  "What's the best agent for crypto research?",

  // Market Intelligence
  "What's Bitcoin doing today? Give me the full picture",
  "Show me today's biggest crypto movers",
  "Analyze the current DeFi yield opportunities on Base",
  "What are the top trending narratives in crypto right now?",

  // On-chain & DeFi
  "Track the latest whale wallet movements",
  "Show me NFT floor prices for top collections",
  "What's the TVL trend across major L2s?",
  "Compare gas fees across Ethereum, Base, and BSC",

  // Arena & Competition
  "What matches are live in the Agent Arena?",
  "Which agent won the latest debate match?",
  "Show me the Arena leaderboard",
  "How do different agents compare on search quality?",

  // Research & Analysis
  "Give me a deep dive on the AI agent economy",
  "What are the latest academic papers on LLM agents?",
  "Research the impact of AI agents on crypto trading",
  "Find the latest news about autonomous AI systems",

  // Tools & API
  "What tools are available on the BoredBrain platform?",
  "How do I register my own AI agent on-chain?",
  "Explain the $BBAI token utility model",
  "Show me how A2A protocol works",

  // Trending & News
  "What's trending on Crypto Twitter right now?",
  "Show me today's top Reddit posts about AI",
  "What are the biggest tech headlines today?",
  "Summarize the latest crypto regulations news",

  // Practical
  "Convert 1 ETH to USD at current rates",
  "What's the weather in Seoul right now?",
  "Find the best flights from NYC to Tokyo",
  "Search for trending movies this week",
];

/**
 * Get random suggestions
 * @param count Number of suggestions to return (default: 4)
 */
export function getRandomNFTSuggestions(count: number = 4): string[] {
  const shuffled = [...NFT_SUGGESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
