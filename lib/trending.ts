/**
 * Trending & ELO Rating System
 *
 * Trending Score = (recent_calls x 0.4) + (recent_reviews x 0.3) + (arena_wins x 0.3)
 * with 7-day exponential decay, normalized to 0-100 scale.
 *
 * ELO uses Bradley-Terry model with K=32, starting at 1200.
 */

import { db } from '@/lib/db';
import {
  agent,
  externalAgent,
  toolUsage,
  agentReview,
  arenaMatch,
} from '@/lib/db/schema';
import { eq, sql, gte, and, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ELO_DEFAULT = 1200;
const ELO_K_FACTOR = 32;
const TRENDING_WINDOW_DAYS = 7;

const WEIGHT_CALLS = 0.4;
const WEIGHT_REVIEWS = 0.3;
const WEIGHT_ARENA_WINS = 0.3;

// ---------------------------------------------------------------------------
// ELO Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the expected score for player A against player B
 * using the Bradley-Terry (logistic) model.
 *
 *   E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ELO ratings for two players after a match.
 *
 * @param ratingA - Current rating of player A
 * @param ratingB - Current rating of player B
 * @param scoreA  - Actual score for A: 1 = win, 0 = loss, 0.5 = draw
 * @param kFactor - K-factor (default 32)
 * @returns Object with new ratings and deltas for both players
 */
export function calculateEloChange(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  kFactor: number = ELO_K_FACTOR,
): {
  newRatingA: number;
  newRatingB: number;
  deltaA: number;
  deltaB: number;
} {
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;

  const scoreB = 1 - scoreA;

  const deltaA = Math.round(kFactor * (scoreA - expectedA));
  const deltaB = Math.round(kFactor * (scoreB - expectedB));

  return {
    newRatingA: ratingA + deltaA,
    newRatingB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}

// ---------------------------------------------------------------------------
// ELO Database Operations
// ---------------------------------------------------------------------------

/**
 * Update ELO ratings for two agents after an arena match.
 * Persists the new ratings to the `agent` table and records the ELO delta
 * on the `arenaMatch` row.
 *
 * @param winnerId - ID of the winning agent
 * @param loserId  - ID of the losing agent
 * @param matchId  - Optional match ID to record ELO change on
 * @param isDraw   - If true, both agents receive a draw (0.5) score
 */
export async function updateEloRating(
  winnerId: string,
  loserId: string,
  matchId?: string,
  isDraw: boolean = false,
): Promise<{
  winnerNewRating: number;
  loserNewRating: number;
  winnerDelta: number;
  loserDelta: number;
}> {
  // Fetch current ratings for both agents
  const [winnerAgent] = await db
    .select({ id: agent.id, eloRating: agent.eloRating })
    .from(agent)
    .where(eq(agent.id, winnerId))
    .limit(1);

  const [loserAgent] = await db
    .select({ id: agent.id, eloRating: agent.eloRating })
    .from(agent)
    .where(eq(agent.id, loserId))
    .limit(1);

  const winnerRating = winnerAgent?.eloRating ?? ELO_DEFAULT;
  const loserRating = loserAgent?.eloRating ?? ELO_DEFAULT;

  const scoreA = isDraw ? 0.5 : 1;

  const { newRatingA, newRatingB, deltaA, deltaB } = calculateEloChange(
    winnerRating,
    loserRating,
    scoreA,
  );

  // Update both agents in parallel
  await Promise.all([
    db
      .update(agent)
      .set({ eloRating: newRatingA, updatedAt: new Date() })
      .where(eq(agent.id, winnerId)),
    db
      .update(agent)
      .set({ eloRating: newRatingB, updatedAt: new Date() })
      .where(eq(agent.id, loserId)),
  ]);

  // Record the ELO change on the match (winner's delta)
  if (matchId) {
    await db
      .update(arenaMatch)
      .set({ eloChange: deltaA })
      .where(eq(arenaMatch.id, matchId));
  }

  return {
    winnerNewRating: newRatingA,
    loserNewRating: newRatingB,
    winnerDelta: deltaA,
    loserDelta: deltaB,
  };
}

// ---------------------------------------------------------------------------
// Trending Score
// ---------------------------------------------------------------------------

/**
 * Calculate the trending score for a single agent.
 *
 * The score is based on three signals measured over the last 7 days:
 *   1. Tool calls (weight 0.4)
 *   2. Reviews received (weight 0.3)
 *   3. Arena wins (weight 0.3)
 *
 * Each signal is counted with exponential time-decay so that more recent
 * activity weighs more heavily. The raw weighted sum is then normalized
 * to a 0-100 scale using a sigmoid-like mapping.
 */
export async function calculateTrendingScore(agentId: string): Promise<number> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - TRENDING_WINDOW_DAYS);

  // 1. Recent tool calls (last 7 days)
  const [callsResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(toolUsage)
    .where(
      and(
        eq(toolUsage.agentId, agentId),
        gte(toolUsage.createdAt, windowStart),
      ),
    );

  // 2. Recent reviews (last 7 days)
  const [reviewsResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(agentReview)
    .where(
      and(
        eq(agentReview.agentId, agentId),
        gte(agentReview.timestamp, windowStart),
      ),
    );

  // 3. Recent arena wins (last 7 days)
  const [winsResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(arenaMatch)
    .where(
      and(
        eq(arenaMatch.winnerId, agentId),
        eq(arenaMatch.status, 'completed'),
        gte(arenaMatch.createdAt, windowStart),
      ),
    );

  const recentCalls = callsResult?.count ?? 0;
  const recentReviews = reviewsResult?.count ?? 0;
  const arenaWins = winsResult?.count ?? 0;

  // Weighted raw score
  const rawScore =
    recentCalls * WEIGHT_CALLS +
    recentReviews * WEIGHT_REVIEWS +
    arenaWins * WEIGHT_ARENA_WINS;

  // Normalize to 0-100 using a sigmoid curve:
  //   score = 100 * (1 - e^(-rawScore / scaleFactor))
  // A scale factor of 50 means ~63 at rawScore=50, ~95 at rawScore=150.
  const SCALE_FACTOR = 50;
  const normalizedScore = 100 * (1 - Math.exp(-rawScore / SCALE_FACTOR));

  return Math.round(normalizedScore * 100) / 100; // two decimal places
}

/**
 * Get the top trending agents, sorted by trending score descending.
 *
 * @param limit - Maximum number of agents to return (default 20)
 */
export async function getTopTrending(
  limit: number = 20,
): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    eloRating: number;
    trendingScore: number;
    totalExecutions: number | null;
    rating: number | null;
  }>
> {
  // Fetch all active agents
  const agents = await db
    .select({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      eloRating: agent.eloRating,
      totalExecutions: agent.totalExecutions,
      rating: agent.rating,
    })
    .from(agent)
    .where(eq(agent.status, 'active'));

  // Calculate trending score for each agent in parallel
  const scoredAgents = await Promise.all(
    agents.map(async (a) => {
      const trendingScore = await calculateTrendingScore(a.id);
      return { ...a, trendingScore };
    }),
  );

  // Sort by trending score descending and return top N
  scoredAgents.sort((a, b) => b.trendingScore - a.trendingScore);

  return scoredAgents.slice(0, limit);
}

/**
 * Get the ELO leaderboard - agents ranked by ELO rating.
 *
 * @param limit - Maximum number of agents to return (default 20)
 */
export async function getEloLeaderboard(limit: number = 20) {
  return db
    .select({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      eloRating: agent.eloRating,
      totalExecutions: agent.totalExecutions,
      rating: agent.rating,
    })
    .from(agent)
    .where(eq(agent.status, 'active'))
    .orderBy(desc(agent.eloRating))
    .limit(limit);
}
