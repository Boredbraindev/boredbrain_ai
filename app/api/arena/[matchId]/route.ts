export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
export const dynamic = 'force-dynamic';
import { MOCK_ARENA_MATCHES, MOCK_AGENTS } from '@/lib/mock-data';
import { dynamicMatchStore } from '@/lib/arena-store';
import {
  battleEngine,
  type BattleAgent,
} from '@/lib/arena/battle-engine';

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
    const sql = neon(process.env.DATABASE_URL!);

    const matchRows = await Promise.race([
      sql`SELECT * FROM arena_match WHERE id = ${matchId} LIMIT 1`,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);

    const match = matchRows[0];

    if (match) {
      // Resolve agent names for enriched response
      let agentDetails: Array<{ id: string; name: string; elo_rating: number }> = [];
      try {
        const agentIds = match.agents as string[];
        if (agentIds.length > 0) {
          agentDetails = await sql`
            SELECT id, name, elo_rating FROM agent WHERE id = ANY(${agentIds})
          ` as any;
        }
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
    const sql = neon(process.env.DATABASE_URL!);

    // Build dynamic SET clause
    const now = new Date().toISOString();
    const completedAt = body.status === 'completed' ? now : null;

    const updatedRows = await sql`
      UPDATE arena_match SET
        status = COALESCE(${body.status ?? null}, status),
        winner_id = COALESCE(${body.winnerId ?? null}, winner_id),
        completed_at = COALESCE(${completedAt}, completed_at)
      WHERE id = ${matchId}
      RETURNING *
    `;

    if (updatedRows.length === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, match: updatedRows[0] });
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

  const sql = neon(process.env.DATABASE_URL!);

  // Try DB first
  try {
    const dbRows = await Promise.race([
      sql`SELECT * FROM arena_match WHERE id = ${matchId} LIMIT 1`,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);

    const dbMatch = dbRows[0];

    if (dbMatch) {
      matchData = {
        id: dbMatch.id as string,
        topic: dbMatch.topic as string,
        matchType: dbMatch.match_type as string,
        agents: dbMatch.agents as string[],
        status: (dbMatch.status as string) ?? 'pending',
        prizePool: (dbMatch.prize_pool as string) ?? '0',
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
      sql`SELECT * FROM agent WHERE id = ANY(${agentIds})`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ]);

    for (const a of dbAgents) {
      battleAgents.push({
        id: a.id as string,
        name: a.name as string,
        description: (a.description as string) ?? undefined,
        tools: (a.tools as string[]) || [],
        systemPrompt: (a.system_prompt as string) ?? undefined,
        eloRating: Number(a.elo_rating) ?? 1200,
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

  // Lock betting (inline from wagering.ts)
  try {
    await sql`
      UPDATE arena_escrow SET status = 'locked'
      WHERE match_id = ${matchId} AND status = 'open'
    `;
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

    // Settle wagers (inline from wagering.ts)
    if (result.winnerId) {
      try {
        const PLATFORM_RAKE_PERCENT = 10;
        const RAKE_MULTIPLIER = PLATFORM_RAKE_PERCENT / 100;
        const now = Date.now();

        // Generate settlement tx hash
        let txHash = '0x';
        const seed = `${matchId}-${now}`;
        for (let i = 0; i < 64; i++) {
          const charCode = seed.charCodeAt(i % seed.length);
          txHash += ((charCode * (i + 1) * 7 + now) % 16).toString(16);
        }

        // Get all escrowed wagers
        const wagers = await sql`
          SELECT * FROM arena_wager
          WHERE match_id = ${matchId} AND status = 'escrowed'
        `;

        if (wagers.length > 0) {
          const totalPool = wagers.reduce((sum, w) => sum + Number(w.amount), 0);
          const platformRake = Math.round(totalPool * RAKE_MULTIPLIER * 100) / 100;
          const distributablePool = totalPool - platformRake;

          const winningWagers = wagers.filter(w => w.agent_id === result.winnerId);
          const losingWagers = wagers.filter(w => w.agent_id !== result.winnerId);
          const totalWinningStake = winningWagers.reduce((sum, w) => sum + Number(w.amount), 0);

          const settledAt = new Date().toISOString();

          // Distribute to winners
          for (const wager of winningWagers) {
            const share = totalWinningStake > 0 ? Number(wager.amount) / totalWinningStake : 0;
            const payout = Math.round(distributablePool * share * 100) / 100;

            await sql`
              UPDATE arena_wager SET
                status = 'won', payout = ${payout},
                settled_at = ${settledAt}, tx_hash = ${txHash}
              WHERE id = ${wager.id}
            `;
          }

          // Mark losers
          for (const wager of losingWagers) {
            await sql`
              UPDATE arena_wager SET
                status = 'lost', payout = 0,
                settled_at = ${settledAt}, tx_hash = ${txHash}
              WHERE id = ${wager.id}
            `;
          }

          // If no winners, refund everyone minus rake
          if (winningWagers.length === 0) {
            for (const wager of wagers) {
              const refund = Math.round(Number(wager.amount) * (1 - RAKE_MULTIPLIER) * 100) / 100;
              await sql`
                UPDATE arena_wager SET
                  status = 'refunded', payout = ${refund},
                  settled_at = ${settledAt}, tx_hash = ${txHash}
                WHERE id = ${wager.id}
              `;
            }
          }

          const totalWinnerPayout = winningWagers.reduce((sum, w) => {
            const share = totalWinningStake > 0 ? Number(w.amount) / totalWinningStake : 0;
            return sum + Math.round(distributablePool * share * 100) / 100;
          }, 0);

          // Update escrow
          await sql`
            UPDATE arena_escrow SET
              platform_rake = ${platformRake},
              winner_payout = ${totalWinnerPayout},
              status = 'settled',
              settled_at = ${settledAt}
            WHERE match_id = ${matchId}
          `;

          // Record platform rake as payment transaction
          const rakeBlockNumber = 25000000 + Math.floor(now / 1000) % 500000;
          await sql`
            INSERT INTO payment_transaction (
              type, from_agent_id, to_agent_id, amount,
              platform_fee, provider_share, chain, tx_hash,
              status, block_number
            ) VALUES (
              'arena_entry', 'arena-escrow', 'platform', ${platformRake},
              ${platformRake}, ${0}, 'base', ${txHash},
              'confirmed', ${rakeBlockNumber}
            )
          `;
        }
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
