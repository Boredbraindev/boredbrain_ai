export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { MOCK_AGENTS } from '@/lib/mock-data';
import { db } from '@/lib/db';
import { arenaMatch, agent, arenaEscrow } from '@/lib/db/schema';
import { generateId } from 'ai';
import { inArray } from 'drizzle-orm';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  type Schema,
} from '@/lib/api-utils';

const createMatchSchema: Schema = {
  topic: { type: 'string', required: true, maxLength: 500 },
  matchType: { type: 'string', required: true, enum: ['debate', 'search_race', 'research'] },
  prizePool: { type: 'string', required: false, maxLength: 50 },
};

/**
 * POST /api/arena/create - Create a new arena match
 *
 * Persists match to the database and creates an escrow pool for wagering.
 */
export async function POST(request: NextRequest) {
  // Safe JSON parse
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data as Record<string, unknown>;

  // Schema validation
  const { valid, errors, sanitized } = validateBody(body, createMatchSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  // Validate agentIds (array field handled separately)
  const agentIds = body.agentIds;
  if (!Array.isArray(agentIds) || agentIds.length < 2) {
    return apiError('At least 2 agentIds are required', 400);
  }
  if (agentIds.length > 4) {
    return apiError('Maximum 4 agents per match', 400);
  }
  const sanitizedAgentIds = agentIds
    .filter((id): id is string => typeof id === 'string')
    .map((id) => sanitizeString(id, 100))
    .filter((id) => id.length > 0);
  if (sanitizedAgentIds.length !== agentIds.length) {
    return apiError('All agentIds must be non-empty strings', 400);
  }

  const topic = sanitized.topic as string;
  const matchType = sanitized.matchType as string;
  const prizePool = sanitizeString(sanitized.prizePool ?? '0', 50);

  // Verify all agents exist (check both DB and mock data)
  const mockAgentIds = MOCK_AGENTS.map((a: any) => a.id);

  try {
    // Check DB agents
    const dbAgents = await db
      .select({ id: agent.id })
      .from(agent)
      .where(inArray(agent.id, sanitizedAgentIds));
    const dbAgentIds = new Set(dbAgents.map((a: any) => a.id));

    // Validate all agent IDs exist somewhere
    const invalidIds = sanitizedAgentIds.filter(
      (id) => !mockAgentIds.includes(id) && !dbAgentIds.has(id)
    );

    if (invalidIds.length > 0) {
      return apiError(`Unknown agent IDs: ${invalidIds.join(', ')}`, 400);
    }

    // Seed mock agents into DB if they don't exist yet
    const missingMockIds = sanitizedAgentIds.filter(
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

    await db.insert(arenaMatch).values({
      id: matchId,
      topic,
      matchType,
      agents: sanitizedAgentIds,
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
      topic,
      matchType,
      agents: sanitizedAgentIds,
      winnerId: null,
      rounds: null,
      totalVotes: 0,
      resultTxHash: null,
      prizePool,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    return apiSuccess({ match }, 201);
  } catch (error) {
    console.error('[arena/create] DB error:', error);

    // Fallback for demo
    const matchId = `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const match = {
      id: matchId,
      topic,
      matchType,
      agents: sanitizedAgentIds,
      winnerId: null,
      rounds: null,
      totalVotes: 0,
      resultTxHash: null,
      prizePool,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    return apiSuccess({ match, _warning: 'Stored in-memory only (DB unavailable)' }, 201);
  }
}
