// ─── P2P Trading Market Templates ───────────────────────────────────
// Pre-made market templates for auto-creation by heartbeat/cron

export const MARKET_CATEGORIES: Record<
  string,
  Array<{ title: string; outcomes: string[]; resolveDays?: number }>
> = {
  crypto_price: [
    { title: 'BTC above $100k by end of week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'ETH above $5,000 by end of month?', outcomes: ['Yes', 'No'], resolveDays: 30 },
    { title: 'ETH/BTC ratio above 0.05 this month?', outcomes: ['Yes', 'No'], resolveDays: 30 },
    { title: 'SOL flips BNB in market cap this quarter?', outcomes: ['Yes', 'No'], resolveDays: 90 },
    { title: 'BTC dominance above 55% this week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'Total crypto market cap above $4T this month?', outcomes: ['Yes', 'No'], resolveDays: 30 },
  ],
  agent_performance: [
    { title: 'Top agent by calls this week: DeFi Oracle or Alpha Hunter?', outcomes: ['DeFi Oracle', 'Alpha Hunter'], resolveDays: 7 },
    { title: 'Any agent exceeds 500 calls this week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'Highest earning agent this week?', outcomes: ['DeFi Oracle', 'Alpha Hunter', 'Research Bot', 'Other'], resolveDays: 7 },
    { title: 'New agent beats 1500 ELO within first week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'Arena champion changes this week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
  ],
  ecosystem: [
    { title: 'BBAI daily volume exceeds 100,000 BBAI?', outcomes: ['Yes', 'No'], resolveDays: 1 },
    { title: 'New agent registrations this week: over or under 10?', outcomes: ['Over', 'Under'], resolveDays: 7 },
    { title: 'Arena battles completed this week: over 50?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'Total platform users surpass 1,000 this month?', outcomes: ['Yes', 'No'], resolveDays: 30 },
    { title: 'Marketplace listings exceed 200 this week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
  ],
  defi: [
    { title: 'Total DeFi TVL above $200B by month end?', outcomes: ['Yes', 'No'], resolveDays: 30 },
    { title: 'Gas fees on Ethereum below 10 gwei this week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'Uniswap daily volume exceeds $2B this week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'New DeFi protocol reaches $1B TVL this month?', outcomes: ['Yes', 'No'], resolveDays: 30 },
  ],
  nft: [
    { title: 'NFT weekly volume exceeds $500M?', outcomes: ['Yes', 'No'], resolveDays: 7 },
    { title: 'Blue-chip NFT floor prices rise this week?', outcomes: ['Yes', 'No'], resolveDays: 7 },
  ],
  custom: [], // user-created markets
};

export const ALL_CATEGORIES = Object.keys(MARKET_CATEGORIES);

/**
 * Generate a random market from the template pool.
 */
export function generateMarket(category?: string): {
  title: string;
  outcomes: string[];
  category: string;
  resolvesAt: Date;
} {
  const cat = category && MARKET_CATEGORIES[category]
    ? category
    : ALL_CATEGORIES[Math.floor(Math.random() * (ALL_CATEGORIES.length - 1))]; // exclude 'custom'

  const templates = MARKET_CATEGORIES[cat];
  if (!templates || templates.length === 0) {
    // Fallback to crypto_price
    const fallback = MARKET_CATEGORIES.crypto_price;
    const template = fallback[Math.floor(Math.random() * fallback.length)];
    return {
      title: template.title,
      outcomes: template.outcomes,
      category: 'crypto_price',
      resolvesAt: new Date(Date.now() + (template.resolveDays ?? 7) * 24 * 60 * 60 * 1000),
    };
  }

  const template = templates[Math.floor(Math.random() * templates.length)];
  return {
    title: template.title,
    outcomes: template.outcomes,
    category: cat,
    resolvesAt: new Date(Date.now() + (template.resolveDays ?? 7) * 24 * 60 * 60 * 1000),
  };
}

/**
 * Generate multiple distinct markets, one per category (or a random subset).
 */
export function generateMarketBatch(count: number = 5): Array<{
  title: string;
  outcomes: string[];
  category: string;
  resolvesAt: Date;
}> {
  const categories = ALL_CATEGORIES.filter((c) => c !== 'custom');
  const selected = categories.slice(0, Math.min(count, categories.length));
  return selected.map((cat) => generateMarket(cat));
}
