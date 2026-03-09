import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { arenaMatch, agent } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { generateId } from 'ai';
import { MOCK_ARENA_MATCHES } from '@/lib/mock-data';
import { dynamicMatchStore } from '@/lib/arena-store';
import { battleEngine } from '@/lib/arena/battle-engine';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  type Schema,
} from '@/lib/api-utils';

const VALID_STATUSES = ['all', 'pending', 'active', 'completed', 'cancelled'] as const;

const createMatchSchema: Schema = {
  topic: { type: 'string', required: true, maxLength: 500 },
  matchType: { type: 'string', required: true, enum: ['debate', 'search_race', 'research'] },
  prizePool: { type: 'string', required: false, maxLength: 50 },
};

/**
 * GET /api/arena - List arena matches
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status') || 'all';
  const status = VALID_STATUSES.includes(rawStatus as typeof VALID_STATUSES[number])
    ? rawStatus
    : 'all';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);

  try {
    const baseQuery = db.select().from(arenaMatch).$dynamic();
    const dbPromise = status !== 'all'
      ? baseQuery.where(eq(arenaMatch.status, status)).orderBy(desc(arenaMatch.createdAt)).limit(limit)
      : baseQuery.orderBy(desc(arenaMatch.createdAt)).limit(limit);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    const matches = await Promise.race([dbPromise, timeout]);

    if (matches.length > 0) {
      // Enrich matches with battle status where available
      const enriched = matches.map((m) => {
        const battle = battleEngine.getBattleStatus(m.id);
        return {
          ...m,
          battleStatus: battle
            ? {
                currentRound: battle.currentRound,
                status: battle.status,
                cumulativeScores: battle.cumulativeScores,
                winnerId: battle.winnerId,
              }
            : null,
        };
      });

      return NextResponse.json({ success: true, matches: enriched }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
  } catch {
    // DB connection failed or timeout, fall through to mock data
  }

  // Combine static mock data with dynamically created matches
  const dynamicMatches = Array.from(dynamicMatchStore.values());
  const allMockMatches = [...MOCK_ARENA_MATCHES, ...dynamicMatches]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = status !== 'all'
    ? allMockMatches.filter((m) => m.status === status)
    : allMockMatches;
  return NextResponse.json({ success: true, matches: filtered.slice(0, limit) });
}

/**
 * POST /api/arena - Create a new arena match
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return apiError('Authentication required', 401);
  }

  // Safe JSON parse
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data as Record<string, unknown>;

  // Schema validation
  const { valid, errors, sanitized } = validateBody(body, createMatchSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  // Validate agentIds separately (array field)
  const agentIds = body.agentIds;
  if (!Array.isArray(agentIds) || agentIds.length < 2) {
    return apiError('At least 2 agentIds are required', 400);
  }
  if (agentIds.length > 4) {
    return apiError('Maximum 4 agents per match', 400);
  }
  // Ensure all IDs are strings and sanitize
  const sanitizedAgentIds = agentIds
    .filter((id): id is string => typeof id === 'string')
    .map((id) => sanitizeString(id, 100))
    .filter((id) => id.length > 0);

  if (sanitizedAgentIds.length !== agentIds.length) {
    return apiError('All agentIds must be non-empty strings', 400);
  }

  try {
    // Verify all agents exist and are active
    const agents = await db
      .select()
      .from(agent)
      .where(inArray(agent.id, sanitizedAgentIds));

    const activeAgents = agents.filter((a: any) => a.status === 'active');
    if (activeAgents.length !== sanitizedAgentIds.length) {
      return apiError('One or more agents not found or inactive', 400);
    }

    const topic = sanitized.topic as string;
    const matchType = sanitized.matchType as string;
    const prizePool = sanitizeString(sanitized.prizePool ?? '0', 50);

    const [match] = await db
      .insert(arenaMatch)
      .values({
        id: generateId(),
        topic,
        matchType,
        agents: sanitizedAgentIds,
        prizePool,
        status: 'pending',
        rounds: [],
        totalVotes: 0,
        createdAt: new Date(),
      })
      .returning();

    return apiSuccess({ match }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create arena match';
    return apiError(message, 500);
  }
}
