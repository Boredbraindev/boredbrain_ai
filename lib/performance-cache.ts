// Lightweight caching helpers tuned for the Telegram mini app deployment.

import { db } from '@/lib/db';
import { user } from './db/schema';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  accessCount: number;
  lastAccessed: number;
}

class PerformanceCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(private readonly name: string, maxSize: number = 1000, ttlMs: number = 2 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey = '';
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const sessionCache = new PerformanceCache<any>('sessions', 500, 15 * 60 * 1000);
export const usageCountCache = new PerformanceCache<number>('usage-counts', 2000, 5 * 60 * 1000);

export const createSessionKey = (token: string) => `session:${token}`;
export const createMessageCountKey = (userId: string) => `msg-count:${userId}`;
export const createExtremeCountKey = (userId: string) => `extreme-count:${userId}`;

export function extractSessionToken(headers: Headers): string | null {
  const cookies = headers.get('cookie');
  if (!cookies) return null;

  const cookieNames = ['better-auth.session_token', 'better-auth.session_tokens'];

  for (const name of cookieNames) {
    const match = cookies.match(new RegExp(`${name.replace('.', '\\.')}=([^;]+)`));
    if (match) {
      return `${name}:${match[1]}`;
    }
  }

  return null;
}

export function invalidateUserCaches(userId: string) {
  usageCountCache.delete(createMessageCountKey(userId));
  usageCountCache.delete(createExtremeCountKey(userId));
  db.$cache.invalidate({ tables: [user] });
}

export function invalidateAllCaches() {
  sessionCache.clear();
  usageCountCache.clear();
}
