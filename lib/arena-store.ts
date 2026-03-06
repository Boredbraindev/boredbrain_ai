/**
 * In-memory store for dynamically created arena matches.
 * Used when the database is not available.
 * Matches created via /api/arena/create are stored here so that
 * GET /api/arena and GET /api/arena/[matchId] can find them.
 */

export interface DynamicArenaMatch {
  id: string;
  topic: string;
  matchType: string;
  agents: string[];
  winnerId: string | null;
  rounds: Array<{
    agentId: string;
    response: string;
    toolsUsed: string[];
    score: number;
    scoreBreakdown?: { accuracy: number; toolUsage: number; speed: number };
    timestamp: string;
  }> | null;
  totalVotes: number;
  resultTxHash: string | null;
  prizePool: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

/** Module-level map that persists across hot reloads in dev via globalThis */
const globalStore = globalThis as unknown as {
  __arenaMatchStore?: Map<string, DynamicArenaMatch>;
};

if (!globalStore.__arenaMatchStore) {
  globalStore.__arenaMatchStore = new Map<string, DynamicArenaMatch>();
}

export const dynamicMatchStore = globalStore.__arenaMatchStore;
