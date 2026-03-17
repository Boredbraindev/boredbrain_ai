export const runtime = 'nodejs';
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
import { serverEnv } from '@/env/server';
import { db } from '@/lib/db';
import { topicDebate } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { fetchTrendingTopics, TrendingTopic } from '@/lib/polymarket-feed';
import { fetchKalshiTopics } from '@/lib/kalshi-feed';
import { createTopicDebate } from '@/lib/topic-debate';
import { apiSuccess, apiError } from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// Minimum volume threshold — only collect topics with meaningful activity
// ---------------------------------------------------------------------------
const MIN_VOLUME = 10_000;

// ---------------------------------------------------------------------------
// Auth helper (same pattern as heartbeat)
// ---------------------------------------------------------------------------

function verifyCron(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;

  // Dev mode: allow if CRON_SECRET is not configured
  if (!secret) return true;

  // Vercel cron sends this header automatically
  if (request.headers.get('x-vercel-cron') === '1') return true;

  // QStash sends Upstash-Signature header
  if (request.headers.get('upstash-signature')) return true;

  // Bearer token auth
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }

  // Query param for manual testing
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') === secret) return true;

  return false;
}

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

    // 1. Fetch top 20 trending topics from Polymarket (sorted by volume)
    const topics = await fetchTrendingTopics(20);

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

      // Query existing debates by topic title
      if (titles.length > 0) {
        const titleRows = await Promise.race([
          db
            .select({ topic: topicDebate.topic })
            .from(topicDebate)
            .where(sql`${topicDebate.topic} IN (${sql.join(titles.map(t => sql`${t}`), sql`, `)})`),
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

    // 4. Create new topic debates for non-duplicate topics
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

      // Skip if title already exists
      if (existingTitles.has(topic.title)) {
        skipped++;
        continue;
      }

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
