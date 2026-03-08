/**
 * Time-based showcase data growth utility.
 *
 * Makes mock data feel alive by applying deterministic, time-seeded
 * increments so numbers grow slightly on each page refresh.
 *
 * Growth is based on minutes since a fixed epoch (2026-03-01 00:00 UTC).
 * Every "tick" (1 minute) adds a small random-but-deterministic increment.
 */

const EPOCH = new Date('2026-03-01T00:00:00Z').getTime();

/** Minutes elapsed since the growth epoch. */
function minutesSinceEpoch(): number {
  return Math.floor((Date.now() - EPOCH) / 60_000);
}

/**
 * Simple deterministic hash for seeding — returns 0..1 for a given key+tick.
 */
function seededRandom(key: string, tick: number): number {
  let h = 0;
  const s = `${key}-${tick}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 10000) / 10000;
}

/**
 * Grow an integer value over time.
 *
 * @param base       The baseline value (what you'd hard-code).
 * @param key        A unique string to seed this particular counter.
 * @param ratePerHr  Average growth per hour (e.g. 12 means ~12/hr).
 * @returns          The grown value (always >= base).
 */
export function growInt(base: number, key: string, ratePerHr: number = 10): number {
  const ticks = minutesSinceEpoch();
  if (ticks <= 0) return base;

  // Accumulate growth: each minute adds ratePerHr/60 * random(0.3..1.7)
  const perMinute = ratePerHr / 60;
  // Instead of looping every minute (too slow), use aggregate formula
  const fullHours = ticks / 60;
  const baseGrowth = Math.floor(fullHours * ratePerHr);

  // Add per-minute jitter for the current hour
  const currentMinute = ticks % 60;
  let jitter = 0;
  for (let m = 0; m < currentMinute; m++) {
    jitter += seededRandom(key, ticks - m) > 0.3 ? 1 : 0;
  }

  // Scale jitter to rate
  const minuteGrowth = Math.floor(jitter * perMinute);

  return base + baseGrowth + minuteGrowth;
}

/**
 * Grow a float/currency value over time.
 */
export function growFloat(base: number, key: string, ratePerHr: number = 100): number {
  const ticks = minutesSinceEpoch();
  if (ticks <= 0) return base;

  const fullHours = ticks / 60;
  const baseGrowth = fullHours * ratePerHr;

  // Add small per-minute variance
  const variance = seededRandom(key, ticks) * ratePerHr * 0.02;

  return Math.round((base + baseGrowth + variance) * 100) / 100;
}

/**
 * Generate a recent timestamp that feels "just happened".
 * Returns an ISO string within the last `withinMinutes`.
 */
export function recentTimestamp(key: string, withinMinutes: number = 5): string {
  const tick = minutesSinceEpoch();
  const minutesAgo = Math.floor(seededRandom(key, tick) * withinMinutes);
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}
