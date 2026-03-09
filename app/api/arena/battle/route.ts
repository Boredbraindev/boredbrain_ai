import { NextRequest } from 'next/server';
import {
  battleEngine,
  battleStore,
  type BattleAgent,
} from '@/lib/arena/battle-engine';
import { lockBetting, settleMatch } from '@/lib/arena/wagering';
import { MOCK_AGENTS } from '@/lib/mock-data';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  type Schema,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// POST /api/arena/battle - Start a new multi-round battle
// ---------------------------------------------------------------------------

const startBattleSchema: Schema = {
  matchId: { type: 'string', required: true, maxLength: 100 },
  topic: { type: 'string', required: true, maxLength: 500 },
};

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data as Record<string, unknown>;

  const { valid, errors, sanitized } = validateBody(body, startBattleSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const matchId = sanitized.matchId as string;
  const topic = sanitized.topic as string;

  // Agent IDs must be an array
  const agentIds = body.agentIds;
  if (!Array.isArray(agentIds) || agentIds.length < 2) {
    return apiError('At least 2 agentIds are required', 400);
  }
  if (agentIds.length > 4) {
    return apiError('Maximum 4 agents per battle', 400);
  }

  const sanitizedAgentIds = agentIds
    .filter((id): id is string => typeof id === 'string')
    .map((id) => sanitizeString(id, 100))
    .filter((id) => id.length > 0);

  if (sanitizedAgentIds.length !== agentIds.length) {
    return apiError('All agentIds must be non-empty strings', 400);
  }

  // Prevent re-starting an existing battle
  const existing = battleEngine.getBattleStatus(matchId);
  if (existing && existing.status !== 'pending') {
    return apiError(
      `Battle already ${existing.status} for match ${matchId}`,
      409
    );
  }

  // Resolve agents from DB or mock data
  const agents: BattleAgent[] = [];

  try {
    const { db } = await import('@/lib/db');
    const { agent } = await import('@/lib/db/schema');
    const { inArray } = await import('drizzle-orm');

    const dbAgents = await Promise.race([
      db
        .select()
        .from(agent)
        .where(inArray(agent.id, sanitizedAgentIds)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ]);

    for (const a of dbAgents) {
      agents.push({
        id: a.id,
        name: a.name,
        description: a.description ?? undefined,
        tools: (a.tools as string[]) || [],
        systemPrompt: a.systemPrompt ?? undefined,
        eloRating: a.eloRating ?? 1200,
      });
    }
  } catch {
    // DB unavailable
  }

  // Fill in any agents not found in DB from mock data
  const foundIds = new Set(agents.map((a) => a.id));
  for (const id of sanitizedAgentIds) {
    if (foundIds.has(id)) continue;
    const mock = MOCK_AGENTS.find((m) => m.id === id);
    if (mock) {
      agents.push({
        id: mock.id,
        name: mock.name,
        description: mock.description,
        tools: mock.tools || [],
        systemPrompt: undefined,
        eloRating: (mock as any).eloRating ?? 1200,
      });
    } else {
      // Create a placeholder agent
      agents.push({
        id,
        name: `Agent ${id.slice(0, 8)}`,
        tools: [],
        eloRating: 1200,
      });
    }
  }

  if (agents.length < 2) {
    return apiError('Could not resolve at least 2 agents', 400);
  }

  // Lock betting before battle starts
  try {
    await lockBetting(matchId);
  } catch {
    // Non-blocking
  }

  // Mark the match as active in the DB
  try {
    const { db } = await import('@/lib/db');
    const { arenaMatch } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db
      .update(arenaMatch)
      .set({ status: 'active' })
      .where(eq(arenaMatch.id, matchId));
  } catch {
    // DB unavailable
  }

  // Execute the battle
  try {
    const result = await battleEngine.startBattle(matchId, agents, topic);

    // Settle wagers if there is a winner
    if (result.winnerId) {
      try {
        await settleMatch(matchId, result.winnerId);
      } catch {
        // Settlement is non-blocking
      }
    }

    return apiSuccess(
      {
        battle: {
          matchId: result.matchId,
          topic: result.topic,
          status: result.status,
          winnerId: result.winnerId,
          rounds: result.rounds.map((r) => ({
            roundNumber: r.roundNumber,
            prompt: r.prompt,
            responses: r.responses.map((resp) => ({
              agentId: resp.agentId,
              agentName: resp.agentName,
              response: resp.response.slice(0, 2000),
              criteria: resp.criteria,
              roundScore: resp.roundScore,
            })),
          })),
          cumulativeScores: result.cumulativeScores,
          eloChanges: result.eloChanges,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        },
      },
      201
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Battle execution failed';
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/arena/battle?matchId=xxx - Get battle status / results
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('matchId');

  if (!matchId) {
    // Return recent battles overview
    const active = battleEngine.getActiveBattles();
    const recent = battleEngine.getRecentBattles(10);
    return apiSuccess({ active, recent });
  }

  const sanitizedId = sanitizeString(matchId, 100);
  if (!sanitizedId) {
    return apiError('matchId must be a non-empty string', 400);
  }

  const state = battleEngine.getBattleStatus(sanitizedId);

  if (!state) {
    return apiError('Battle not found for this match', 404);
  }

  return apiSuccess({
    battle: {
      matchId: state.matchId,
      topic: state.topic,
      status: state.status,
      currentRound: state.currentRound,
      winnerId: state.winnerId,
      agents: state.agents.map((a) => ({
        id: a.id,
        name: a.name,
        eloRating: a.eloRating,
      })),
      rounds: state.rounds.map((r) => ({
        roundNumber: r.roundNumber,
        prompt: r.prompt,
        responses: r.responses.map((resp) => ({
          agentId: resp.agentId,
          agentName: resp.agentName,
          response: resp.response.slice(0, 2000),
          criteria: resp.criteria,
          roundScore: resp.roundScore,
        })),
        completedAt: r.completedAt,
      })),
      cumulativeScores: state.cumulativeScores,
      eloChanges: state.eloChanges,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    },
  });
}
