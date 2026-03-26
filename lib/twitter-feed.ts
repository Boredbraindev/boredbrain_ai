/**
 * Crypto KOL Twitter Feed
 *
 * Fetches recent tweets from crypto influencers using fxtwitter.com API
 * and Nitter RSS as fallback. No authentication required.
 *
 * Generates debate topic candidates from KOL opinions and calls.
 * Results are cached for 15 minutes.
 */

import type { TopicCandidate } from '@/lib/nft-feed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRYPTO_KOLS = [
  { handle: 'VitalikButerin', name: 'Vitalik Buterin', category: 'crypto' },
  { handle: 'caboredape', name: 'Bored Ape', category: 'nft' },
  { handle: 'punk6529', name: '6529', category: 'nft' },
  { handle: 'CryptoCobie', name: 'Cobie', category: 'crypto' },
  { handle: 'inversebrah', name: 'inversebrah', category: 'defi' },
  { handle: 'zachxbt', name: 'ZachXBT', category: 'crypto' },
  { handle: 'AltcoinGordon', name: 'Altcoin Gordon', category: 'crypto' },
  { handle: 'BoredElonMusk', name: 'Bored Elon', category: 'culture' },
];

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
];

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let kolCache: { topics: TopicCandidate[]; fetchedAt: number } | null = null;

const FETCH_TIMEOUT_MS = 5000;

// Token patterns to detect bullish/bearish mentions
const TOKEN_PATTERN = /\$([A-Z]{2,10})\b/g;
const BULLISH_WORDS = ['bullish', 'moon', 'pump', 'buy', 'accumulate', 'long', 'breakout', 'undervalued', 'gem'];
const BEARISH_WORDS = ['bearish', 'dump', 'sell', 'short', 'overvalued', 'top', 'crash', 'rug'];

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface KOLTweet {
  handle: string;
  name: string;
  category: string;
  text: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createAbortController(): { controller: AbortController; timeout: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return { controller, timeout };
}

/**
 * Try fetching recent tweets via Twitter syndication embed API.
 * This is the most reliable free method — returns actual tweet text.
 */
async function fetchViaSyndication(handle: string): Promise<string[]> {
  const { controller, timeout } = createAbortController();
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];

    const html = await res.text();
    // Extract tweet text from "text":"..." patterns in embedded JSON
    const matches = Array.from(html.matchAll(/"text":"((?:[^"\\]|\\.)*)"/g));
    return matches
      .map(m => m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').trim())
      .filter(text => text.length > 20 && !text.startsWith('RT @'))
      .slice(0, 5);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

/**
 * Try fetching recent tweets via Nitter RSS (multiple instances as fallback).
 */
async function fetchViaNitterRSS(handle: string): Promise<string[]> {
  for (const instance of NITTER_INSTANCES) {
    const { controller, timeout } = createAbortController();
    try {
      const res = await fetch(`${instance}/${handle}/rss`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const xml = await res.text();

      // Simple XML parsing for RSS <item><title> and <description> tags
      const items: string[] = [];
      const descMatches = Array.from(xml.matchAll(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/g));
      for (const match of descMatches) {
        // Strip HTML tags
        const text = match[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();

        if (text.length > 20) {
          items.push(text);
        }
        if (items.length >= 5) break;
      }

      if (items.length > 0) return items;
    } catch {
      clearTimeout(timeout);
      // Try next Nitter instance
    }
  }

  return [];
}

/**
 * Fetch tweets for a single KOL using multiple approaches.
 */
async function fetchKOLTweets(kol: typeof CRYPTO_KOLS[number]): Promise<KOLTweet[]> {
  // Try syndication first (most reliable)
  let tweets = await fetchViaSyndication(kol.handle);

  // Fallback to Nitter RSS
  if (tweets.length === 0) {
    tweets = await fetchViaNitterRSS(kol.handle);
  }

  return tweets.map((text) => ({
    handle: kol.handle,
    name: kol.name,
    category: kol.category,
    text,
    timestamp: new Date().toISOString(),
  }));
}

function detectSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = text.toLowerCase();
  const bullishCount = BULLISH_WORDS.filter((w) => lower.includes(w)).length;
  const bearishCount = BEARISH_WORDS.filter((w) => lower.includes(w)).length;
  if (bullishCount > bearishCount) return 'bullish';
  if (bearishCount > bullishCount) return 'bearish';
  return 'neutral';
}

function extractTokenMentions(text: string): string[] {
  const matches = Array.from(text.matchAll(TOKEN_PATTERN));
  const tokens = new Set<string>();
  for (const match of matches) {
    tokens.add(match[1]);
  }
  return Array.from(tokens);
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function generateTopicFromTweet(tweet: KOLTweet): TopicCandidate | null {
  const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const slug = `kol-${tweet.handle}-${Date.now()}`;
  const tokens = extractTokenMentions(tweet.text);
  const sentiment = detectSentiment(tweet.text);

  // If tweet mentions a specific token and has sentiment, generate a "follow the alpha" topic
  if (tokens.length > 0 && sentiment !== 'neutral') {
    const token = tokens[0];
    const direction = sentiment === 'bullish' ? 'bullish' : 'bearish';

    return {
      title: `${tweet.name} is ${direction} on $${token} — follow the alpha?`,
      category: tweet.category,
      source: 'twitter',
      outcomes: [
        { label: 'Follow the call', price: 0.55 },
        { label: 'Fade it', price: 0.45 },
      ],
      imageUrl: '',
      slug,
      endDate,
      volumeRaw: 0,
    };
  }

  // General opinion topic
  const excerpt = truncateText(tweet.text, 120);
  return {
    title: `${tweet.name} says: "${excerpt}" — agree?`,
    category: tweet.category,
    source: 'twitter',
    outcomes: [
      { label: 'Agree', price: 0.5 },
      { label: 'Disagree', price: 0.5 },
    ],
    imageUrl: '',
    slug,
    endDate,
    volumeRaw: 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch recent tweets from crypto KOLs and generate debate topic candidates.
 *
 * Results are cached for 15 minutes. Returns empty array on failure.
 */
export async function fetchKOLTopics(limit = 5): Promise<TopicCandidate[]> {
  // Check cache
  if (kolCache && Date.now() - kolCache.fetchedAt < CACHE_TTL_MS) {
    return kolCache.topics.slice(0, limit);
  }

  try {
    // Fetch tweets from all KOLs in parallel
    const results = await Promise.allSettled(
      CRYPTO_KOLS.map((kol) => fetchKOLTweets(kol)),
    );

    const allTweets: KOLTweet[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        // Take just the first (most recent) tweet per KOL
        allTweets.push(result.value[0]);
      }
    }

    // Generate topics from tweets
    const topics: TopicCandidate[] = [];
    for (const tweet of allTweets) {
      const topic = generateTopicFromTweet(tweet);
      if (topic) {
        topics.push(topic);
      }
    }

    // Update cache
    kolCache = { topics, fetchedAt: Date.now() };

    return topics.slice(0, limit);
  } catch (err) {
    console.error('[twitter-feed] Failed to fetch KOL topics:', err);
    return kolCache?.topics.slice(0, limit) ?? [];
  }
}
