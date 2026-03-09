/**
 * Web Search Integration for Agent Executor
 *
 * Standalone web search tool using Tavily API with raw fetch().
 * Returns mock results when TAVILY_API_KEY is not configured.
 */

import { serverEnv } from '@/env/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function mockSearchResults(query: string, maxResults: number = 5) {
  const mockResults = [
    {
      title: `Search result for: ${query}`,
      url: `https://example.com/search?q=${encodeURIComponent(query)}`,
      content: `This is a simulated search result for the query "${query}". Configure TAVILY_API_KEY for real web search results.`,
      score: 0.95,
    },
    {
      title: `${query} - Wikipedia`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
      content: `Wikipedia article about ${query}. This is a simulated result.`,
      score: 0.88,
    },
    {
      title: `Latest news about ${query}`,
      url: `https://news.example.com/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}`,
      content: `Recent developments and news regarding ${query}. Simulated search result.`,
      score: 0.82,
    },
    {
      title: `${query} Analysis and Insights`,
      url: `https://analysis.example.com/${encodeURIComponent(query.toLowerCase())}`,
      content: `In-depth analysis of ${query} with market data and expert commentary. Simulated.`,
      score: 0.76,
    },
    {
      title: `Understanding ${query} - Complete Guide`,
      url: `https://guide.example.com/${encodeURIComponent(query.toLowerCase())}`,
      content: `A comprehensive guide to understanding ${query} and its implications. Simulated.`,
      score: 0.71,
    },
  ];

  return {
    success: true,
    simulated: true,
    query,
    results: mockResults.slice(0, maxResults),
    totalResults: mockResults.length,
    source: 'Tavily Search (simulated)',
    note: 'Configure TAVILY_API_KEY environment variable for real search results.',
  };
}

// ---------------------------------------------------------------------------
// Real API call
// ---------------------------------------------------------------------------

/**
 * Execute a web search using the Tavily API.
 */
export async function executeWebSearch(args: {
  query: string;
  maxResults?: number;
  topic?: string;
}): Promise<unknown> {
  const { query, maxResults = 5, topic = 'general' } = args;
  const apiKey = serverEnv.TAVILY_API_KEY;

  if (!apiKey) {
    console.log('[web-search] No TAVILY_API_KEY, returning mock results');
    return mockSearchResults(query, maxResults);
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        topic: topic === 'news' ? 'news' : 'general',
        search_depth: 'basic',
        include_answer: true,
        include_images: false,
        days: topic === 'news' ? 7 : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    const results = (data.results ?? []).map((r: any) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: (r.content ?? '').slice(0, 1000),
      score: r.score ?? 0,
      published_date: r.published_date ?? undefined,
    }));

    return {
      success: true,
      simulated: false,
      query,
      answer: data.answer ?? null,
      results,
      totalResults: results.length,
      source: 'Tavily Search',
    };
  } catch (error) {
    console.error('[web-search] Tavily API error:', error);

    // Fall back to mock on error
    const mock = mockSearchResults(query, maxResults);
    return {
      ...mock,
      _error: error instanceof Error ? error.message : 'API call failed',
    };
  }
}
