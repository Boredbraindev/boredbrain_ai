import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { arenaMatch, agent } from '@/lib/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
export const dynamic = 'force-dynamic';
import { MOCK_ARENA_MATCHES, MOCK_AGENTS } from '@/lib/mock-data';
import { dynamicMatchStore } from '@/lib/arena-store';
import {
  battleEngine,
  type BattleAgent,
} from '@/lib/arena/battle-engine';
import { lockBetting, settleMatch } from '@/lib/arena/wagering';

/**
 * GET /api/arena/[matchId] - Get match details
 *
 * Returns match data from the database, falling back to mock data.
 * If a battle has been run for this match, includes full battle state
 * (rounds, scores, ELO changes).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  // Check if there is a battle state for this match
  const battleState = battleEngine.getBattleStatus(matchId);

  // Try database first
  try {
    const [match] = await Promise.race([
      db.select().from(arenaMatch).where(eq(arenaMatch.id, matchId)).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);

    if (match) {
      // Resolve agent names for enriched response
      let agentDetails: Array<{ id: string; name: string; eloRating: number }> = [];
      try {
        const agentIds = match.agents as string[];
        const agents = await db
          .select({ id: agent.id, name: agent.name, eloRating: agent.eloRating })
          .from(agent)
          .where(inArray(agent.id, agentIds));
        agentDetails = agents;
      } catch {
        // Agent lookup failed
      }

      return NextResponse.json({
        match,
        agentDetails,
        battle: battleState
          ? {
              status: battleState.status,
              currentRound: battleState.currentRound,
              cumulativeScores: battleState.cumulativeScores,
              eloChanges: battleState.eloChanges,
              rounds: battleState.rounds.map((r) => ({
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
              startedAt: battleState.startedAt,
              completedAt: battleState.completedAt,
            }
          : null,
      });
    }
  } catch {
    // DB failed or timed out -- fall through to mock data
  }

  // Fallback to mock data (static + dynamic)
  const mockMatch =
    MOCK_ARENA_MATCHES.find((m) => m.id === matchId) ??
    dynamicMatchStore.get(matchId);
  if (mockMatch) {
    return NextResponse.json({
      match: mockMatch,
      battle: battleState
        ? {
            status: battleState.status,
            currentRound: battleState.currentRound,
            cumulativeScores: battleState.cumulativeScores,
            eloChanges: battleState.eloChanges,
            rounds: battleState.rounds.map((r) => ({
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
            startedAt: battleState.startedAt,
            completedAt: battleState.completedAt,
          }
        : null,
    });
  }

  return NextResponse.json({ error: 'Match not found' }, { status: 404 });
}

// ---------------------------------------------------------------------------
// PUT /api/arena/[matchId] - Update match status (admin)
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  let body: { status?: string; winnerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const allowedStatuses = ['pending', 'active', 'completed', 'cancelled'];
  if (body.status && !allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const updateData: Record<string, any> = {};
    if (body.status) updateData.status = body.status;
    if (body.winnerId) updateData.winnerId = body.winnerId;
    if (body.status === 'completed') updateData.completedAt = new Date();

    const [updated] = await db
      .update(arenaMatch)
      .set(updateData)
      .where(eq(arenaMatch.id, matchId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, match: updated });
  } catch {
    // DB unavailable - try updating mock data
    const mockMatch = dynamicMatchStore.get(matchId);
    if (mockMatch) {
      if (body.status) mockMatch.status = body.status;
      if (body.winnerId) mockMatch.winnerId = body.winnerId;
      if (body.status === 'completed') {
        mockMatch.completedAt = new Date().toISOString();
      }
      return NextResponse.json({ success: true, match: mockMatch });
    }

    return NextResponse.json({ error: 'Match not found or DB unavailable' }, { status: 404 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/arena/[matchId] - Start/execute a match via battle engine
// ---------------------------------------------------------------------------

/**
 * POST /api/arena/[matchId]
 *
 * Starts a multi-round battle for the given match using the BattleEngine.
 * Falls back to the legacy single-round mock execution if the battle
 * engine cannot resolve the agents.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  // Resolve the match from DB or mock store
  let matchData: {
    id: string;
    topic: string;
    matchType: string;
    agents: string[];
    status: string;
    prizePool: string;
  } | null = null;

  // Try DB first
  try {
    const [dbMatch] = await Promise.race([
      db.select().from(arenaMatch).where(eq(arenaMatch.id, matchId)).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);

    if (dbMatch) {
      matchData = {
        id: dbMatch.id,
        topic: dbMatch.topic,
        matchType: dbMatch.matchType,
        agents: dbMatch.agents as string[],
        status: dbMatch.status ?? 'pending',
        prizePool: dbMatch.prizePool ?? '0',
      };
    }
  } catch {
    // DB unavailable
  }

  // Fallback to mock
  if (!matchData) {
    const mockMatch =
      MOCK_ARENA_MATCHES.find((m) => m.id === matchId) ??
      dynamicMatchStore.get(matchId);

    if (mockMatch) {
      matchData = {
        id: mockMatch.id,
        topic: mockMatch.topic,
        matchType: mockMatch.matchType,
        agents: mockMatch.agents as string[],
        status: mockMatch.status,
        prizePool: typeof mockMatch.prizePool === 'string' ? mockMatch.prizePool : '0',
      };
    }
  }

  if (!matchData) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (matchData.status !== 'pending') {
    return NextResponse.json({ error: 'Match already started or completed' }, { status: 400 });
  }

  // Resolve agents
  const battleAgents: BattleAgent[] = [];
  const agentIds = matchData.agents;

  // Try DB agents
  try {
    const dbAgents = await Promise.race([
      db
        .select()
        .from(agent)
        .where(inArray(agent.id, agentIds)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ]);

    for (const a of dbAgents) {
      battleAgents.push({
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

  // Fill from mock data
  const resolvedIds = new Set(battleAgents.map((a) => a.id));
  for (const id of agentIds) {
    if (resolvedIds.has(id)) continue;
    const mock = MOCK_AGENTS.find((m) => m.id === id);
    if (mock) {
      battleAgents.push({
        id: mock.id,
        name: mock.name,
        description: mock.description,
        tools: mock.tools || [],
        eloRating: (mock as any).eloRating ?? 1200,
      });
    } else {
      battleAgents.push({
        id,
        name: `Agent ${id.slice(0, 8)}`,
        tools: [],
        eloRating: 1200,
      });
    }
  }

  // Lock betting
  try {
    await lockBetting(matchId);
  } catch {
    // Non-blocking
  }

  // Run the battle
  try {
    const result = await battleEngine.startBattle(
      matchId,
      battleAgents,
      matchData.topic
    );

    // Update mock store if applicable
    const mockMatch = dynamicMatchStore.get(matchId);
    if (mockMatch) {
      mockMatch.status = 'completed';
      mockMatch.winnerId = result.winnerId;
      mockMatch.completedAt = result.completedAt;
      mockMatch.rounds = result.rounds.flatMap((r) =>
        r.responses.map((resp) => ({
          agentId: resp.agentId,
          response: resp.response.slice(0, 2000),
          toolsUsed: [],
          score: resp.roundScore,
          scoreBreakdown: {
            accuracy: resp.criteria.accuracy,
            toolUsage: resp.criteria.relevance,
            speed: resp.criteria.creativity,
          },
          timestamp: resp.timestamp,
        }))
      );
    }

    // Settle wagers
    if (result.winnerId) {
      try {
        await settleMatch(matchId, result.winnerId);
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({
      match: {
        id: matchData.id,
        topic: matchData.topic,
        matchType: matchData.matchType,
        agents: matchData.agents,
        status: 'completed',
        winnerId: result.winnerId,
        prizePool: matchData.prizePool,
        completedAt: result.completedAt,
      },
      battle: {
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
          completedAt: r.completedAt,
        })),
        cumulativeScores: result.cumulativeScores,
        eloChanges: result.eloChanges,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Battle execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
