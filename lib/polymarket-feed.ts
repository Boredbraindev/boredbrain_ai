/**
 * Polymarket Trending Topics Feed
 *
 * Fetches trending discourse topics from Polymarket's public Gamma API.
 * No authentication required — all endpoints are public.
 *
 * Legal note: We use "topic", "discourse", "consensus", "support" terminology.
 * Never "prediction", "bet", "odds", or "gambling".
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
  volume: string;
  volumeRaw: number;
  endDate: string;
  imageUrl?: string;
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

    return {
      id: String(id),
      title,
      category: extractCategory(event.tags ?? event.tag),
      outcomes,
      percentages,
      volume: display,
      volumeRaw: raw,
      endDate,
      imageUrl: event.image ?? event.imageUrl ?? undefined,
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
export async function fetchTrendingTopics(limit = 20): Promise<TrendingTopic[]> {
  // Check cache
  if (topicCache && Date.now() - topicCache.fetchedAt < CACHE_TTL_MS) {
    return topicCache.topics.slice(0, limit);
  }

  try {
    const url = new URL(`${GAMMA_API}/events`);
    url.searchParams.set('active', 'true');
    url.searchParams.set('closed', 'false');
    url.searchParams.set('limit', String(Math.min(limit * 2, 100))); // fetch extra for filtering
    url.searchParams.set('order', 'volume');
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
    for (const event of events) {
      const parsed = parseEvent(event);
      if (parsed && parsed.title.length > 5) {
        topics.push(parsed);
      }
    }

    // Sort by volume descending
    topics.sort((a, b) => b.volumeRaw - a.volumeRaw);

    // Update cache
    topicCache = { topics, fetchedAt: Date.now() };

    return topics.slice(0, limit);
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
