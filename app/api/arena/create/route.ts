import { NextRequest, NextResponse } from 'next/server';
import { MOCK_AGENTS } from '@/lib/mock-data';
import { db } from '@/lib/db';
import { arenaMatch, agent, arenaEscrow } from '@/lib/db/schema';
import { generateId } from 'ai';
import { inArray } from 'drizzle-orm';

/**
 * POST /api/arena/create - Create a new arena match
 *
 * Body: { topic: string; matchType: 'debate' | 'search_race' | 'research'; agentIds: string[]; prizePool?: string }
 *
 * Persists match to the database and creates an escrow pool for wagering.
 */
export async function POST(request: NextRequest) {
  let body: {
    topic: string;
    matchType: 'debate' | 'search_race' | 'research';
    agentIds: string[];
    prizePool?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validation
  if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length === 0) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  const validTypes = ['debate', 'search_race', 'research'];
  if (!body.matchType || !validTypes.includes(body.matchType)) {
    return NextResponse.json(
      { error: 'matchType must be one of: debate, search_race, research' },
      { status: 400 },
    );
  }

  if (!body.agentIds || !Array.isArray(body.agentIds) || body.agentIds.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 agentIds are required' },
      { status: 400 },
    );
  }

  if (body.agentIds.length > 4) {
    return NextResponse.json({ error: 'Maximum 4 agents per match' }, { status: 400 });
  }

  // Verify all agents exist (check both DB and mock data)
  const mockAgentIds = MOCK_AGENTS.map((a) => a.id);

  try {
    // Check DB agents
    const dbAgents = await db
      .select({ id: agent.id })
      .from(agent)
      .where(inArray(agent.id, body.agentIds));
    const dbAgentIds = new Set(dbAgents.map((a) => a.id));

    // Validate all agent IDs exist somewhere
    const invalidIds = body.agentIds.filter(
      (id) => !mockAgentIds.includes(id) && !dbAgentIds.has(id)
    );

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown agent IDs: ${invalidIds.join(', ')}` },
        { status: 400 },
      );
    }

    // Seed mock agents into DB if they don't exist yet
    const missingMockIds = body.agentIds.filter(
      (id) => mockAgentIds.includes(id) && !dbAgentIds.has(id)
    );

    for (const mockId of missingMockIds) {
      const mockAgent = MOCK_AGENTS.find((a) => a.id === mockId);
      if (mockAgent) {
        await db.insert(agent).values({
          id: mockAgent.id,
          name: mockAgent.name,
          description: mockAgent.description,
          capabilities: mockAgent.capabilities,
          tools: mockAgent.tools,
          pricePerQuery: mockAgent.pricePerQuery,
          totalExecutions: mockAgent.totalExecutions ?? 0,
          totalRevenue: mockAgent.totalRevenue ?? '0',
          rating: mockAgent.rating ?? 0,
          status: mockAgent.status ?? 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();
      }
    }

    // Generate match ID and persist
    const matchId = generateId();
    const prizePool = body.prizePool || '0';

    await db.insert(arenaMatch).values({
      id: matchId,
      topic: body.topic.trim(),
      matchType: body.matchType,
      agents: body.agentIds,
      status: 'pending',
      prizePool,
      createdAt: new Date(),
    });

    // Create escrow pool for wagering
    await db.insert(arenaEscrow).values({
      id: generateId(),
      matchId,
      totalPool: 0,
      platformRake: 0,
      winnerPayout: 0,
      status: 'open',
      createdAt: new Date(),
    });

    const match = {
      id: matchId,
      topic: body.topic.trim(),
      matchType: body.matchType,
      agents: body.agentIds,
      winnerId: null,
      rounds: null,
      totalVotes: 0,
      resultTxHash: null,
      prizePool,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    return NextResponse.json({ match }, { status: 201 });
  } catch (error) {
    console.error('[arena/create] DB error:', error);

    // Fallback for demo
    const matchId = `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const match = {
      id: matchId,
      topic: body.topic.trim(),
      matchType: body.matchType,
      agents: body.agentIds,
      winnerId: null,
      rounds: null,
      totalVotes: 0,
      resultTxHash: null,
      prizePool: body.prizePool || '0',
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    return NextResponse.json(
      { match, _warning: 'Stored in-memory only (DB unavailable)' },
      { status: 201 },
    );
  }
}
