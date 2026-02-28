import { db } from '@/lib/db';
import { apiKey } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from 'ai';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const API_KEY_PREFIX = 'bb_sk_';

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString('hex');
  return `${API_KEY_PREFIX}${random}`;
}

/**
 * Validate an API key and return the associated record
 */
export async function validateApiKey(key: string) {
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const [record] = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.key, key))
    .limit(1);

  if (!record || record.status !== 'active') {
    return null;
  }

  // Update last used timestamp
  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, record.id));

  return record;
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

// Lazy-init Redis for distributed rate limiting
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// In-memory fallback
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for an API key — uses Redis when available, falls back to in-memory.
 */
export async function checkRateLimit(keyId: string, limit: number): Promise<boolean> {
  const r = getRedis();

  if (r) {
    const key = `bb:ratelimit:${keyId}`;
    const current = await r.incr(key);
    if (current === 1) {
      await r.expire(key, 60); // 60-second window
    }
    return current <= limit;
  }

  // Fallback: in-memory
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Authenticate a request using API key
 * Returns the API key record or throws an error response
 */
export async function authenticateRequest(request: Request) {
  const key = extractApiKey(request);

  if (!key) {
    return {
      error: true,
      status: 401,
      body: { error: 'Missing API key. Include it as Bearer token or x-api-key header.' },
    } as const;
  }

  const record = await validateApiKey(key);

  if (!record) {
    return {
      error: true,
      status: 401,
      body: { error: 'Invalid or revoked API key.' },
    } as const;
  }

  if (!(await checkRateLimit(record.id, record.rateLimit ?? 100))) {
    return {
      error: true,
      status: 429,
      body: { error: 'Rate limit exceeded. Try again later.' },
    } as const;
  }

  return { error: false, apiKey: record } as const;
}
