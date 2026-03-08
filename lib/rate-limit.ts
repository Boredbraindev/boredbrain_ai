/**
 * In-memory sliding window rate limiter.
 *
 * Works without Redis / Upstash -- suitable as a zero-dependency fallback.
 * Each IP gets a window of `windowMs` milliseconds and is allowed up to
 * `maxRequests` hits inside that window.  Expired entries are pruned
 * automatically every `cleanupIntervalMs`.
 *
 * NOTE: Because the store lives in process memory it is per-instance.
 * Behind multiple serverless replicas every instance tracks independently,
 * which is fine for a soft rate-limit / abuse-prevention layer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window (default 60). */
  maxRequests?: number;
  /** Window size in milliseconds (default 60 000 = 1 minute). */
  windowMs?: number;
  /** How often to sweep stale entries in ms (default 60 000). */
  cleanupIntervalMs?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  success: boolean;
  /** How many requests remain in the current window. */
  remaining: number;
  /** Unix-ms timestamp when the current window resets. */
  resetAt: number;
}

// ---------------------------------------------------------------------------
// Sliding-window entry
// ---------------------------------------------------------------------------

interface WindowEntry {
  /** Timestamps (ms) of each request inside the current window. */
  timestamps: number[];
}

// ---------------------------------------------------------------------------
// Global store (shared across all calls in the same process)
// ---------------------------------------------------------------------------

const store = new Map<string, WindowEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number, intervalMs: number) {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove timestamps older than the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, intervalMs);

  // Allow the Node.js process to exit even if the timer is still running.
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// IP extraction helper
// ---------------------------------------------------------------------------

function getIP(request: Request): string {
  // Edge Runtime / Vercel headers
  const forwarded =
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';
  return forwarded;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Check whether a request should be allowed through.
 *
 * ```ts
 * import { rateLimit } from '@/lib/rate-limit';
 *
 * const result = rateLimit(request, { maxRequests: 60, windowMs: 60_000 });
 * if (!result.success) {
 *   return new Response('Too many requests', { status: 429 });
 * }
 * ```
 */
export function rateLimit(
  request: Request,
  config: RateLimitConfig = {},
): RateLimitResult {
  const {
    maxRequests = 60,
    windowMs = 60_000,
    cleanupIntervalMs = 60_000,
  } = config;

  ensureCleanup(windowMs, cleanupIntervalMs);

  const ip = getIP(request);
  const now = Date.now();

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Slide the window: discard timestamps older than windowMs
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    // Oldest surviving timestamp determines when the window resets
    const oldestInWindow = entry.timestamps[0]!;
    return {
      success: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    success: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: entry.timestamps[0]! + windowMs,
  };
}
