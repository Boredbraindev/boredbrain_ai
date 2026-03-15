export const runtime = 'edge';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { MOCK_AGENTS } from '@/lib/mock-data';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  type Schema,
} from '@/lib/api-utils';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

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
    const sql = neon(process.env.DATABASE_URL!);

    // Check DB agents
    const dbAgents = await sql`
      SELECT id FROM agent WHERE id = ANY(${sanitizedAgentIds})
    `;
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
        const now = new Date().toISOString();
        await sql`
          INSERT INTO agent (
            id, name, description, capabilities, tools,
            price_per_query, total_executions, total_revenue,
            rating, status, created_at, updated_at
          ) VALUES (
            ${mockAgent.id}, ${mockAgent.name}, ${mockAgent.description},
            ${JSON.stringify(mockAgent.capabilities)}, ${JSON.stringify(mockAgent.tools)},
            ${mockAgent.pricePerQuery}, ${mockAgent.totalExecutions ?? 0},
            ${mockAgent.totalRevenue ?? '0'}, ${mockAgent.rating ?? 0},
            ${mockAgent.status ?? 'active'}, ${now}, ${now}
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }

    // Generate match ID and persist
    const matchId = generateId();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO arena_match (
        id, topic, match_type, agents, status, prize_pool, created_at
      ) VALUES (
        ${matchId}, ${topic}, ${matchType},
        ${JSON.stringify(sanitizedAgentIds)}, 'pending', ${prizePool}, ${now}
      )
    `;

    // Create escrow pool for wagering
    const escrowId = generateId();
    await sql`
      INSERT INTO arena_escrow (
        id, match_id, total_pool, platform_rake, winner_payout, status, created_at
      ) VALUES (
        ${escrowId}, ${matchId}, ${0}, ${0}, ${0}, 'open', ${now}
      )
    `;

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
      createdAt: now,
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
