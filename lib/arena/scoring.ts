/**
 * Arena Scoring System
 *
 * Handles response scoring (relevance, insight, accuracy, creativity),
 * standard ELO rating calculations, and leaderboard updates.
 *
 * When no LLM API key is set, scoring runs in simulation mode using
 * deterministic heuristics based on response content.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoringCriteria {
  relevance: number; // 0-100
  insight: number; // 0-100
  accuracy: number; // 0-100
  creativity: number; // 0-100
}

export interface ScoredResponse {
  agentId: string;
  criteria: ScoringCriteria;
  totalScore: number; // weighted average 0-100
  explanation: string;
}

export interface EloChange {
  winnerNewElo: number;
  loserNewElo: number;
  change: number; // positive integer
}

export interface MatchResult {
  matchId: string;
  winnerId: string;
  loserId: string;
  winnerOldElo: number;
  loserOldElo: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard ELO K-factor */
const ELO_K = 32;

/** Criteria weights (must sum to 1) */
const CRITERIA_WEIGHTS = {
  relevance: 0.30,
  insight: 0.25,
  accuracy: 0.30,
  creativity: 0.15,
};

// ---------------------------------------------------------------------------
// Simulated scoring (no LLM needed)
// ---------------------------------------------------------------------------

/**
 * Deterministic hash of a string to a number in [0, 1).
 * Used for reproducible pseudo-random scoring.
 */
function hashToFloat(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 10000) / 10000;
}

/**
 * Count keyword matches between response and topic.
 */
function keywordOverlap(response: string, topic: string): number {
  const topicWords = new Set(
    topic.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  );
  if (topicWords.size === 0) return 0.5;

  const responseWords = response.toLowerCase().split(/\W+/);
  let matches = 0;
  for (const word of responseWords) {
    if (topicWords.has(word)) matches++;
  }
  // Normalize: more matches = higher relevance, cap at 1
  return Math.min(1, matches / (topicWords.size * 2));
}

/**
 * Heuristic scoring criteria from response text, without an LLM.
 *
 * - relevance: keyword overlap with topic + response length bonus
 * - insight: sentence count, presence of "because", "therefore", "analysis"
 * - accuracy: data-like tokens (numbers, percentages, citations)
 * - creativity: vocabulary diversity (unique words / total words)
 */
function simulatedCriteria(
  response: string,
  topic: string,
  agentId: string
): ScoringCriteria {
  const len = response.length;
  const words = response.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Relevance: keyword overlap + length bonus (longer = more likely relevant)
  const overlap = keywordOverlap(response, topic);
  const lengthBonus = Math.min(1, len / 1500);
  const relevanceRaw = overlap * 0.6 + lengthBonus * 0.4;
  const relevance = Math.round(Math.min(100, relevanceRaw * 80 + 20));

  // Insight: sentence depth, causal language
  const insightKeywords = [
    'because', 'therefore', 'analysis', 'suggest', 'indicates',
    'however', 'moreover', 'consequently', 'furthermore', 'evidence',
    'correlation', 'trend', 'pattern', 'implication', 'conclusion',
  ];
  const insightHits = insightKeywords.filter((k) =>
    response.toLowerCase().includes(k)
  ).length;
  const sentenceDepth = Math.min(1, sentences.length / 10);
  const insightRaw = (insightHits / insightKeywords.length) * 0.6 + sentenceDepth * 0.4;
  const insight = Math.round(Math.min(100, insightRaw * 75 + 25));

  // Accuracy: numbers, percentages, data references
  const numberMatches = response.match(/\d+\.?\d*/g) || [];
  const percentMatches = response.match(/\d+%/g) || [];
  const dataTokens = numberMatches.length + percentMatches.length * 2;
  const dataRatio = Math.min(1, dataTokens / 15);
  const accuracy = Math.round(Math.min(100, dataRatio * 70 + 30));

  // Creativity: vocabulary diversity
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const diversity = wordCount > 0 ? uniqueWords.size / wordCount : 0;
  // Add a small deterministic variance per agent so identical responses still differ
  const agentVariance = hashToFloat(agentId + topic) * 10;
  const creativity = Math.round(
    Math.min(100, diversity * 80 + 15 + agentVariance)
  );

  return { relevance, insight, accuracy, creativity };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a single response against a topic.
 *
 * Uses simulated heuristic scoring. If an LLM scorer becomes available
 * in the future, it can be plugged in here by checking for an API key
 * and calling the model instead.
 */
export function scoreResponse(
  response: string,
  topic: string,
  agentId: string
): ScoredResponse {
  const criteria = simulatedCriteria(response, topic, agentId);

  const totalScore = Math.round(
    criteria.relevance * CRITERIA_WEIGHTS.relevance +
    criteria.insight * CRITERIA_WEIGHTS.insight +
    criteria.accuracy * CRITERIA_WEIGHTS.accuracy +
    criteria.creativity * CRITERIA_WEIGHTS.creativity
  );

  const explanation =
    `Relevance: ${criteria.relevance}/100, ` +
    `Insight: ${criteria.insight}/100, ` +
    `Accuracy: ${criteria.accuracy}/100, ` +
    `Creativity: ${criteria.creativity}/100. ` +
    `Weighted total: ${totalScore}/100.`;

  return {
    agentId,
    criteria,
    totalScore,
    explanation,
  };
}

/**
 * Standard ELO rating change calculation.
 *
 * Uses K-factor of 32. Expected score is computed with the logistic
 * curve: E = 1 / (1 + 10^((opponent - player) / 400))
 */
export function calculateEloChange(winnerElo: number, loserElo: number): EloChange {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

  const change = Math.round(ELO_K * (1 - expectedWinner));

  return {
    winnerNewElo: winnerElo + change,
    loserNewElo: Math.max(100, loserElo - change), // floor at 100
    change,
  };
}

/**
 * Compute ELO changes for a multi-agent match.
 *
 * The winner gains ELO against every other participant (pairwise).
 * Non-winners lose ELO against the winner only.
 * Returns a map of agentId -> new ELO rating.
 */
export function calculateMultiAgentElo(
  agentElos: Record<string, number>,
  winnerId: string
): Record<string, number> {
  const result: Record<string, number> = { ...agentElos };
  const winnerElo = agentElos[winnerId] ?? 1200;

  for (const [agentId, elo] of Object.entries(agentElos)) {
    if (agentId === winnerId) continue;

    const { winnerNewElo, loserNewElo } = calculateEloChange(winnerElo, elo);

    // Accumulate changes for the winner across all pairings
    result[winnerId] = (result[winnerId] ?? winnerElo) + (winnerNewElo - winnerElo);
    result[agentId] = loserNewElo;
  }

  // Ensure all ratings have a floor of 100
  for (const id of Object.keys(result)) {
    result[id] = Math.max(100, Math.round(result[id]));
  }

  return result;
}

/**
 * Update agent ELO ratings in the database after a match.
 *
 * This is a DB-aware wrapper. If the DB is unavailable it returns
 * the computed ELO changes without persisting them.
 */
export async function updateLeaderboard(
  matchResult: MatchResult
): Promise<{ eloChanges: EloChange; persisted: boolean }> {
  const eloChanges = calculateEloChange(
    matchResult.winnerOldElo,
    matchResult.loserOldElo
  );

  try {
    // Dynamic import to avoid pulling in DB deps at module level
    const { db } = await import('@/lib/db');
    const { agent } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db
      .update(agent)
      .set({ eloRating: eloChanges.winnerNewElo, updatedAt: new Date() })
      .where(eq(agent.id, matchResult.winnerId));

    await db
      .update(agent)
      .set({ eloRating: eloChanges.loserNewElo, updatedAt: new Date() })
      .where(eq(agent.id, matchResult.loserId));

    return { eloChanges, persisted: true };
  } catch {
    // DB unavailable - return changes without persisting
    return { eloChanges, persisted: false };
  }
}
