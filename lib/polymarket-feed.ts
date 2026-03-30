/**
 * Polymarket Trending Topics Feed
 *
 * Fetches trending discourse topics from Polymarket's public Gamma API.
 * No authentication required — all endpoints are public.
 *
 * Legal note: We use "topic", "discourse", "consensus", "support", "insight" terminology.
 * Never "prediction market", "bet", "odds", "gambling", "wager", or "payout".
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAMMA_API = 'https://gamma-api.polymarket.com';

/** Cache trending topics for 5 minutes to avoid hammering the API */
let topicCache: { topics: TrendingTopic[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendingTopic {
  id: string;
  title: string;
  category: string;
  outcomes: string[];
  percentages: number[];
  /** Structured outcomes with labels and prices (0-1 range) for multi-outcome markets */
  outcomesWithPrices: Array<{label: string; price: number}>;
  volume: string;
  volumeRaw: number;
  endDate: string;
  imageUrl?: string;
  /** Polymarket event slug for linking back */
  slug?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseVolume(vol: number | string | undefined): { display: string; raw: number } {
  const raw = typeof vol === 'string' ? parseFloat(vol) : (vol ?? 0);
  if (raw >= 1_000_000) {
    return { display: `${(raw / 1_000_000).toFixed(1)}M Vol`, raw };
  }
  if (raw >= 1_000) {
    return { display: `${(raw / 1_000).toFixed(0)}K Vol`, raw };
  }
  return { display: `${raw.toFixed(0)} Vol`, raw };
}

function extractCategory(tags: unknown): string {
  if (!tags) return 'General';
  const rawList = Array.isArray(tags) ? tags : [tags];
  // Flatten: handle objects with name/label/slug fields, or plain strings
  const tagList: string[] = rawList.map((t: unknown) => {
    if (typeof t === 'string') return t;
    if (t && typeof t === 'object') {
      const obj = t as Record<string, unknown>;
      return String(obj.label ?? obj.name ?? obj.slug ?? obj.value ?? '');
    }
    return String(t ?? '');
  }).filter(Boolean);
  // Common Polymarket categories
  const known = [
    'Politics', 'Crypto', 'Sports', 'Science', 'Economics',
    'Technology', 'Entertainment', 'Culture', 'Business', 'Climate',
    'AI', 'Elections', 'Geopolitics', 'Finance', 'Health',
  ];
  for (const t of tagList) {
    const match = known.find((k) => k.toLowerCase() === t.toLowerCase());
    if (match) return match;
  }
  return tagList[0] || 'General';
}

/**
 * Parse a single Polymarket event into our TrendingTopic format.
 * Events can contain multiple markets (outcomes).
 */
function parseEvent(event: any): TrendingTopic | null {
  try {
    const markets = event.markets ?? [];
    if (!event.title && markets.length === 0) return null;

    const title = event.title ?? markets[0]?.question ?? 'Unknown Topic';
    const id = event.id ?? event.slug ?? String(Date.now());

    // For binary (Yes/No) events — use the first market
    // For multi-outcome events — each market is an outcome
    let outcomes: string[] = [];
    let percentages: number[] = [];

    if (markets.length === 1) {
      // Binary market
      outcomes = ['Yes', 'No'];
      const outcomePrices = markets[0].outcomePrices;
      if (outcomePrices) {
        const prices = typeof outcomePrices === 'string'
          ? JSON.parse(outcomePrices)
          : outcomePrices;
        if (Array.isArray(prices) && prices.length >= 2) {
          percentages = [
            Math.round(parseFloat(prices[0]) * 100),
            Math.round(parseFloat(prices[1]) * 100),
          ];
        }
      }
      if (percentages.length === 0) {
        const yesPrice = parseFloat(markets[0].bestBid ?? markets[0].lastTradePrice ?? '0.5');
        percentages = [Math.round(yesPrice * 100), Math.round((1 - yesPrice) * 100)];
      }
    } else if (markets.length > 1) {
      // Multi-outcome event
      for (const m of markets) {
        const outcomeName = m.groupItemTitle ?? m.question ?? 'Option';
        outcomes.push(outcomeName);
        const outcomePrices = m.outcomePrices;
        if (outcomePrices) {
          const prices = typeof outcomePrices === 'string'
            ? JSON.parse(outcomePrices)
            : outcomePrices;
          percentages.push(Math.round(parseFloat(prices[0] ?? '0') * 100));
        } else {
          const price = parseFloat(m.bestBid ?? m.lastTradePrice ?? '0');
          percentages.push(Math.round(price * 100));
        }
      }
    } else {
      outcomes = ['Yes', 'No'];
      percentages = [50, 50];
    }

    // Aggregate volume across all markets in the event
    let totalVolume = 0;
    for (const m of markets) {
      totalVolume += parseFloat(m.volume ?? m.volumeNum ?? '0');
    }
    // Fallback to event-level volume
    if (totalVolume === 0 && event.volume) {
      totalVolume = parseFloat(event.volume);
    }

    const { display, raw } = parseVolume(totalVolume);

    const endDate = event.endDate ?? markets[0]?.endDate ?? '';

    // Build structured outcomes with prices (0-1 range)
    const outcomesWithPrices = outcomes.map((label, i) => ({
      label,
      price: percentages[i] != null ? percentages[i] / 100 : 0,
    }));

    const slug = event.slug ?? undefined;

    return {
      id: String(id),
      title,
      category: extractCategory(event.tags ?? event.tag),
      outcomes,
      percentages,
      outcomesWithPrices,
      volume: display,
      volumeRaw: raw,
      endDate,
      imageUrl: event.image ?? event.imageUrl ?? undefined,
      slug,
    };
  } catch (err) {
    console.error('[polymarket-feed] Failed to parse event:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch trending topics from Polymarket's public Gamma API.
 * Results are sorted by volume (highest first).
 */
export async function fetchTrendingTopics(limit = 20, minVolume = 0): Promise<TrendingTopic[]> {
  // Check cache
  if (topicCache && Date.now() - topicCache.fetchedAt < CACHE_TTL_MS) {
    const filtered = minVolume > 0
      ? topicCache.topics.filter((t) => t.volumeRaw >= minVolume)
      : topicCache.topics;
    return filtered.slice(0, limit);
  }

  try {
    // Use volume24hr to get actually TRENDING topics (not all-time volume which always returns elections)
    const url = new URL(`${GAMMA_API}/events`);
    url.searchParams.set('active', 'true');
    url.searchParams.set('closed', 'false');
    url.searchParams.set('limit', String(Math.min(limit * 2, 100)));
    url.searchParams.set('order', 'volume24hr');
    url.searchParams.set('ascending', 'false');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 }, // Next.js ISR: 5 min
    });

    if (!response.ok) {
      console.error(`[polymarket-feed] Gamma API error: ${response.status}`);
      return topicCache?.topics.slice(0, limit) ?? [];
    }

    const data = await response.json();
    const events = Array.isArray(data) ? data : (data.data ?? data.events ?? []);

    const topics: TrendingTopic[] = [];
    // Filter out spam/micro events and topics with too many outcomes
    // Only filter true spam (BO5 esports), keep crypto up/down and other popular markets
    const SPAM_PATTERNS = [
      /BO\d+.*First Stand/i,
      // Filter player performance markets (e.g. "25+ points")
      /\d+\+\s*(points|rebounds|assists)/i,
      // Filter spread/over-under markets
      /spread|over.*under|O\/U|moneyline/i,
      // Filter very short-term markets with specific times
      /\d+:\d+[AP]M/i,
      // Filter repetitive daily markets (daily Bitcoin price, Elon tweets, MrBeast views)
      /Bitcoin above ___/i,
      /Bitcoin price on/i,
      /# of views of.*MrBeast/i,
      /# tweets.*March/i,
      /Elon Musk # tweets/i,
      /Highest temperature in.*on March/i,
    ];
    // "vs" filter: skip individual game matchups but keep tournaments/finals
    const VS_PATTERN = /\bvs\.?\b/i;
    const VS_EXCEPTIONS = /winner|champion|tournament|cup|league|final|playoff|series/i;

    for (const event of events) {
      const parsed = parseEvent(event);
      if (!parsed || parsed.title.length <= 5) continue;
      if (SPAM_PATTERNS.some((p) => p.test(parsed.title))) continue;
      // Filter individual game matchups (Team vs Team) but keep tournaments
      if (VS_PATTERN.test(parsed.title) && !VS_EXCEPTIONS.test(parsed.title)) continue;
      // Filter topics with too many outcomes (e.g. 30+ player sub-markets)
      if (parsed.outcomes.length > 20) continue;
      topics.push(parsed);
    }

    // Sort by volume descending
    topics.sort((a, b) => b.volumeRaw - a.volumeRaw);

    // Update cache
    topicCache = { topics, fetchedAt: Date.now() };

    // Apply minimum volume filter
    const filtered = minVolume > 0
      ? topics.filter((t) => t.volumeRaw >= minVolume)
      : topics;

    return filtered.slice(0, limit);
  } catch (err) {
    console.error('[polymarket-feed] Failed to fetch trending topics:', err);
    return topicCache?.topics.slice(0, limit) ?? [];
  }
}

/**
 * Fetch topics filtered by category/tag.
 */
export async function fetchTopicsByCategory(
  category: string,
  limit = 20,
): Promise<TrendingTopic[]> {
  try {
    const url = new URL(`${GAMMA_API}/events`);
    url.searchParams.set('active', 'true');
    url.searchParams.set('closed', 'false');
    url.searchParams.set('limit', String(Math.min(limit * 2, 100)));
    url.searchParams.set('tag', category);
    url.searchParams.set('order', 'volume');
    url.searchParams.set('ascending', 'false');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(`[polymarket-feed] Category fetch error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const events = Array.isArray(data) ? data : (data.data ?? data.events ?? []);

    const topics: TrendingTopic[] = [];
    for (const event of events) {
      const parsed = parseEvent(event);
      if (parsed) topics.push(parsed);
    }

    topics.sort((a, b) => b.volumeRaw - a.volumeRaw);
    return topics.slice(0, limit);
  } catch (err) {
    console.error('[polymarket-feed] Category fetch failed:', err);
    return [];
  }
}

/**
 * Get the top N trending topics by volume — used as debate topics.
 */
export async function getHotTopics(count = 5): Promise<TrendingTopic[]> {
  const all = await fetchTrendingTopics(count * 2);
  return all.slice(0, count);
}
