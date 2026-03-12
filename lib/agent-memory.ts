/**
 * Agent Memory System
 *
 * Hierarchical memory for agents: episodic (past interactions), semantic (facts),
 * and procedural (learned patterns). Also manages inter-agent trust relationships.
 *
 * DB-first with 3s timeout, falls back to empty results on failure.
 */

import { db } from '@/lib/db';
import { agentMemory, agentRelationship } from '@/lib/db/schema';
import { eq, and, desc, sql, ilike, or, asc } from 'drizzle-orm';
import { generateId } from 'ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryType = 'episodic' | 'semantic' | 'procedural';

export interface MemoryInput {
  agentId: string;
  type: MemoryType;
  content: string;
  importance?: number; // 1-10, default 5
  tags?: string[];
}

export interface MemoryStats {
  total: number;
  episodic: number;
  semantic: number;
  procedural: number;
  avgImportance: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a DB operation with a 3-second timeout, returning fallback on failure. */
async function withTimeout<T>(operation: Promise<T>, fallback: T): Promise<T> {
  try {
    const result = await Promise.race([
      operation,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      ),
    ]);
    return result;
  } catch (err) {
    console.error('[agent-memory] DB error:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Core Memory Operations
// ---------------------------------------------------------------------------

/**
 * Store a new memory for an agent.
 */
export async function recordMemory(input: MemoryInput): Promise<string | null> {
  const id = generateId();
  const importance = Math.max(1, Math.min(10, input.importance ?? 5));

  return withTimeout(
    (async () => {
      await db.insert(agentMemory).values({
        id,
        agentId: input.agentId,
        type: input.type,
        content: input.content.slice(0, 5000), // cap content length
        importance,
        tags: input.tags ?? [],
        accessCount: 0,
        lastAccessed: null,
        createdAt: new Date(),
      });
      return id;
    })(),
    null,
  );
}

/**
 * Retrieve relevant memories for an agent, searching by tags and content.
 * Uses ILIKE for content matching and jsonb containment for tags.
 */
export async function recallMemories(
  agentId: string,
  query: string,
  limit: number = 5,
): Promise<typeof agentMemory.$inferSelect[]> {
  return withTimeout(
    (async () => {
      // Extract keywords from the query for ILIKE search
      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 5);

      if (keywords.length === 0) {
        // No useful keywords — return most recent important memories
        const rows = await db
          .select()
          .from(agentMemory)
          .where(eq(agentMemory.agentId, agentId))
          .orderBy(desc(agentMemory.importance), desc(agentMemory.createdAt))
          .limit(limit);
        return rows;
      }

      // Build ILIKE conditions for content matching
      const contentConditions = keywords.map((kw) =>
        ilike(agentMemory.content, `%${kw}%`),
      );

      const rows = await db
        .select()
        .from(agentMemory)
        .where(
          and(
            eq(agentMemory.agentId, agentId),
            or(...contentConditions),
          ),
        )
        .orderBy(desc(agentMemory.importance), desc(agentMemory.createdAt))
        .limit(limit);

      // Update access count for recalled memories
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        // Fire-and-forget — don't block recall on access count updates
        for (const memId of ids) {
          db.update(agentMemory)
            .set({
              accessCount: sql`${agentMemory.accessCount} + 1`,
              lastAccessed: new Date(),
            })
            .where(eq(agentMemory.id, memId))
            .catch(() => {});
        }
      }

      return rows;
    })(),
    [],
  );
}

/**
 * List memories for an agent with optional type filter.
 */
export async function listMemories(
  agentId: string,
  type?: MemoryType,
  limit: number = 50,
  offset: number = 0,
): Promise<typeof agentMemory.$inferSelect[]> {
  return withTimeout(
    (async () => {
      const conditions = [eq(agentMemory.agentId, agentId)];
      if (type) {
        conditions.push(eq(agentMemory.type, type));
      }

      const rows = await db
        .select()
        .from(agentMemory)
        .where(and(...conditions))
        .orderBy(desc(agentMemory.createdAt))
        .limit(limit)
        .offset(offset);

      return rows;
    })(),
    [],
  );
}

// ---------------------------------------------------------------------------
// Relationship / Trust Operations
// ---------------------------------------------------------------------------

/**
 * Record or update an interaction between two agents, adjusting trust score.
 * outcome: 'positive' (+5), 'neutral' (+0), 'negative' (-10)
 */
export async function recordInteraction(
  agentId: string,
  targetAgentId: string,
  outcome: 'positive' | 'neutral' | 'negative',
): Promise<void> {
  const trustDelta = outcome === 'positive' ? 5 : outcome === 'negative' ? -10 : 0;

  await withTimeout(
    (async () => {
      // Check if relationship exists
      const existing = await db
        .select()
        .from(agentRelationship)
        .where(
          and(
            eq(agentRelationship.agentId, agentId),
            eq(agentRelationship.targetAgentId, targetAgentId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const currentTrust = existing[0].trustScore ?? 50;
        const newTrust = Math.max(0, Math.min(100, currentTrust + trustDelta));

        await db
          .update(agentRelationship)
          .set({
            trustScore: newTrust,
            interactionCount: sql`${agentRelationship.interactionCount} + 1`,
            lastInteraction: new Date(),
            notes: `Last outcome: ${outcome}`,
          })
          .where(eq(agentRelationship.id, existing[0].id));
      } else {
        await db.insert(agentRelationship).values({
          id: generateId(),
          agentId,
          targetAgentId,
          trustScore: Math.max(0, Math.min(100, 50 + trustDelta)),
          interactionCount: 1,
          lastInteraction: new Date(),
          notes: `First interaction: ${outcome}`,
          createdAt: new Date(),
        });
      }
    })(),
    undefined,
  );
}

/**
 * Get all trust relationships for an agent.
 */
export async function getRelationships(
  agentId: string,
): Promise<typeof agentRelationship.$inferSelect[]> {
  return withTimeout(
    db
      .select()
      .from(agentRelationship)
      .where(eq(agentRelationship.agentId, agentId))
      .orderBy(desc(agentRelationship.trustScore)),
    [],
  );
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Prune low-importance old memories, keeping the top N by importance + recency.
 */
export async function pruneMemories(
  agentId: string,
  keepTop: number = 100,
): Promise<number> {
  return withTimeout(
    (async () => {
      // Get the IDs to keep (highest importance, most recent)
      const toKeep = await db
        .select({ id: agentMemory.id })
        .from(agentMemory)
        .where(eq(agentMemory.agentId, agentId))
        .orderBy(desc(agentMemory.importance), desc(agentMemory.createdAt))
        .limit(keepTop);

      const keepIds = toKeep.map((r) => r.id);

      if (keepIds.length === 0) return 0;

      // Count total before pruning
      const totalResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentMemory)
        .where(eq(agentMemory.agentId, agentId));

      const total = totalResult[0]?.count ?? 0;
      const toDelete = total - keepIds.length;

      if (toDelete <= 0) return 0;

      // Delete memories not in the keep list
      // Neon HTTP driver doesn't support NOT IN with arrays well,
      // so we delete by selecting IDs to remove explicitly
      const allIds = await db
        .select({ id: agentMemory.id })
        .from(agentMemory)
        .where(eq(agentMemory.agentId, agentId))
        .orderBy(asc(agentMemory.importance), asc(agentMemory.createdAt));

      const keepSet = new Set(keepIds);
      const deleteIds = allIds.map((r) => r.id).filter((id) => !keepSet.has(id));

      for (const id of deleteIds) {
        await db.delete(agentMemory).where(eq(agentMemory.id, id));
      }

      return deleteIds.length;
    })(),
    0,
  );
}

/**
 * Get memory statistics for an agent.
 */
export async function getMemoryStats(agentId: string): Promise<MemoryStats> {
  return withTimeout(
    (async () => {
      const rows = await db
        .select({
          type: agentMemory.type,
          count: sql<number>`count(*)::int`,
          avgImportance: sql<number>`coalesce(avg(${agentMemory.importance}), 0)::float`,
        })
        .from(agentMemory)
        .where(eq(agentMemory.agentId, agentId))
        .groupBy(agentMemory.type);

      const stats: MemoryStats = {
        total: 0,
        episodic: 0,
        semantic: 0,
        procedural: 0,
        avgImportance: 0,
      };

      let totalImportanceSum = 0;
      for (const row of rows) {
        const count = row.count;
        stats.total += count;
        totalImportanceSum += row.avgImportance * count;

        if (row.type === 'episodic') stats.episodic = count;
        else if (row.type === 'semantic') stats.semantic = count;
        else if (row.type === 'procedural') stats.procedural = count;
      }

      stats.avgImportance = stats.total > 0
        ? Math.round((totalImportanceSum / stats.total) * 10) / 10
        : 0;

      return stats;
    })(),
    { total: 0, episodic: 0, semantic: 0, procedural: 0, avgImportance: 0 },
  );
}

// ---------------------------------------------------------------------------
// Context Building (for LLM injection)
// ---------------------------------------------------------------------------

/**
 * Build a context string from relevant memories for injection into the system prompt.
 * Returns empty string if no memories found (keeps LLM call cost-free when empty).
 */
export async function buildContextFromMemory(
  agentId: string,
  query: string,
): Promise<string> {
  const memories = await recallMemories(agentId, query, 5);

  if (memories.length === 0) return '';

  const parts: string[] = ['[Agent Memory Context]'];

  for (const mem of memories) {
    const typeLabel = mem.type === 'episodic'
      ? 'Past interaction'
      : mem.type === 'semantic'
        ? 'Known fact'
        : 'Learned pattern';
    parts.push(`- ${typeLabel} (importance: ${mem.importance}/10): ${mem.content}`);
  }

  // Also fetch top relationships if query mentions other agents
  const relationships = await getRelationships(agentId);
  if (relationships.length > 0) {
    parts.push('\n[Agent Relationships]');
    for (const rel of relationships.slice(0, 3)) {
      parts.push(
        `- Agent ${rel.targetAgentId}: trust ${rel.trustScore}/100, ${rel.interactionCount} interactions`,
      );
    }
  }

  return parts.join('\n');
}
