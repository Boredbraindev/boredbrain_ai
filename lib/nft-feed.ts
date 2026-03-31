/**
 * NFT Marketplace Feed — OpenSea & MagicEden
 *
 * Fetches NFT collection stats and generates debate topics based on
 * floor price movements, volume spikes, and holder count changes.
 *
 * No API key required for public data endpoints.
 * Uses 5-minute caching to avoid excessive API calls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicCandidate {
  title: string;
  category: string;
  source: string;
  outcomes: { label: string; price: number }[];
  imageUrl: string;
  slug: string;
  endDate: string;
  volumeRaw: number;
}

interface CollectionStats {
  slug: string;
  name: string;
  image: string;
  floorPrice: number;
  totalVolume: number;
  numOwners: number;
  totalSupply: number;
  oneDayVolume: number;
  oneDayChange: number;
  source: 'opensea' | 'magiceden';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTIONS = [
  { slug: 'bayc', name: 'Bored Ape Yacht Club', image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=300&fit=crop' },
  { slug: 'mutant-ape-yacht-club', name: 'Mutant Ape Yacht Club', image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop' },
  { slug: 'cryptopunks', name: 'CryptoPunks', image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=300&fit=crop' },
  { slug: 'azuki', name: 'Azuki', image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=300&fit=crop' },
  { slug: 'pudgypenguins', name: 'Pudgy Penguins', image: 'https://images.unsplash.com/photo-1551986782-d0169b3f8fa7?w=400&h=300&fit=crop' },
  { slug: 'milady', name: 'Milady Maker', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop' },
  { slug: 'doodles-official', name: 'Doodles', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop' },
  { slug: 'clonex', name: 'CloneX', image: 'https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=400&h=300&fit=crop' },
];

const OPENSEA_API = 'https://api.opensea.io/api/v2/collections';
const MAGICEDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp/ethereum/collections/v7';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let nftCache: { topics: TopicCandidate[]; fetchedAt: number } | null = null;

const FETCH_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createAbortController(): { controller: AbortController; timeout: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return { controller, timeout };
}

async function fetchOpenSeaStats(slug: string): Promise<CollectionStats | null> {
  const { controller, timeout } = createAbortController();
  try {
    const res = await fetch(`${OPENSEA_API}/${slug}/stats`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const stats = data.total ?? data;

    const col = COLLECTIONS.find((c) => c.slug === slug);
    return {
      slug,
      name: col?.name ?? slug,
      image: col?.image ?? '',
      floorPrice: Number(stats.floor_price ?? 0),
      totalVolume: Number(stats.total_volume ?? 0),
      numOwners: Number(stats.num_owners ?? 0),
      totalSupply: Number(stats.total_supply ?? 0),
      oneDayVolume: Number(stats.one_day_volume ?? 0),
      oneDayChange: Number(stats.one_day_change ?? 0),
      source: 'opensea',
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchMagicEdenStats(slug: string): Promise<CollectionStats | null> {
  const { controller, timeout } = createAbortController();
  try {
    const res = await fetch(`${MAGICEDEN_API}?slug=${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const collection = Array.isArray(data.collections) ? data.collections[0] : data;
    if (!collection) return null;

    const col = COLLECTIONS.find((c) => c.slug === slug);
    return {
      slug,
      name: col?.name ?? slug,
      image: col?.image ?? '',
      floorPrice: Number(collection.floorAskPrice ?? collection.floorAsk?.price?.amount?.decimal ?? 0),
      totalVolume: Number(collection.volume?.allTime ?? 0),
      numOwners: Number(collection.ownerCount ?? 0),
      totalSupply: Number(collection.tokenCount ?? 0),
      oneDayVolume: Number(collection.volume?.['1day'] ?? 0),
      oneDayChange: Number(collection.floorSaleChange?.['1day'] ?? 0),
      source: 'magiceden',
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function generateTopicsFromStats(stats: CollectionStats): TopicCandidate[] {
  const topics: TopicCandidate[] = [];
  const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  // Use date-based slug so same collection only creates 1 topic per day
  const dateStr = new Date().toISOString().slice(0, 10);
  const baseSlug = `nft-${stats.slug}-${dateStr}`;

  // Floor price movement topic (>5% change in 24h)
  if (Math.abs(stats.oneDayChange) > 0.05) {
    const direction = stats.oneDayChange > 0 ? 'up' : 'down';
    const pct = Math.abs(Math.round(stats.oneDayChange * 100));

    if (direction === 'down') {
      topics.push({
        title: `${stats.name} floor down ${pct}% this week — bottom or more pain?`,
        category: 'nft',
        source: stats.source,
        outcomes: [
          { label: 'Bottom is in', price: 0.4 },
          { label: 'More pain ahead', price: 0.6 },
        ],
        imageUrl: stats.image,
        slug: `${baseSlug}-floor-drop`,
        endDate,
        volumeRaw: stats.oneDayVolume,
      });
    } else {
      topics.push({
        title: `${stats.name} floor at ${stats.floorPrice.toFixed(2)} ETH — hold or dump?`,
        category: 'nft',
        source: stats.source,
        outcomes: [
          { label: 'Hold', price: 0.55 },
          { label: 'Dump', price: 0.45 },
        ],
        imageUrl: stats.image,
        slug: `${baseSlug}-floor-move`,
        endDate,
        volumeRaw: stats.oneDayVolume,
      });
    }
  }

  // High volume topic
  if (stats.oneDayVolume > 50) {
    topics.push({
      title: `${stats.name} 24h volume ${Math.round(stats.oneDayVolume)} ETH — whale accumulation or exit?`,
      category: 'nft',
      source: stats.source,
      outcomes: [
        { label: 'Accumulation', price: 0.5 },
        { label: 'Exit liquidity', price: 0.5 },
      ],
      imageUrl: '',
      slug: `${baseSlug}-volume`,
      endDate,
      volumeRaw: stats.oneDayVolume,
    });
  }

  // Only generate holder topic if no floor/volume topic was created (1 per collection max)
  if (topics.length === 0 && stats.numOwners > 1000) {
    topics.push({
      title: `${stats.name} holders reach ${stats.numOwners.toLocaleString()} — bullish signal?`,
      category: 'nft',
      source: stats.source,
      outcomes: [
        { label: 'Bullish', price: 0.55 },
        { label: 'Not meaningful', price: 0.45 },
      ],
      imageUrl: '',
      slug: `${baseSlug}-holders`,
      endDate,
      volumeRaw: stats.totalVolume,
    });
  }

  // Fallback: always generate at least one topic if we have floor price data
  if (topics.length === 0 && stats.floorPrice > 0) {
    topics.push({
      title: `${stats.name} floor at ${stats.floorPrice.toFixed(2)} ETH — hold or dump?`,
      category: 'nft',
      source: stats.source,
      outcomes: [
        { label: 'Hold', price: 0.55 },
        { label: 'Dump', price: 0.45 },
      ],
      imageUrl: '',
      slug: `${baseSlug}-general`,
      endDate,
      volumeRaw: stats.oneDayVolume || stats.totalVolume,
    });
  }

  return topics;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch NFT collection data from OpenSea and MagicEden, then generate
 * debate topic candidates based on floor price movements and volume.
 *
 * Results are cached for 5 minutes. Returns empty array on failure.
 */
export async function fetchNFTTopics(limit = 5): Promise<TopicCandidate[]> {
  // Check cache
  if (nftCache && Date.now() - nftCache.fetchedAt < CACHE_TTL_MS) {
    return nftCache.topics.slice(0, limit);
  }

  try {
    const allTopics: TopicCandidate[] = [];

    // Fetch stats for all collections in parallel — OpenSea first, MagicEden as fallback
    const results = await Promise.allSettled(
      COLLECTIONS.map(async (col) => {
        // Try OpenSea first
        let stats = await fetchOpenSeaStats(col.slug);
        // Fallback to MagicEden
        if (!stats) {
          stats = await fetchMagicEdenStats(col.slug);
        }
        return stats;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const topics = generateTopicsFromStats(result.value);
        allTopics.push(...topics);
      }
    }

    // Sort by volume descending
    allTopics.sort((a, b) => b.volumeRaw - a.volumeRaw);

    // Update cache
    nftCache = { topics: allTopics, fetchedAt: Date.now() };

    return allTopics.slice(0, limit);
  } catch (err) {
    console.error('[nft-feed] Failed to fetch NFT topics:', err);
    return nftCache?.topics.slice(0, limit) ?? [];
  }
}
