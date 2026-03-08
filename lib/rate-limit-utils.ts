/**
 * Client-safe rate limit utilities.
 * Separated from ai/providers.ts to avoid loading @ai-sdk/openai on the client.
 */

export function shouldBypassRateLimits(_modelValue: string, _user: any): boolean {
  return false;
}
