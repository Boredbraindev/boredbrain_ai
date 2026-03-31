export const maxDuration = 60;

/**
 * Multi-Source Topic Collector — Hourly Cron
 *
 * Fetches trending/hot topics from Polymarket and Kalshi every hour,
 * filters duplicates, and creates topic_debate entries with full
 * multi-outcome support and source tracking.
 *
 * Idempotent: safe to run multiple times — skips topics already in DB.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { topicDebate } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { fetchTrendingTopics, TrendingTopic } from '@/lib/polymarket-feed';
import { fetchKalshiTopics } from '@/lib/kalshi-feed';
import { fetchNFTTopics } from '@/lib/nft-feed';
import { fetchKOLTopics } from '@/lib/twitter-feed';
import { fetchOnchainTopics } from '@/lib/onchain-feed';
import { createTopicDebate } from '@/lib/topic-debate';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { verifyCron } from '@/lib/verify-cron';

// ---------------------------------------------------------------------------
// Minimum volume threshold — only collect topics with meaningful activity
// ---------------------------------------------------------------------------
const MIN_VOLUME = 10_000;

// ---------------------------------------------------------------------------
// GET /api/topics/collect
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  const collected: string[] = [];
  let skipped = 0;
  const errors: string[] = [];

  try {
    // 0. Clean up existing duplicates: keep the one with most participants, mark others as 'closed'
    //    NEVER delete debates — all data is cumulative/preserved for history
    try {
      await Promise.race([
        db.execute(sql`
          UPDATE topic_debate
          SET status = 'closed'
          WHERE id NOT IN (
            SELECT DISTINCT ON (LOWER(TRIM(topic))) id
            FROM topic_debate
            ORDER BY LOWER(TRIM(topic)), total_participants DESC NULLS LAST, created_at ASC
          )
          AND total_participants = 0
          AND status = 'open'
        `),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 5000),
        ),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cleanup error';
      errors.push(`Duplicate cleanup: ${msg}`);
      // Non-critical — continue with collection
    }

    // 1. Fetch trending topics from Polymarket — volume-based + category-based
    const [trendingResult, ...categoryResults] = await Promise.allSettled([
      fetchTrendingTopics(20),
      ...[
        'politics', 'crypto', 'sports', 'geopolitics', 'culture',
      ].map(cat =>
        import('@/lib/polymarket-feed').then(m => m.fetchTopicsByCategory(cat, 5))
      ),
    ]);

    const topics = trendingResult.status === 'fulfilled' ? trendingResult.value : [];
    // Merge category topics (dedup by slug)
    const seenSlugs = new Set(topics.map(t => t.slug));
    for (const r of categoryResults) {
      if (r.status === 'fulfilled') {
        for (const t of r.value) {
          if (!seenSlugs.has(t.slug)) {
            topics.push(t);
            seenSlugs.add(t.slug);
          }
        }
      }
    }

    // 2. Filter by volume threshold
    const hotTopics = topics.filter((t) => t.volumeRaw >= MIN_VOLUME);

    // 3. Check for duplicates in DB — batch query by slug and title
    const slugs = hotTopics.map((t) => t.slug).filter(Boolean) as string[];
    const titles = hotTopics.map((t) => t.title);

    let existingSlugs = new Set<string>();
    let existingTitles = new Set<string>();

    try {
      // Query existing debates by polymarket_slug
      if (slugs.length > 0) {
        const slugRows = await Promise.race([
          db
            .select({ slug: topicDebate.polymarketSlug })
            .from(topicDebate)
            .where(sql`${topicDebate.polymarketSlug} IN (${sql.join(slugs.map(s => sql`${s}`), sql`, `)})`),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB timeout')), 3000),
          ),
        ]);
        existingSlugs = new Set(slugRows.map((r) => r.slug).filter(Boolean) as string[]);
      }

      // Query existing debates by topic title (only recent open/closed — allow re-creation of old completed topics)
      if (titles.length > 0) {
        const titleRows = await Promise.race([
          db
            .select({ topic: topicDebate.topic })
            .from(topicDebate)
            .where(sql`${topicDebate.topic} IN (${sql.join(titles.map(t => sql`${t}`), sql`, `)}) AND ${topicDebate.status} IN ('open', 'closed') AND ${topicDebate.createdAt} > NOW() - INTERVAL '7 days'`),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB timeout')), 3000),
          ),
        ]);
        existingTitles = new Set(titleRows.map((r) => r.topic));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DB check error';
      errors.push(`Duplicate check: ${msg}`);
      // Continue — we'll try to create and let the DB reject true duplicates
    }

    // 3b. Close existing individual game topics in DB
    try {
      await Promise.race([
        db.execute(sql`
          UPDATE topic_debate
          SET status = 'closed'
          WHERE status = 'open'
            AND topic ~* 'vs\\.?'
            AND topic NOT ILIKE '%Winner%'
            AND topic NOT ILIKE '%Champion%'
            AND topic NOT ILIKE '%Tournament%'
            AND topic NOT ILIKE '%Cup%'
            AND topic NOT ILIKE '%League%'
            AND topic NOT ILIKE '%Final%'
            AND topic NOT ILIKE '%Playoff%'
        `),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 5000),
        ),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cleanup error';
      errors.push(`Game topic cleanup: ${msg}`);
    }

    // 4. Fuzzy dedup — normalize titles to catch date-variant / phrasing-variant duplicates
    //    e.g. "Bitcoin above ___ on March 17?" and "Bitcoin price on March 17?" → same base topic
    function normalizeForDedup(title: string): string {
      return title
        .toLowerCase()
        .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(,?\s*\d{4})?\b/gi, '') // remove dates
        .replace(/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/g, '') // remove MM/DD dates
        .replace(/\b(above|below|over|under|price|on|by|before|after)\b/g, '') // remove common variant words
        .replace(/[_#\-–—?.,!'"]/g, '') // remove punctuation
        .replace(/\s+/g, ' ')
        .trim();
    }

    const seenNormalized = new Set<string>();
    // Pre-populate with existing titles from DB
    for (const t of existingTitles) {
      seenNormalized.add(normalizeForDedup(t));
    }

    // 5. Create new topic debates for non-duplicate topics
    for (const topic of hotTopics) {
      // Skip topics with too many outcomes (individual game sub-markets)
      if (topic.outcomes.length > 20) {
        skipped++;
        continue;
      }
      // Skip if slug already exists
      if (topic.slug && existingSlugs.has(topic.slug)) {
        skipped++;
        continue;
      }

      // Skip if title already exists (exact match)
      if (existingTitles.has(topic.title)) {
        skipped++;
        continue;
      }

      // Skip if normalized title is too similar to an existing/already-collected topic
      const norm = normalizeForDedup(topic.title);
      if (norm.length > 3 && seenNormalized.has(norm)) {
        skipped++;
        continue;
      }
      seenNormalized.add(norm);

      try {
        // Pass Polymarket endDate directly as closesAt — no separate DB update needed
        const result = await createTopicDebate(
          topic.title,
          topic.category.toLowerCase(),
          topic.id,
          topic.imageUrl,
          topic.outcomesWithPrices,
          topic.slug,
          topic.endDate || undefined, // Polymarket endDate → closesAt
          'polymarket',
        );

        collected.push(topic.title);

        // Track the new slug/title so subsequent duplicates in this batch are caught
        if (topic.slug) existingSlugs.add(topic.slug);
        existingTitles.add(topic.title);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Creation error';
        errors.push(`Create "${topic.title.slice(0, 60)}": ${msg}`);
        skipped++;
      }
    }
    // 5. Also collect from Kalshi — diverse topics from a second market source
    try {
      const kalshiTopics = await fetchKalshiTopics(7);

      for (const kt of kalshiTopics) {
        // Skip if title already exists (cross-source duplicate check)
        if (existingTitles.has(kt.title)) {
          skipped++;
          continue;
        }

        // Skip if slug already exists
        if (kt.slug && existingSlugs.has(kt.slug)) {
          skipped++;
          continue;
        }

        try {
          await createTopicDebate(
            kt.title,
            kt.category.toLowerCase(),
            kt.id,          // Kalshi event ticker as event ID
            kt.imageUrl,
            kt.outcomesWithPrices,
            kt.slug,
            kt.endDate || undefined,
            'kalshi',
          );

          collected.push(kt.title);

          if (kt.slug) existingSlugs.add(kt.slug);
          existingTitles.add(kt.title);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Creation error';
          errors.push(`Kalshi create "${kt.title.slice(0, 60)}": ${msg}`);
          skipped++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kalshi fetch error';
      errors.push(`Kalshi: ${msg}`);
      // Non-critical — Polymarket topics already collected
    }

    // 6. Fetch NFT, KOL, and onchain topics in parallel
    //    Wrapped in an 8-second timeout to stay within Vercel's 10s function limit.
    //    If new feeds timeout, we skip them — Polymarket/Kalshi are already collected above.
    try {
      const NEW_FEEDS_TIMEOUT_MS = 8000; // Timeout for secondary feeds — maxDuration is 60s
      const [nftResult, kolResult, onchainResult] = await Promise.race([
        Promise.allSettled([
          fetchNFTTopics(5),
          fetchKOLTopics(5),
          fetchOnchainTopics(3),
        ]),
        new Promise<[PromiseSettledResult<never>, PromiseSettledResult<never>, PromiseSettledResult<never>]>((_, reject) =>
          setTimeout(() => reject(new Error('New feeds timeout (8s) — skipping NFT/KOL/onchain')), NEW_FEEDS_TIMEOUT_MS),
        ),
      ]);

      const newSourceTopics: Array<{ topic: any; sourceName: string }> = [];

      if (nftResult.status === 'fulfilled') {
        for (const t of nftResult.value) {
          newSourceTopics.push({ topic: t, sourceName: 'nft' });
        }
      } else {
        errors.push(`NFT feed: ${nftResult.reason}`);
      }

      if (kolResult.status === 'fulfilled') {
        for (const t of kolResult.value) {
          newSourceTopics.push({ topic: t, sourceName: 'twitter' });
        }
      } else {
        errors.push(`KOL feed: ${kolResult.reason}`);
      }

      if (onchainResult.status === 'fulfilled') {
        for (const t of onchainResult.value) {
          newSourceTopics.push({ topic: t, sourceName: 'onchain' });
        }
      } else {
        errors.push(`Onchain feed: ${onchainResult.reason}`);
      }

      // Create topic debates for each new source topic
      for (const { topic: st, sourceName } of newSourceTopics) {
        // Skip if title already exists (cross-source dedup)
        if (existingTitles.has(st.title)) {
          skipped++;
          continue;
        }

        // Skip if slug already exists
        if (st.slug && existingSlugs.has(st.slug)) {
          skipped++;
          continue;
        }

        // Fuzzy dedup
        const norm = normalizeForDedup(st.title);
        if (norm.length > 3 && seenNormalized.has(norm)) {
          skipped++;
          continue;
        }
        seenNormalized.add(norm);

        try {
          const outcomesWithPrices = st.outcomes ?? [
            { label: 'Yes', price: 0.5 },
            { label: 'No', price: 0.5 },
          ];

          await createTopicDebate(
            st.title,
            (st.category || 'general').toLowerCase(),
            undefined,        // no polymarket event ID
            st.imageUrl || undefined,
            outcomesWithPrices,
            st.slug || undefined,
            st.endDate || undefined,
            sourceName,
          );

          collected.push(st.title);

          if (st.slug) existingSlugs.add(st.slug);
          existingTitles.add(st.title);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Creation error';
          errors.push(`${sourceName} create "${st.title.slice(0, 60)}": ${msg}`);
          skipped++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'New sources error';
      errors.push(`New sources: ${msg}`);
      // Non-critical — primary sources already collected
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Collector error';
    errors.push(`Collector: ${msg}`);
  }

  return apiSuccess({
    collected: collected.length,
    skipped,
    topics: collected,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
