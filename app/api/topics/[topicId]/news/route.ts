export const runtime = 'edge';

/**
 * GET /api/topics/[topicId]/news
 *
 * Returns related news articles for a debate topic.
 * Uses Gemini Flash to find/summarize recent headlines.
 * Cached for 30 minutes via Cache-Control headers so repeated
 * views of the same debate don't re-call the LLM.
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { fetchTopicNews } from '@/lib/topic-news';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { success: true, news: [] },
      { headers: cacheHeaders() },
    );
  }

  try {
    const { topicId } = await params;
    const sql = neon(dbUrl);

    // Fetch the debate topic and category
    const rows = await sql`
      SELECT topic, category FROM topic_debate WHERE id = ${topicId} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debate not found' },
        { status: 404 },
      );
    }

    const { topic, category } = rows[0];

    // Fetch news (non-blocking failure — returns [] on error)
    const news = await fetchTopicNews(topic, category);

    return NextResponse.json(
      { success: true, news },
      { headers: cacheHeaders() },
    );
  } catch (err) {
    console.error('[api/topics/[topicId]/news] GET error:', err);
    // Return empty news on failure — feature is optional
    return NextResponse.json(
      { success: true, news: [] },
      { headers: cacheHeaders() },
    );
  }
}

function cacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
  };
}
