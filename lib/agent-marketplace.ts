/**
 * Agent Marketplace System
 *
 * Provides listing, rating, review, and performance tracking for the
 * AI Agent Marketplace. All data is persisted via Drizzle ORM (PostgreSQL).
 */

import { db } from '@/lib/db';
import { marketplaceListing, agentReview } from '@/lib/db/schema';
import { eq, and, gte, desc, asc, sql, like, or } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentListing {
  agentId: string;
  name: string;
  description: string;
  longDescription: string;
  specialization: string;
  tools: string[];
  pricing: {
    perCall: number; // BBAI per invocation
    subscription: number | null; // monthly BBAI for unlimited
  };
  rating: number; // 0-5
  reviewCount: number;
  totalCalls: number;
  successRate: number; // 0-100%
  avgResponseTime: number; // ms
  featured: boolean;
  verified: boolean;
  createdAt: string;
  tags: string[];
  developer: {
    address: string;
    name: string;
    agentCount: number;
  };
}

export interface AgentReview {
  id: string;
  agentId: string;
  reviewerAddress: string;
  reviewerName: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  helpful: number;
  timestamp: string;
}

export interface AgentPerformance {
  agentId: string;
  period: '24h' | '7d' | '30d';
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgResponseTime: number;
  totalEarned: number;
  uniqueCallers: number;
  topTools: { tool: string; calls: number }[];
  hourlyActivity: { hour: number; calls: number }[];
}

export interface MarketplaceStats {
  totalAgents: number;
  totalCalls: number;
  totalVolume: number;
  avgRating: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a DB row from `marketplaceListing` to the public AgentListing shape. */
function rowToListing(row: typeof marketplaceListing.$inferSelect): AgentListing {
  return {
    agentId: row.agentId,
    name: row.name,
    description: row.description,
    longDescription: row.longDescription ?? '',
    specialization: row.specialization,
    tools: row.tools,
    pricing: row.pricing,
    rating: row.rating,
    reviewCount: row.reviewCount,
    totalCalls: row.totalCalls,
    successRate: row.successRate,
    avgResponseTime: row.avgResponseTime,
    featured: row.featured,
    verified: row.verified,
    createdAt: row.createdAt.toISOString(),
    tags: row.tags,
    developer: row.developer,
  };
}

/** Convert a DB row from `agentReview` to the public AgentReview shape. */
function rowToReview(row: typeof agentReview.$inferSelect): AgentReview {
  return {
    id: row.id,
    agentId: row.agentId,
    reviewerAddress: row.reviewerAddress,
    reviewerName: row.reviewerName,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    helpful: row.helpful,
    timestamp: row.timestamp.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all listings with optional filters.
 */
export async function getListings(filters?: {
  specialization?: string;
  sort?: 'rating' | 'calls' | 'earned';
  featured?: boolean;
  search?: string;
  minRating?: number;
}): Promise<AgentListing[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters?.specialization && filters.specialization !== 'all') {
    conditions.push(
      sql`lower(${marketplaceListing.specialization}) = ${filters.specialization.toLowerCase()}`,
    );
  }

  if (filters?.featured) {
    conditions.push(eq(marketplaceListing.featured, true));
  }

  if (filters?.minRating) {
    conditions.push(gte(marketplaceListing.rating, filters.minRating));
  }

  if (filters?.search) {
    const q = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${marketplaceListing.name}) like ${q}`,
        sql`lower(${marketplaceListing.description}) like ${q}`,
        sql`lower(${marketplaceListing.specialization}) like ${q}`,
        sql`${marketplaceListing.tags}::text ilike ${q}`,
      )!,
    );
  }

  // Determine ordering
  let orderBy;
  if (filters?.sort === 'rating') {
    orderBy = desc(marketplaceListing.rating);
  } else if (filters?.sort === 'calls') {
    orderBy = desc(marketplaceListing.totalCalls);
  } else if (filters?.sort === 'earned') {
    // earned = totalCalls * pricing->>'perCall'
    orderBy = sql`(${marketplaceListing.totalCalls} * (${marketplaceListing.pricing}->>'perCall')::numeric) desc`;
  } else {
    // Default: featured first, then by totalCalls desc
    orderBy = sql`${marketplaceListing.featured} desc, ${marketplaceListing.totalCalls} desc`;
  }

  const rows = await db
    .select()
    .from(marketplaceListing)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy);

  return rows.map(rowToListing);
}

/**
 * Get a single listing by agentId.
 */
export async function getListing(agentId: string): Promise<AgentListing | undefined> {
  const [row] = await db
    .select()
    .from(marketplaceListing)
    .where(eq(marketplaceListing.agentId, agentId))
    .limit(1);

  return row ? rowToListing(row) : undefined;
}

/**
 * Add a review for an agent and update the listing's rating/reviewCount
 * atomically inside a transaction.
 */
export async function addReview(
  agentId: string,
  review: Omit<AgentReview, 'id' | 'agentId' | 'helpful' | 'timestamp'>,
): Promise<AgentReview> {
  return await db.transaction(async (tx) => {
    // Insert the new review
    const [inserted] = await tx
      .insert(agentReview)
      .values({
        agentId,
        reviewerAddress: review.reviewerAddress,
        reviewerName: review.reviewerName,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpful: 0,
      })
      .returning();

    // Recalculate rating from all reviews for this agent
    const [agg] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        avg: sql<number>`round(avg(${agentReview.rating})::numeric, 1)::float`,
      })
      .from(agentReview)
      .where(eq(agentReview.agentId, agentId));

    await tx
      .update(marketplaceListing)
      .set({
        reviewCount: agg.count,
        rating: agg.avg,
      })
      .where(eq(marketplaceListing.agentId, agentId));

    return rowToReview(inserted);
  });
}

/**
 * Get all reviews for an agent, newest first.
 */
export async function getReviews(agentId: string): Promise<AgentReview[]> {
  const rows = await db
    .select()
    .from(agentReview)
    .where(eq(agentReview.agentId, agentId))
    .orderBy(desc(agentReview.timestamp));

  return rows.map(rowToReview);
}

/**
 * Generate performance data for an agent in a given period.
 *
 * Uses actual DB data (listing stats) to derive period-scaled metrics.
 */
export async function getPerformance(
  agentId: string,
  period: '24h' | '7d' | '30d' = '24h',
): Promise<AgentPerformance> {
  const [row] = await db
    .select()
    .from(marketplaceListing)
    .where(eq(marketplaceListing.agentId, agentId))
    .limit(1);

  if (!row) {
    return {
      agentId,
      period,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgResponseTime: 0,
      totalEarned: 0,
      uniqueCallers: 0,
      topTools: [],
      hourlyActivity: [],
    };
  }

  // Scale data based on period
  const periodMultiplier = period === '24h' ? 1 : period === '7d' ? 7 : 30;
  const scaledCalls = Math.floor((row.totalCalls / 30) * periodMultiplier);
  const successfulCalls = Math.floor(scaledCalls * (row.successRate / 100));
  const failedCalls = scaledCalls - successfulCalls;

  // Generate top tools usage from actual tools list
  const topTools = row.tools.map((tool, i) => ({
    tool,
    calls: Math.max(10, Math.floor(scaledCalls / (i + 1.5))),
  }));

  // Generate hourly activity data (24 hours) with deterministic seed from agentId
  const hourlyActivity: { hour: number; calls: number }[] = [];
  // Simple deterministic hash from agentId for reproducible "random" data
  let seed = 0;
  for (let i = 0; i < agentId.length; i++) {
    seed = ((seed << 5) - seed + agentId.charCodeAt(i)) | 0;
  }
  const seededRandom = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  for (let h = 0; h < 24; h++) {
    const baseActivity = h >= 8 && h <= 23 ? 0.8 : 0.3;
    const peakBoost = h >= 14 && h <= 20 ? 0.5 : 0;
    const noise = 0.7 + seededRandom(seed + h) * 0.6;
    const calls = Math.floor(
      (scaledCalls / 24) * (baseActivity + peakBoost) * noise,
    );
    hourlyActivity.push({ hour: h, calls: Math.max(1, calls) });
  }

  return {
    agentId,
    period,
    totalCalls: scaledCalls,
    successfulCalls,
    failedCalls,
    avgResponseTime: row.avgResponseTime,
    totalEarned: Number((scaledCalls * row.pricing.perCall * 0.85).toFixed(2)),
    uniqueCallers: Math.floor(scaledCalls * 0.35),
    topTools,
    hourlyActivity,
  };
}

/**
 * Get marketplace-wide statistics using SQL aggregation.
 */
export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  const [stats] = await db
    .select({
      totalAgents: sql<number>`count(*)::int`,
      totalCalls: sql<number>`coalesce(sum(${marketplaceListing.totalCalls}), 0)::int`,
      totalVolume: sql<number>`coalesce(sum(${marketplaceListing.totalCalls} * (${marketplaceListing.pricing}->>'perCall')::numeric), 0)::float`,
      avgRating: sql<number>`coalesce(round(avg(${marketplaceListing.rating})::numeric, 1)::float, 0)`,
    })
    .from(marketplaceListing);

  return {
    totalAgents: stats.totalAgents,
    totalCalls: stats.totalCalls,
    totalVolume: stats.totalVolume,
    avgRating: stats.avgRating,
  };
}

/**
 * Search agents by query string.
 */
export async function searchAgents(query: string): Promise<AgentListing[]> {
  return getListings({ search: query });
}

/**
 * Get featured agents only.
 */
export async function getFeaturedAgents(): Promise<AgentListing[]> {
  return getListings({ featured: true });
}
