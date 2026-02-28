export const frequencyOptions = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const timezoneOptions = [
  // UTC
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },

  // North America
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
  { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
  { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
  { value: 'America/Mexico_City', label: 'Central Time (Mexico City)' },

  // Europe
  { value: 'Europe/London', label: 'Greenwich Mean Time (London)' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)' },
  { value: 'Europe/Berlin', label: 'Central European Time (Berlin)' },
  { value: 'Europe/Rome', label: 'Central European Time (Rome)' },
  { value: 'Europe/Madrid', label: 'Central European Time (Madrid)' },
  { value: 'Europe/Amsterdam', label: 'Central European Time (Amsterdam)' },
  { value: 'Europe/Brussels', label: 'Central European Time (Brussels)' },
  { value: 'Europe/Vienna', label: 'Central European Time (Vienna)' },
  { value: 'Europe/Zurich', label: 'Central European Time (Zurich)' },
  { value: 'Europe/Stockholm', label: 'Central European Time (Stockholm)' },
  { value: 'Europe/Helsinki', label: 'Eastern European Time (Helsinki)' },
  { value: 'Europe/Moscow', label: 'Moscow Standard Time (Moscow)' },
  { value: 'Europe/Istanbul', label: 'Turkey Time (Istanbul)' },
  { value: 'Europe/Athens', label: 'Eastern European Time (Athens)' },

  // Asia
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (Shanghai)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time (Hong Kong)' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time (Singapore)' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time (Seoul)' },
  { value: 'Asia/Bangkok', label: 'Indochina Time (Bangkok)' },
  { value: 'Asia/Jakarta', label: 'Western Indonesia Time (Jakarta)' },
  { value: 'Asia/Manila', label: 'Philippine Standard Time (Manila)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia Time (Kuala Lumpur)' },
  { value: 'Asia/Taipei', label: 'Taipei Standard Time (Taipei)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (Kolkata/Mumbai)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (Dubai)' },
  { value: 'Asia/Riyadh', label: 'Arabia Standard Time (Riyadh)' },
  { value: 'Asia/Tehran', label: 'Iran Standard Time (Tehran)' },
  { value: 'Asia/Jerusalem', label: 'Israel Standard Time (Jerusalem)' },

  // Australia & Oceania
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time (Melbourne)' },
  { value: 'Australia/Brisbane', label: 'Australian Eastern Time (Brisbane)' },
  { value: 'Australia/Perth', label: 'Australian Western Time (Perth)' },
  { value: 'Australia/Adelaide', label: 'Australian Central Time (Adelaide)' },
  { value: 'Australia/Darwin', label: 'Australian Central Time (Darwin)' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time (Auckland)' },
  { value: 'Pacific/Fiji', label: 'Fiji Time (Fiji)' },

  // Africa
  { value: 'Africa/Cairo', label: 'Eastern European Time (Cairo)' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (Johannesburg)' },
  { value: 'Africa/Lagos', label: 'West Africa Time (Lagos)' },
  { value: 'Africa/Nairobi', label: 'East Africa Time (Nairobi)' },
  { value: 'Africa/Casablanca', label: 'Western European Time (Casablanca)' },

  // South America
  { value: 'America/Sao_Paulo', label: 'Brasilia Time (São Paulo)' },
  { value: 'America/Buenos_Aires', label: 'Argentina Time (Buenos Aires)' },
  { value: 'America/Santiago', label: 'Chile Time (Santiago)' },
  { value: 'America/Lima', label: 'Peru Time (Lima)' },
  { value: 'America/Bogota', label: 'Colombia Time (Bogotá)' },
  { value: 'America/Caracas', label: 'Venezuela Time (Caracas)' },
];

export const allExampleSignals = [
  {
    title: 'BAYC Floor Price Buy/Sell Signal',
    prompt:
      'Monitor BAYC floor price movements, whale activity, and trading volume. Suggest when to BUY (floor drops 15%+ with strong support) and when to SELL (floor spikes 20%+ on low volume or pre-major unlock).',
    frequency: 'daily',
    time: '09:00',
    timezone: 'UTC',
  },
  {
    title: 'Pudgy Penguins Trading Opportunities',
    prompt:
      'Track Pudgy Penguins floor price, rarity sweeps, and marketplace trends. Alert when to BUY (dips below 10 ETH with high social buzz) and when to SELL (spikes above 15 ETH or before major collection dilution).',
    frequency: 'daily',
    time: '11:00',
    timezone: 'America/New_York',
  },
  {
    title: 'Azuki Buy Low Sell High Alert',
    prompt:
      'Analyze Azuki collection floor trends, trait floor gaps, and liquidity depth. Signal when to BUY (sub-10 ETH with founder activity) and when to SELL (pumps on hype without utility announcements).',
    frequency: 'daily',
    time: '08:30',
    timezone: 'Asia/Tokyo',
  },
  {
    title: 'Milady Maker Momentum Trades',
    prompt:
      'Watch Milady floor volatility, memecoin correlations, and social sentiment spikes. Recommend BUY signals (dips with meme revival) and SELL signals (parabolic pumps or founder controversy).',
    frequency: 'daily',
    time: '13:00',
    timezone: 'Europe/London',
  },
  {
    title: 'DeGods Trading Strategy',
    prompt:
      'Monitor DeGods floor price, migration updates, and whale accumulation. Flag when to BUY (bridge discounts or pre-major partnerships) and when to SELL (post-airdrop pumps or team exits).',
    frequency: 'daily',
    time: '10:00',
    timezone: 'America/Los_Angeles',
  },
  {
    title: 'CryptoPunks Entry/Exit Points',
    prompt:
      'Track CryptoPunks floor, trait premium shifts, and institutional buying. Indicate when to BUY (blue chip dip below 30 ETH) and when to SELL (hype-driven rallies or pre-ETH2 uncertainty).',
    frequency: 'daily',
    time: '07:30',
    timezone: 'UTC',
  },
  {
    title: 'Bored Ape Kennel Club Flip Signals',
    prompt:
      'Analyze BAKC floor vs BAYC correlation and companion demand. Alert when to BUY (BAKC underpriced vs BAYC holders) and when to SELL (overpriced relative to utility or staking changes).',
    frequency: 'daily',
    time: '15:00',
    timezone: 'Asia/Singapore',
  },
  {
    title: 'CloneX Buy/Sell Momentum',
    prompt:
      'Monitor CloneX floor, RTFKT collab news, and Nike Web3 drops. Signal when to BUY (Nike partnership teasers) and when to SELL (post-announcement dumps or metaverse saturation).',
    frequency: 'daily',
    time: '12:00',
    timezone: 'America/Chicago',
  },
  {
    title: 'Doodles Collection Trading Guide',
    prompt:
      'Watch Doodles floor trends, brand expansion news, and marketplace velocity. Recommend when to BUY (pre-major brand deals) and when to SELL (post-hype cooldowns or team pivots).',
    frequency: 'daily',
    time: '18:00',
    timezone: 'America/New_York',
  },
  {
    title: 'Weekly Blue Chip NFT Portfolio Rebalance',
    prompt:
      'Review BAYC, CryptoPunks, Azuki, and Pudgy Penguins for weekly buy/sell recommendations. Highlight undervalued gems to BUY and overheated assets to SELL based on volume, floor trends, and upcoming catalysts.',
    frequency: 'weekly',
    time: '09:00',
    timezone: 'UTC',
    dayOfWeek: '1', // Monday
  },
  {
    title: 'Weekly Mid-Tier NFT Swing Trades',
    prompt:
      'Scan mid-cap NFTs (0.5-5 ETH floor) for swing trade setups. Flag collections to BUY on dips with strong communities and SELL on 2x+ pumps or before utility letdowns.',
    frequency: 'weekly',
    time: '10:00',
    timezone: 'America/Los_Angeles',
    dayOfWeek: '2', // Tuesday
  },
  {
    title: 'Weekly NFT Whale Wallet Signals',
    prompt:
      'Track top NFT whale wallets for accumulation and distribution patterns. Alert when whales BUY specific collections (bullish) and when they SELL large positions (bearish exit signal).',
    frequency: 'weekly',
    time: '14:00',
    timezone: 'Europe/Paris',
    dayOfWeek: '3', // Wednesday
  },
  {
    title: 'Weekly NFT Derivative & Rental Plays',
    prompt:
      'Monitor NFT lending protocols, rental markets, and floor-backed derivatives. Suggest when to BUY floor NFTs for rental yield and when to SELL before liquidation cascades.',
    frequency: 'weekly',
    time: '11:00',
    timezone: 'Asia/Hong_Kong',
    dayOfWeek: '4', // Thursday
  },
  {
    title: 'Weekly New NFT Mint Buy/Avoid Guide',
    prompt:
      'Evaluate upcoming NFT mints for team credibility, roadmap substance, and hype levels. Recommend which to BUY at mint and which to AVOID or wait for post-mint floor.',
    frequency: 'weekly',
    time: '16:00',
    timezone: 'America/New_York',
    dayOfWeek: '5', // Friday
  },
  {
    title: 'Weekly NFT Market Sentiment Gauge',
    prompt:
      'Analyze overall NFT market sentiment via ETH price, trading volumes, and social buzz. Provide macro BUY signals (oversold bear market) and SELL signals (euphoric tops or liquidity exits).',
    frequency: 'weekly',
    time: '12:00',
    timezone: 'UTC',
    dayOfWeek: '0', // Sunday
  },
];

// Function to get 3 random examples using Fisher-Yates shuffle
export function getRandomExamples(count: number = 3) {
  const shuffled = [...allExampleSignals];

  // Fisher-Yates shuffle algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

// For backward compatibility, export a default set of examples
export const exampleSignals = getRandomExamples(3);

export const SIGNAL_LIMITS = {
  TOTAL_SIGNALS: 10,
  DAILY_SIGNALS: 5,
} as const;

export const DEFAULT_FORM_VALUES = {
  FREQUENCY: 'daily',
  TIME: '09:00',
  TIMEZONE: 'UTC',
  DAY_OF_WEEK: '0', // Sunday
} as const;

export const dayOfWeekOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];
