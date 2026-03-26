/**
 * Fetch related news for a debate topic using Google News RSS.
 *
 * Free, no API key required, returns real articles from real sources
 * (WSJ, Bloomberg, Reuters, AP, etc.).
 *
 * Returns [] on any failure so callers can treat news as optional.
 */

export interface TopicNews {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Extract source name from Google News HTML description.
 * Google News format: "<a href="...">Article Title</a>&nbsp;&nbsp;<font ...>Source Name</font>"
 */
function extractSource(description: string): string {
  const fontMatch = description.match(/<font[^>]*>([^<]+)<\/font>/);
  if (fontMatch) return fontMatch[1].trim();
  // Fallback: try to get last part after dash
  const plain = stripHtml(description);
  const dashIdx = plain.lastIndexOf(' - ');
  if (dashIdx > 0) return plain.slice(dashIdx + 3).trim();
  return 'News';
}

/**
 * Simple sentiment detection from title keywords.
 */
function detectSentiment(title: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = title.toLowerCase();
  const bullish = ['surge', 'soar', 'rally', 'jump', 'gain', 'rise', 'high', 'up', 'bull', 'boom', 'positive', 'win', 'success', 'deal', 'agree', 'peace', 'record'];
  const bearish = ['crash', 'plunge', 'drop', 'fall', 'decline', 'low', 'down', 'bear', 'bust', 'negative', 'fail', 'war', 'attack', 'crisis', 'threat', 'fear', 'concern'];

  const bullCount = bullish.filter(w => lower.includes(w)).length;
  const bearCount = bearish.filter(w => lower.includes(w)).length;

  if (bullCount > bearCount) return 'bullish';
  if (bearCount > bullCount) return 'bearish';
  return 'neutral';
}

/**
 * Format relative time (e.g., "2h ago", "1d ago").
 */
function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return dateStr;
  }
}

/**
 * Build a search query optimized for Google News.
 * Strips question marks, "by...?", date fragments, etc.
 */
function buildSearchQuery(topic: string, category: string): string {
  let q = topic
    .replace(/\?+$/, '')
    .replace(/\b(by|on|before|after)\s*\.{0,3}\s*$/i, '')
    .replace(/[""]/g, '')
    .trim();

  // For very short queries, add category context
  if (q.split(' ').length <= 3 && category) {
    q = `${q} ${category}`;
  }

  return q;
}

export async function fetchTopicNews(
  topic: string,
  category: string,
): Promise<TopicNews[]> {
  try {
    const query = buildSearchQuery(topic, category);
    const encoded = encodeURIComponent(query);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    // Google News RSS — returns XML with real news articles
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encoded}&hl=en&gl=US&ceid=US:en`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BBClaw/1.0)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (!res.ok) return [];

    const xml = await res.text();

    // Parse RSS items manually (no XML parser needed on edge runtime)
    const items: TopicNews[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];

      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);

      if (!titleMatch || !linkMatch) continue;

      const rawTitle = stripHtml(titleMatch[1]);
      const url = linkMatch[1].trim();

      // Skip prediction market sites — we want real news, not our own sources
      const skipDomains = ['polymarket', 'kalshi', 'metaculus', 'predictit', 'manifold.markets', 'boredbrain'];
      const lowerTitle = rawTitle.toLowerCase();
      const lowerUrl = url.toLowerCase();
      if (skipDomains.some(d => lowerUrl.includes(d) || lowerTitle.includes(d))) continue;
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
      const description = descMatch ? descMatch[1] : '';
      const source = extractSource(description);

      items.push({
        title: rawTitle,
        url,
        source,
        publishedAt: pubDate ? formatRelativeTime(pubDate) : 'Recent',
        summary: stripHtml(description).slice(0, 200),
        sentiment: detectSentiment(rawTitle),
      });
    }

    return items;
  } catch {
    // Network error, timeout, parse error — all non-fatal
    return [];
  }
}
