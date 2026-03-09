/**
 * Arena Battle Engine
 *
 * Multi-round battle system where AI agents compete on a given topic.
 * Each battle consists of 3 rounds. In each round every agent responds
 * to the topic and responses are scored on relevance, insight, accuracy,
 * and creativity (0-100 each). Cumulative scores determine the winner.
 *
 * Runs entirely in simulation mode when no LLM API keys are configured.
 */

import { scoreResponse, calculateMultiAgentElo, type ScoringCriteria } from './scoring';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BattleAgent {
  id: string;
  name: string;
  description?: string;
  tools: string[];
  systemPrompt?: string;
  eloRating: number;
}

export interface RoundResponse {
  agentId: string;
  agentName: string;
  response: string;
  criteria: ScoringCriteria;
  roundScore: number; // 0-100 for this round
  timestamp: string;
}

export interface BattleRound {
  roundNumber: number; // 1, 2, or 3
  prompt: string; // The prompt for this round
  responses: RoundResponse[];
  completedAt: string;
}

export interface BattleState {
  matchId: string;
  topic: string;
  agents: BattleAgent[];
  rounds: BattleRound[];
  currentRound: number; // 0 = not started, 1-3 = in progress, 4 = complete
  cumulativeScores: Record<string, number>; // agentId -> total score across rounds
  winnerId: string | null;
  status: 'pending' | 'active' | 'completed';
  startedAt: string | null;
  completedAt: string | null;
  eloChanges: Record<string, number> | null; // agentId -> new ELO after battle
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_ROUNDS = 3;

/**
 * Round prompt templates. Each round approaches the topic from a
 * different angle to test breadth and depth.
 */
const ROUND_PROMPTS = [
  (topic: string) =>
    `Provide a comprehensive analysis of "${topic}". Include key facts, current state, and relevant data points.`,
  (topic: string) =>
    `What are the most important implications and future trends related to "${topic}"? Provide evidence-based reasoning.`,
  (topic: string) =>
    `Present a contrarian or novel perspective on "${topic}". Challenge conventional thinking and offer unique insights.`,
];

// ---------------------------------------------------------------------------
// Simulated response generation
// ---------------------------------------------------------------------------

/**
 * Vocabulary pools for simulated response generation, keyed by round
 * angle (analysis, implications, contrarian).
 */
const ANALYSIS_PHRASES = [
  'Current data indicates', 'Research shows that', 'According to recent studies',
  'The primary factors include', 'Statistical analysis reveals',
  'Historical patterns suggest', 'Cross-referencing multiple sources',
  'The evidence points to', 'Market indicators show', 'Key metrics demonstrate',
];

const IMPLICATIONS_PHRASES = [
  'Looking ahead, we can expect', 'The trajectory suggests',
  'This trend is likely to', 'Future developments may include',
  'The long-term impact will be', 'Emerging patterns indicate',
  'Projection models forecast', 'The ripple effects extend to',
  'Strategic implications include', 'The paradigm is shifting toward',
];

const CONTRARIAN_PHRASES = [
  'Conventional wisdom overlooks', 'A deeper examination reveals',
  'The counterargument is compelling', 'Most analyses fail to consider',
  'An alternative framework suggests', 'The overlooked dimension is',
  'Challenging the mainstream narrative', 'A contrarian but data-backed view',
  'The minority position has merit because', 'Re-examining the assumptions shows',
];

/**
 * Simple seeded PRNG for deterministic-ish but varied responses.
 */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) | 0;
    return Math.abs(h % 10000) / 10000;
  };
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * Generate a simulated agent response for a given round.
 *
 * In simulation mode we build a coherent-looking response from phrase
 * pools so the scoring heuristics have real text to evaluate.
 */
function generateSimulatedResponse(
  agent: BattleAgent,
  topic: string,
  roundNumber: number,
  prompt: string
): string {
  const seed = `${agent.id}-${topic}-round${roundNumber}`;
  const rng = seededRandom(seed);

  const phrasePools = [ANALYSIS_PHRASES, IMPLICATIONS_PHRASES, CONTRARIAN_PHRASES];
  const pool = phrasePools[roundNumber - 1] || ANALYSIS_PHRASES;
  const selectedPhrases = pickN(pool, 4 + Math.floor(rng() * 3), rng);

  // Build paragraphs
  const paragraphs: string[] = [];

  // Intro
  paragraphs.push(
    `${agent.name} responding to: "${prompt}"\n\n` +
    `${selectedPhrases[0]} that "${topic}" represents a significant area of analysis. ` +
    `Drawing on ${agent.tools.length} specialized tools (${agent.tools.slice(0, 3).join(', ')}), ` +
    `the following assessment synthesizes multiple data streams.`
  );

  // Body paragraphs with data-like content
  const dataPoints = [
    `approximately ${Math.floor(rng() * 90 + 10)}% of indicators`,
    `a ${(rng() * 30 + 5).toFixed(1)}% change over the period`,
    `${Math.floor(rng() * 500 + 100)} data points analyzed`,
    `confidence level of ${Math.floor(rng() * 20 + 78)}%`,
    `${Math.floor(rng() * 50 + 10)} sources cross-referenced`,
  ];

  for (let i = 1; i < selectedPhrases.length; i++) {
    const dp = dataPoints[Math.floor(rng() * dataPoints.length)];
    paragraphs.push(
      `${selectedPhrases[i]} ${dp}. ` +
      `This is particularly relevant because the underlying dynamics of "${topic}" ` +
      `involve complex interactions between multiple factors. ` +
      `Furthermore, the analysis suggests that current trends will continue ` +
      `to evolve, requiring ongoing monitoring and adaptive strategies.`
    );
  }

  // Conclusion
  paragraphs.push(
    `In conclusion, the evidence indicates that "${topic}" warrants careful attention. ` +
    `The combination of quantitative analysis and qualitative assessment reveals ` +
    `patterns that are both actionable and significant for stakeholders.`
  );

  return paragraphs.join('\n\n');
}

// ---------------------------------------------------------------------------
// In-memory battle store (persists across hot reloads via globalThis)
// ---------------------------------------------------------------------------

const globalBattleStore = globalThis as unknown as {
  __battleStore?: Map<string, BattleState>;
};
if (!globalBattleStore.__battleStore) {
  globalBattleStore.__battleStore = new Map<string, BattleState>();
}
export const battleStore = globalBattleStore.__battleStore;

// ---------------------------------------------------------------------------
// BattleEngine class
// ---------------------------------------------------------------------------

export class BattleEngine {
  /**
   * Start a new multi-round battle for a match.
   *
   * Creates the battle state, runs all 3 rounds sequentially, scores
   * every response, and determines the winner.
   *
   * @param matchId - The arena match ID
   * @param agents  - Participating agents
   * @param topic   - The battle topic
   * @returns       - Final BattleState with all rounds and winner
   */
  async startBattle(
    matchId: string,
    agents: BattleAgent[],
    topic: string
  ): Promise<BattleState> {
    if (agents.length < 2) {
      throw new Error('At least 2 agents are required for a battle');
    }

    // Initialize state
    const state: BattleState = {
      matchId,
      topic,
      agents,
      rounds: [],
      currentRound: 0,
      cumulativeScores: {},
      winnerId: null,
      status: 'active',
      startedAt: new Date().toISOString(),
      completedAt: null,
      eloChanges: null,
    };

    // Initialize cumulative scores
    for (const a of agents) {
      state.cumulativeScores[a.id] = 0;
    }

    // Store initial state
    battleStore.set(matchId, state);

    // Run all rounds
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      await this.executeRound(state, round);
    }

    // Determine winner
    state.winnerId = this.determineWinner(state);
    state.status = 'completed';
    state.completedAt = new Date().toISOString();

    // Calculate ELO changes
    if (state.winnerId) {
      const agentElos: Record<string, number> = {};
      for (const a of agents) {
        agentElos[a.id] = a.eloRating;
      }
      state.eloChanges = calculateMultiAgentElo(agentElos, state.winnerId);

      // Persist ELO changes to DB if available
      await this.persistEloChanges(state.eloChanges);
    }

    // Persist battle result to the match record
    await this.persistMatchResult(state);

    // Update store
    battleStore.set(matchId, state);

    return state;
  }

  /**
   * Execute a single round of the battle.
   */
  private async executeRound(state: BattleState, roundNumber: number): Promise<void> {
    state.currentRound = roundNumber;
    battleStore.set(state.matchId, state);

    const promptFn = ROUND_PROMPTS[roundNumber - 1] || ROUND_PROMPTS[0];
    const prompt = promptFn(state.topic);

    const responses: RoundResponse[] = [];

    // Run all agents for this round
    for (const agent of state.agents) {
      const response = await this.getAgentResponse(agent, state.topic, roundNumber, prompt);

      // Score the response
      const scored = scoreResponse(response, state.topic, agent.id);

      const roundResponse: RoundResponse = {
        agentId: agent.id,
        agentName: agent.name,
        response,
        criteria: scored.criteria,
        roundScore: scored.totalScore,
        timestamp: new Date().toISOString(),
      };

      responses.push(roundResponse);

      // Update cumulative score
      state.cumulativeScores[agent.id] =
        (state.cumulativeScores[agent.id] || 0) + scored.totalScore;
    }

    const round: BattleRound = {
      roundNumber,
      prompt,
      responses,
      completedAt: new Date().toISOString(),
    };

    state.rounds.push(round);
    battleStore.set(state.matchId, state);
  }

  /**
   * Get a response from an agent for a given round.
   *
   * Attempts to use the agent-executor if available and an LLM API key
   * is configured. Falls back to simulated responses.
   */
  private async getAgentResponse(
    agent: BattleAgent,
    topic: string,
    roundNumber: number,
    prompt: string
  ): Promise<string> {
    // Try real execution via agent-executor if LLM keys are available
    const hasLlmKey = !!(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY
    );

    if (hasLlmKey) {
      try {
        const { executeAgent } = await import('./agent-executor');
        const result = await executeAgent(agent.id, prompt);
        if (result.toolResults.some((r) => r.success)) {
          // Combine successful tool results into a response
          const combined = result.toolResults
            .filter((r) => r.success)
            .map((r) => {
              const text =
                typeof r.result === 'object'
                  ? JSON.stringify(r.result)
                  : String(r.result ?? '');
              return `[${r.tool}] ${text.slice(0, 800)}`;
            })
            .join('\n\n');
          return combined.slice(0, 3000);
        }
      } catch {
        // Agent execution failed - fall through to simulation
      }
    }

    // Simulation mode
    return generateSimulatedResponse(agent, topic, roundNumber, prompt);
  }

  /**
   * Determine the winner based on cumulative scores across all rounds.
   */
  private determineWinner(state: BattleState): string | null {
    if (Object.keys(state.cumulativeScores).length === 0) return null;

    let winnerId: string | null = null;
    let highScore = -1;

    for (const [agentId, score] of Object.entries(state.cumulativeScores)) {
      if (score > highScore) {
        highScore = score;
        winnerId = agentId;
      }
    }

    return winnerId;
  }

  /**
   * Persist ELO changes to the database.
   */
  private async persistEloChanges(
    eloChanges: Record<string, number>
  ): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const { agent } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      for (const [agentId, newElo] of Object.entries(eloChanges)) {
        await db
          .update(agent)
          .set({ eloRating: newElo, updatedAt: new Date() })
          .where(eq(agent.id, agentId));
      }
    } catch {
      // DB unavailable - ELO changes remain in the in-memory state only
    }
  }

  /**
   * Persist battle results to the arenaMatch table.
   */
  private async persistMatchResult(state: BattleState): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const { arenaMatch } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      // Flatten rounds into the format expected by the arenaMatch.rounds JSON column
      const flatRounds = state.rounds.flatMap((round) =>
        round.responses.map((r) => ({
          agentId: r.agentId,
          response: r.response.slice(0, 2000),
          toolsUsed: [] as string[],
          score: r.roundScore,
          accuracyScore: r.criteria.accuracy,
          toolScore: r.criteria.relevance,
          speedScore: r.criteria.creativity,
          roundNumber: round.roundNumber,
          timestamp: r.timestamp,
        }))
      );

      const eloChange = state.eloChanges && state.winnerId
        ? (state.eloChanges[state.winnerId] ?? 0) -
          (state.agents.find((a) => a.id === state.winnerId)?.eloRating ?? 1200)
        : 0;

      await db
        .update(arenaMatch)
        .set({
          rounds: flatRounds,
          winnerId: state.winnerId,
          status: 'completed',
          eloChange,
          completedAt: new Date(),
        })
        .where(eq(arenaMatch.id, state.matchId));
    } catch {
      // DB unavailable - results are in the in-memory battleStore
    }
  }

  /**
   * Get the current status of a battle.
   */
  getBattleStatus(matchId: string): BattleState | null {
    return battleStore.get(matchId) || null;
  }

  /**
   * Get all active battles.
   */
  getActiveBattles(): BattleState[] {
    return Array.from(battleStore.values()).filter(
      (b) => b.status === 'active'
    );
  }

  /**
   * Get recently completed battles.
   */
  getRecentBattles(limit = 10): BattleState[] {
    return Array.from(battleStore.values())
      .filter((b) => b.status === 'completed')
      .sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const globalEngine = globalThis as unknown as {
  __battleEngine?: BattleEngine;
};
if (!globalEngine.__battleEngine) {
  globalEngine.__battleEngine = new BattleEngine();
}

export const battleEngine = globalEngine.__battleEngine;
