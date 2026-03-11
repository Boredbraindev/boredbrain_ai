// ─── In-Memory Circular Buffer for Betting Activity Feed ───────────
//
// Keeps the last MAX_ENTRIES trades in memory so the global feed
// endpoint can respond instantly without hitting the DB on every request.
// The matching engine should call `addToFeed()` after each trade.

const MAX_ENTRIES = 200;

export interface FeedEntry {
  id: string;
  marketId: string;
  marketTitle: string;
  user: string;        // truncated address: "0xab12...ef34"
  userType: string;    // 'user' | 'agent'
  side: string;        // 'Yes' | 'No'
  amount: number;      // BBAI exchanged
  price: number;       // execution price (1-99)
  shares: number;
  timestamp: string;   // ISO 8601
}

const buffer: FeedEntry[] = [];

/**
 * Add a trade to the in-memory feed.
 * Called by the matching engine after each successful trade.
 */
export function addToFeed(entry: FeedEntry): void {
  buffer.unshift(entry); // newest first
  if (buffer.length > MAX_ENTRIES) {
    buffer.length = MAX_ENTRIES; // trim oldest
  }
}

/**
 * Return recent feed entries.
 *
 * @param limit  Max entries to return (default 30)
 * @param since  ISO timestamp — only return entries newer than this
 */
export function getFeed(limit = 30, since?: string): FeedEntry[] {
  let entries = buffer;

  if (since) {
    const sinceDate = new Date(since).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() > sinceDate);
  }

  return entries.slice(0, limit);
}

/**
 * Return recent feed entries for a specific market.
 */
export function getFeedForMarket(marketId: string, limit = 30): FeedEntry[] {
  return buffer.filter((e) => e.marketId === marketId).slice(0, limit);
}

/**
 * Current size of the feed buffer (useful for diagnostics).
 */
export function getFeedSize(): number {
  return buffer.length;
}
