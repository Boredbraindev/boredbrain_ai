import { db } from '@/lib/db';
import { agent, arenaMatch, toolUsage } from '@/lib/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { getTool } from '@/lib/agent-api/tool-registry';
import { generateId } from 'ai';

export type MatchType = 'debate' | 'search_race' | 'research';

export interface RoundResult {
  agentId: string;
  agentName: string;
  response: string;
  toolsUsed: string[];
  score: number;
  latencyMs: number;
  timestamp: string;
}

/**
 * Execute an arena match - runs all agents against a topic
 */
export async function executeMatch(matchId: string): Promise<{
  rounds: RoundResult[];
  winnerId: string | null;
}> {
  const [match] = await db
    .select()
    .from(arenaMatch)
    .where(eq(arenaMatch.id, matchId))
    .limit(1);

  if (!match) throw new Error('Match not found');

  const agentIds = match.agents as string[];
  const agents = await db
    .select()
    .from(agent)
    .where(inArray(agent.id, agentIds));

  // Mark match as active
  await db
    .update(arenaMatch)
    .set({ status: 'active' })
    .where(eq(arenaMatch.id, matchId));

  const rounds: RoundResult[] = [];

  // Run each agent in parallel
  const agentResults = await Promise.allSettled(
    agents.map(async (agentData) => {
      const startTime = Date.now();
      const agentTools = (agentData.tools as string[]) || [];
      const toolsUsed: string[] = [];
      const responses: string[] = [];

      // Execute up to 3 of the agent's tools
      for (const toolName of agentTools.slice(0, 3)) {
        const toolMeta = getTool(toolName);
        if (!toolMeta) continue;

        try {
          const result = await toolMeta.tool.execute({
            query: match.topic,
            queries: [match.topic],
            coinId: match.topic.toLowerCase().includes('bitcoin') ? 'bitcoin' : undefined,
          });
          toolsUsed.push(toolName);

          const resultStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
          responses.push(resultStr.slice(0, 1000));
        } catch {
          // Tool failed, continue with others
        }
      }

      const latencyMs = Date.now() - startTime;
      const response = responses.join('\n---\n').slice(0, 3000);

      // Score based on: response quality (length), tools used, speed
      const lengthScore = Math.min(40, (response.length / 100) * 10);
      const toolScore = toolsUsed.length * 15;
      const speedScore = Math.max(0, 30 - (latencyMs / 1000) * 5);
      const score = Math.round(Math.min(100, lengthScore + toolScore + speedScore));

      return {
        agentId: agentData.id,
        agentName: agentData.name,
        response,
        toolsUsed,
        score,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    })
  );

  // Collect results
  for (const result of agentResults) {
    if (result.status === 'fulfilled') {
      rounds.push(result.value);

      // Update agent execution count
      await db
        .update(agent)
        .set({
          totalExecutions: sql`${agent.totalExecutions} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(agent.id, result.value.agentId));
    }
  }

  // Sort by score descending
  rounds.sort((a, b) => b.score - a.score);

  const winnerId = rounds.length > 0 ? rounds[0].agentId : null;

  // Update match with results
  await db
    .update(arenaMatch)
    .set({
      rounds: rounds.map((r) => ({
        agentId: r.agentId,
        response: r.response,
        toolsUsed: r.toolsUsed,
        score: r.score,
        timestamp: r.timestamp,
      })),
      winnerId,
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(arenaMatch.id, matchId));

  return { rounds, winnerId };
}

/**
 * Get leaderboard - top agents by execution count and rating
 */
export async function getLeaderboard(limit = 20) {
  const agents = await db
    .select({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      tools: agent.tools,
      totalExecutions: agent.totalExecutions,
      totalRevenue: agent.totalRevenue,
      rating: agent.rating,
      createdAt: agent.createdAt,
    })
    .from(agent)
    .where(eq(agent.status, 'active'))
    .orderBy(sql`${agent.totalExecutions} DESC`)
    .limit(limit);

  return agents;
}
