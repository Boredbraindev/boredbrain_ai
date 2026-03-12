/**
 * Web Crawl Integration for Agent Executor
 *
 * Standalone web crawl tool using Cloudflare Browser Rendering /crawl API.
 * Returns markdown content suitable for LLM consumption.
 * Falls back to an error message when Cloudflare credentials are not configured.
 */

import { serverEnv } from '@/env/server';

const MAX_CONTENT_LENGTH = 4000;

/**
 * Crawl a URL using Cloudflare Browser Rendering and return markdown content.
 */
export async function executeWebCrawl(args: { url: string }): Promise<unknown> {
  const { url } = args;
  const accountId = serverEnv.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = serverEnv.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    console.log('[web-crawl] No CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN configured');
    return {
      success: false,
      url,
      error:
        'Web crawl unavailable. Configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/crawl`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          url,
          scrapeOptions: {
            formats: ['markdown'],
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // The /crawl endpoint returns { success, result } where result contains the crawled data
    const crawlResult = data?.result ?? data;
    const markdown =
      crawlResult?.data?.markdown ??
      crawlResult?.markdown ??
      crawlResult?.content ??
      '';

    const trimmedContent = typeof markdown === 'string' ? markdown.slice(0, MAX_CONTENT_LENGTH) : '';

    return {
      success: true,
      url,
      contentLength: typeof markdown === 'string' ? markdown.length : 0,
      truncated: typeof markdown === 'string' && markdown.length > MAX_CONTENT_LENGTH,
      content: trimmedContent,
      source: 'Cloudflare Browser Rendering',
    };
  } catch (error) {
    console.error('[web-crawl] Cloudflare crawl error:', error);
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Crawl failed',
    };
  }
}
