/**
 * Agent Self-Improvement / Evolution System
 *
 * Agents improve based on arena battle results and invocation feedback.
 * Performance is tracked in the agent_evolution table, and agents can
 * evolve their system prompts based on accumulated data.
 *
 * Uses DB-first pattern with 3s timeout, no transactions.
 */

import { db } from '@/lib/db';
import { agentEvolution, externalAgent } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVOLUTION_THRESHOLD = 10; // min events before evolution is possible
const WIN_RATE_FLOOR = 0.3; // agents below this win rate get priority improvement
const MAX_PROMPT_ADDITIONS = 5; // max learned patterns appended to prompt

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType = 'battle_win' | 'battle_loss' | 'invocation' | 'evolution' | 'spawn';

export interface EvolutionEvent {
  id: string;
  agentId: string;
  eventType: EventType;
  data: Record<string, unknown>;
  performanceScore: number | null;
  createdAt: string;
}

export interface EvolutionScore {
  agentId: string;
  totalEvents: number;
  battleWins: number;
  battleLosses: number;
  winRate: number;
  avgInvocationQuality: number;
  evolutionCount: number;
  trend: 'improving' | 'declining' | 'stable';
  overallScore: number; // 0-100
}

export interface EvolutionResult {
  improved: boolean;
  changes: string[];
  newScore: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateEventId(): string {
  return `evo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toEvolutionEvent(row: typeof agentEvolution.$inferSelect): EvolutionEvent {
  return {
    id: row.id,
    agentId: row.agentId,
    eventType: row.eventType as EventType,
    data: (row.data as Record<string, unknown>) ?? {},
    performanceScore: row.performanceScore,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record the outcome of an arena battle for an agent.
 */
export async function recordBattleOutcome(
  agentId: string,
  matchId: string,
  won: boolean,
  scores: { agentScore: number; opponentScore: number; topic?: string },
): Promise<EvolutionEvent> {
  const eventType: EventType = won ? 'battle_win' : 'battle_loss';
  const performanceScore = won
    ? Math.min(100, 50 + Math.round(scores.agentScore * 5))
    : Math.max(0, 50 - Math.round(scores.opponentScore * 5));

  const [row] = await db
    .insert(agentEvolution)
    .values({
      id: generateEventId(),
      agentId,
      eventType,
      data: {
        matchId,
        won,
        agentScore: scores.agentScore,
        opponentScore: scores.opponentScore,
        topic: scores.topic ?? 'unknown',
      },
      performanceScore,
    })
    .returning();

  return toEvolutionEvent(row);
}

/**
 * Record feedback from an agent invocation.
 * Quality is a 1-5 score (5 = excellent).
 */
export async function recordInvocationFeedback(
  agentId: string,
  query: string,
  responseQuality: number,
): Promise<EvolutionEvent> {
  const clampedQuality = Math.max(1, Math.min(5, Math.round(responseQuality)));
  const performanceScore = clampedQuality * 20; // 1→20, 2→40, 3→60, 4→80, 5→100

  const [row] = await db
    .insert(agentEvolution)
    .values({
      id: generateEventId(),
      agentId,
      eventType: 'invocation',
      data: {
        query: query.slice(0, 500),
        quality: clampedQuality,
      },
      performanceScore,
    })
    .returning();

  return toEvolutionEvent(row);
}

/**
 * Calculate the overall evolution/performance score for an agent.
 */
export async function getEvolutionScore(agentId: string): Promise<EvolutionScore> {
  const defaultScore: EvolutionScore = {
    agentId,
    totalEvents: 0,
    battleWins: 0,
    battleLosses: 0,
    winRate: 0,
    avgInvocationQuality: 0,
    evolutionCount: 0,
    trend: 'stable',
    overallScore: 50,
  };

  try {
    const dbPromise = db
      .select()
      .from(agentEvolution)
      .where(eq(agentEvolution.agentId, agentId))
      .orderBy(desc(agentEvolution.createdAt));
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const events = await Promise.race([dbPromise, timeout]);

    if (events.length === 0) return defaultScore;

    let battleWins = 0;
    let battleLosses = 0;
    let invocationScoreSum = 0;
    let invocationCount = 0;
    let evolutionCount = 0;

    for (const event of events) {
      switch (event.eventType) {
        case 'battle_win':
          battleWins++;
          break;
        case 'battle_loss':
          battleLosses++;
          break;
        case 'invocation':
          if (event.performanceScore !== null) {
            invocationScoreSum += event.performanceScore;
            invocationCount++;
          }
          break;
        case 'evolution':
          evolutionCount++;
          break;
      }
    }

    const totalBattles = battleWins + battleLosses;
    const winRate = totalBattles > 0 ? battleWins / totalBattles : 0;
    const avgInvocationQuality = invocationCount > 0 ? invocationScoreSum / invocationCount : 0;

    // Calculate trend from recent vs older events
    const half = Math.floor(events.length / 2);
    const recentScores: number[] = events
      .slice(0, half)
      .filter((e: typeof events[number]) => e.performanceScore !== null)
      .map((e: typeof events[number]) => e.performanceScore!);
    const olderScores: number[] = events
      .slice(half)
      .filter((e: typeof events[number]) => e.performanceScore !== null)
      .map((e: typeof events[number]) => e.performanceScore!);

    const recentAvg =
      recentScores.length > 0
        ? recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length
        : 50;
    const olderAvg =
      olderScores.length > 0
        ? olderScores.reduce((a: number, b: number) => a + b, 0) / olderScores.length
        : 50;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentAvg > olderAvg + 5) trend = 'improving';
    else if (recentAvg < olderAvg - 5) trend = 'declining';

    // Overall score: weighted blend of win rate and invocation quality
    const battleComponent = winRate * 100 * 0.5;
    const invocationComponent = avgInvocationQuality * 0.3;
    const evolutionBonus = Math.min(evolutionCount * 2, 20) * 0.2;
    const overallScore = Math.round(
      Math.min(100, Math.max(0, battleComponent + invocationComponent + evolutionBonus * 100)),
    );

    return {
      agentId,
      totalEvents: events.length,
      battleWins,
      battleLosses,
      winRate: Math.round(winRate * 1000) / 1000,
      avgInvocationQuality: Math.round(avgInvocationQuality * 10) / 10,
      evolutionCount,
      trend,
      overallScore,
    };
  } catch {
    return defaultScore;
  }
}

/**
 * Suggest prompt improvements based on battle losses and low-quality responses.
 * Returns a text block to append to the agent's system prompt.
 */
export async function suggestPromptImprovement(agentId: string): Promise<string> {
  const suggestions: string[] = [];

  try {
    // Get recent losses and low-quality invocations
    const dbPromise = db
      .select()
      .from(agentEvolution)
      .where(eq(agentEvolution.agentId, agentId))
      .orderBy(desc(agentEvolution.createdAt))
      .limit(50);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const events = await Promise.race([dbPromise, timeout]);

    const losses = events.filter((e: typeof events[number]) => e.eventType === 'battle_loss');
    const lowQuality = events.filter(
      (e: typeof events[number]) => e.eventType === 'invocation' && (e.performanceScore ?? 100) < 60,
    );

    if (losses.length > 0) {
      const topics = losses
        .map((l: typeof events[number]) => (l.data as Record<string, unknown>)?.topic as string | undefined)
        .filter(Boolean)
        .slice(0, 3);
      if (topics.length > 0) {
        suggestions.push(
          `Strengthen responses on topics: ${topics.join(', ')}. Previous battles were lost on these subjects.`,
        );
      }
      suggestions.push(
        'Provide more structured, evidence-based arguments with specific data points.',
      );
    }

    if (lowQuality.length > 0) {
      suggestions.push(
        'Improve response depth and accuracy. Recent invocations scored below expectations.',
      );
      const queries = lowQuality
        .map((q: typeof events[number]) => (q.data as Record<string, unknown>)?.query as string | undefined)
        .filter(Boolean)
        .slice(0, 2);
      if (queries.length > 0) {
        suggestions.push(
          `Better handle queries like: "${queries[0]}"`,
        );
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('Continue current performance patterns. No critical improvements needed.');
    }
  } catch {
    suggestions.push('Unable to analyze performance data. Maintain current approach.');
  }

  return suggestions.slice(0, MAX_PROMPT_ADDITIONS).join('\n');
}

/**
 * Apply evolution: analyze performance and append learned patterns to
 * the agent's system prompt (stored in metadata).
 */
export async function evolveAgent(agentId: string): Promise<EvolutionResult> {
  const score = await getEvolutionScore(agentId);

  if (score.totalEvents < EVOLUTION_THRESHOLD) {
    return {
      improved: false,
      changes: [`Insufficient data: ${score.totalEvents}/${EVOLUTION_THRESHOLD} events recorded`],
      newScore: score.overallScore,
    };
  }

  const changes: string[] = [];
  const improvements = await suggestPromptImprovement(agentId);

  // Get current agent metadata
  let currentMetadata: Record<string, any> = {};
  try {
    const dbPromise = db
      .select({ metadata: externalAgent.metadata })
      .from(externalAgent)
      .where(eq(externalAgent.id, agentId))
      .limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const rows = await Promise.race([dbPromise, timeout]);
    if (rows.length > 0 && rows[0].metadata) {
      currentMetadata = rows[0].metadata as Record<string, any>;
    }
  } catch {
    // continue with empty metadata
  }

  // Append evolution data to metadata
  const existingEvolutions = (currentMetadata.evolutions as string[]) ?? [];
  const evolutionEntry = `[Evolution #${existingEvolutions.length + 1} @ ${new Date().toISOString()}] ${improvements}`;
  const updatedEvolutions = [...existingEvolutions, evolutionEntry].slice(-MAX_PROMPT_ADDITIONS);

  const updatedMetadata = {
    ...currentMetadata,
    evolutions: updatedEvolutions,
    lastEvolved: new Date().toISOString(),
    evolutionScore: score.overallScore,
    evolutionTrend: score.trend,
  };

  // Update agent metadata
  try {
    await db
      .update(externalAgent)
      .set({ metadata: updatedMetadata })
      .where(eq(externalAgent.id, agentId));

    changes.push('Updated system prompt with learned patterns');
    changes.push(`Win rate: ${(score.winRate * 100).toFixed(1)}%`);
    changes.push(`Trend: ${score.trend}`);
    changes.push(`Applied improvements: ${improvements.split('\n').length} patterns`);
  } catch {
    return {
      improved: false,
      changes: ['Failed to update agent metadata'],
      newScore: score.overallScore,
    };
  }

  // Record the evolution event
  try {
    await db.insert(agentEvolution).values({
      id: generateEventId(),
      agentId,
      eventType: 'evolution',
      data: {
        previousScore: score.overallScore,
        improvements: improvements.split('\n'),
        winRate: score.winRate,
        trend: score.trend,
      },
      performanceScore: score.overallScore,
    });
  } catch {
    // non-critical
  }

  return {
    improved: true,
    changes,
    newScore: score.overallScore,
  };
}

/**
 * Get the full evolution history for an agent.
 */
export async function getEvolutionHistory(agentId: string): Promise<EvolutionEvent[]> {
  try {
    const dbPromise = db
      .select()
      .from(agentEvolution)
      .where(eq(agentEvolution.agentId, agentId))
      .orderBy(desc(agentEvolution.createdAt))
      .limit(100);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const rows = await Promise.race([dbPromise, timeout]);
    return rows.map(toEvolutionEvent);
  } catch {
    return [];
  }
}
