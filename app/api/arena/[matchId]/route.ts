import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { arenaMatch, agent } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getTool } from '@/lib/agent-api/tool-registry';

/**
 * GET /api/arena/[matchId] - Get match details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const [match] = await db
    .select()
    .from(arenaMatch)
    .where(eq(arenaMatch.id, matchId))
    .limit(1);

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  return NextResponse.json({ match });
}

/**
 * POST /api/arena/[matchId] - Start/execute a match
 * Runs all participating agents against the topic
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const [match] = await db
    .select()
    .from(arenaMatch)
    .where(eq(arenaMatch.id, matchId))
    .limit(1);

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (match.status !== 'pending') {
    return NextResponse.json({ error: 'Match already started or completed' }, { status: 400 });
  }

  // Update status to active
  await db
    .update(arenaMatch)
    .set({ status: 'active' })
    .where(eq(arenaMatch.id, matchId));

  const agentIds = match.agents as string[];
  const rounds: Array<{
    agentId: string;
    response: string;
    toolsUsed: string[];
    score: number;
    timestamp: string;
  }> = [];

  // Execute each agent
  for (const agentId of agentIds) {
    const [agentData] = await db
      .select()
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1);

    if (!agentData) continue;

    const agentTools = (agentData.tools as string[]) || [];
    const toolsUsed: string[] = [];
    let response = '';

    // Execute agent's tools
    for (const toolName of agentTools.slice(0, 3)) {
      const toolMeta = getTool(toolName);
      if (!toolMeta) continue;

      try {
        const result = await toolMeta.tool.execute({ query: match.topic, queries: [match.topic] });
        toolsUsed.push(toolName);
        response += JSON.stringify(result).slice(0, 500) + '\n';
      } catch {
        // Tool failed, skip
      }
    }

    // Simple scoring based on response length and tools used
    const score = Math.min(100, (response.length / 10) + (toolsUsed.length * 20));

    rounds.push({
      agentId,
      response: response.slice(0, 2000),
      toolsUsed,
      score: Math.round(score),
      timestamp: new Date().toISOString(),
    });

    // Update agent execution count
    await db
      .update(agent)
      .set({ totalExecutions: sql`${agent.totalExecutions} + 1` })
      .where(eq(agent.id, agentId));
  }

  // Determine winner (highest score)
  const winner = rounds.reduce((best, round) =>
    round.score > best.score ? round : best
  , rounds[0]);

  // Update match with results
  await db
    .update(arenaMatch)
    .set({
      rounds,
      winnerId: winner?.agentId || null,
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(arenaMatch.id, matchId));

  return NextResponse.json({
    match: {
      id: matchId,
      topic: match.topic,
      status: 'completed',
      winner: winner?.agentId,
      rounds,
    },
  });
}
