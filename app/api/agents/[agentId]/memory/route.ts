export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { listMemories, recordMemory, getMemoryStats, type MemoryType } from '@/lib/agent-memory';

/**
 * Agent Memory API
 *
 * GET  /api/agents/[agentId]/memory  — list memories (with optional ?type= filter)
 * POST /api/agents/[agentId]/memory  — manually add a memory
 */

// ---------------------------------------------------------------------------
// GET — List memories
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  if (!agentId) {
    return apiError('agentId is required', 400);
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as MemoryType | null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;
  const includeStats = searchParams.get('stats') === 'true';

  // Validate type if provided
  if (type && !['episodic', 'semantic', 'procedural'].includes(type)) {
    return apiError('type must be one of: episodic, semantic, procedural', 400);
  }

  const memories = await listMemories(agentId, type ?? undefined, limit, offset);

  let stats = undefined;
  if (includeStats) {
    stats = await getMemoryStats(agentId);
  }

  return apiSuccess({
    agentId,
    memories,
    count: memories.length,
    ...(stats ? { stats } : {}),
  });
}

// ---------------------------------------------------------------------------
// POST — Add a memory
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  if (!agentId) {
    return apiError('agentId is required', 400);
  }

  const parsed = await parseJsonBody<{
    type?: string;
    content?: string;
    importance?: number;
    tags?: string[];
  }>(request);

  if ('error' in parsed) return parsed.error;

  const { type, content, importance, tags } = parsed.data;

  // Validate required fields
  if (!type || !['episodic', 'semantic', 'procedural'].includes(type)) {
    return apiError('type is required and must be one of: episodic, semantic, procedural', 400);
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return apiError('content is required and must be a non-empty string', 400);
  }

  if (importance !== undefined && (typeof importance !== 'number' || importance < 1 || importance > 10)) {
    return apiError('importance must be a number between 1 and 10', 400);
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    return apiError('tags must be an array of strings', 400);
  }

  const memoryId = await recordMemory({
    agentId,
    type: type as MemoryType,
    content: content.trim(),
    importance: importance ?? 5,
    tags: tags ?? [],
  });

  if (!memoryId) {
    return apiError('Failed to record memory', 500);
  }

  return apiSuccess({ id: memoryId, agentId, type, content: content.trim() }, 201);
}
