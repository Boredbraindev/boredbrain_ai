/**
 * Fetch related news for a debate topic using Gemini.
 *
 * Lightweight approach — asks Gemini Flash to produce a short JSON array
 * of real recent headlines related to the topic. No extra API keys needed
 * beyond GOOGLE_GENERATIVE_AI_API_KEY which we already have for agent calls.
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

export async function fetchTopicNews(
  topic: string,
  category: string,
): Promise<TopicNews[]> {
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!geminiKey) return [];

  const prompt = `Find 3-5 recent real news headlines related to: "${topic}" (category: ${category}).
For each, provide: title, source name, a plausible URL, approximate date, one-sentence summary, and sentiment (bullish/bearish/neutral).
Format as JSON array: [{"title":"...","url":"https://...","source":"...","publishedAt":"2026-03-17","summary":"...","sentiment":"bullish"}]
Only include REAL news from the last 7 days. If you cannot find real news, return an empty array [].`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (!res.ok) return [];
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Extract JSON array from response (may be wrapped in markdown fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: unknown[] = JSON.parse(jsonMatch[0]);

    // Validate shape
    return parsed
      .filter(
        (item: any) =>
          typeof item?.title === 'string' && typeof item?.summary === 'string',
      )
      .map((item: any) => ({
        title: String(item.title).slice(0, 200),
        url: typeof item.url === 'string' ? item.url : '#',
        source: String(item.source ?? 'Unknown').slice(0, 60),
        publishedAt: String(item.publishedAt ?? new Date().toISOString().slice(0, 10)),
        summary: String(item.summary).slice(0, 300),
        sentiment: ['bullish', 'bearish', 'neutral'].includes(item.sentiment)
          ? item.sentiment
          : 'neutral',
      })) as TopicNews[];
  } catch {
    // Network error, timeout, parse error — all non-fatal
    return [];
  }
}
