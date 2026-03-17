/**
 * Kalshi Prediction Market Feed
 *
 * Fetches open events from Kalshi's public API across multiple categories.
 * No authentication required for read-only access.
 *
 * Volume data may be 0 from the public API — that is acceptable.
 * The key value is diverse topics from a second market source.
 */

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KalshiTopic {
  id: string;
  title: string;
  category: string;
  outcomes: Array<{ label: string; price: number }>;
  outcomesWithPrices: Array<{ label: string; price: number }>;
  volume: string;
  volumeRaw: number;
  endDate: string;
  source: 'kalshi';
  imageUrl?: string;
  slug?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapKalshiCategory(cat: string): string {
  const map: Record<string, string> = {
    Politics: 'Politics',
    Economics: 'Finance',
    'Climate and Weather': 'Science',
    'Science and Technology': 'Technology',
    World: 'Geopolitics',
  };
  return map[cat] || 'General';
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M Vol`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K Vol`;
  return `${vol} Vol`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch events from multiple Kalshi categories and return as KalshiTopic[].
 * Fails silently per-category so partial results are still returned.
 */
export async function fetchKalshiTopics(limit = 10): Promise<KalshiTopic[]> {
  const categories = [
    'Politics',
    'Economics',
    'Climate and Weather',
    'Science and Technology',
    'World',
  ];
  const allTopics: KalshiTopic[] = [];

  for (const category of categories) {
    try {
      const res = await fetch(
        `${KALSHI_API}/events?limit=5&status=open&with_nested_markets=true&category=${encodeURIComponent(category)}`,
        {
          headers: { Accept: 'application/json' },
          next: { revalidate: 600 },
        },
      );
      if (!res.ok) continue;
      const data = await res.json();

      for (const event of data.events ?? []) {
        const markets = event.markets ?? [];
        if (markets.length === 0) continue;

        // Parse outcomes
        let outcomes: Array<{ label: string; price: number }>;
        if (markets.length === 1) {
          outcomes = [
            { label: 'Yes', price: (markets[0].yes_ask || 50) / 100 },
            { label: 'No', price: (markets[0].no_ask || 50) / 100 },
          ];
        } else {
          // Multi-outcome: yes_sub_title has the actual choice name (e.g. "Matteo Zuppi")
          // title is just the event name repeated for each market
          outcomes = markets.map((m: any) => ({
            label: m.yes_sub_title || m.subtitle || m.title?.replace(event.title, '').trim() || 'Option',
            price: (m.yes_ask || 50) / 100,
          }));
        }

        // Aggregate volume across markets
        let totalVolume = 0;
        for (const m of markets) {
          totalVolume += Number(m.volume ?? 0);
        }
        if (totalVolume === 0 && event.volume) {
          totalVolume = Number(event.volume);
        }

        const ticker = event.event_ticker || event.ticker || String(Date.now());

        allTopics.push({
          id: ticker,
          title: event.title,
          category: mapKalshiCategory(category),
          outcomes,
          outcomesWithPrices: outcomes,
          volume: formatVolume(totalVolume),
          volumeRaw: totalVolume,
          endDate: markets[0]?.close_time || '',
          source: 'kalshi',
          imageUrl: event.image_url || undefined,
          slug: ticker,
        });
      }
    } catch {
      // Category fetch failed — continue to next category
    }
  }

  // Sort by number of outcomes (proxy for popularity) then by volume
  allTopics.sort((a, b) => {
    if (b.outcomes.length !== a.outcomes.length) return b.outcomes.length - a.outcomes.length;
    return b.volumeRaw - a.volumeRaw;
  });

  return allTopics.slice(0, limit);
}
