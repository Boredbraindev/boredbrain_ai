import { db } from '@/lib/db';
import { agent, toolUsage } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getTool } from '@/lib/agent-api/tool-registry';
import { generateId } from 'ai';

export interface ExecutionResult {
  agentId: string;
  agentName: string;
  query: string;
  toolResults: Array<{
    tool: string;
    success: boolean;
    result?: any;
    error?: string;
    latencyMs: number;
  }>;
  totalCost: number;
  totalLatencyMs: number;
}

/**
 * Execute an agent's tools against a query
 */
export async function executeAgent(
  agentId: string,
  query: string,
  apiKeyId?: string
): Promise<ExecutionResult> {
  const [agentData] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1);

  if (!agentData || agentData.status !== 'active') {
    throw new Error('Agent not found or inactive');
  }

  const startTime = Date.now();
  const agentTools = (agentData.tools as string[]) || [];
  const toolResults: ExecutionResult['toolResults'] = [];
  let totalCost = 0;

  // Execute tools sequentially for deterministic results
  for (const toolName of agentTools) {
    const toolMeta = getTool(toolName);
    if (!toolMeta) continue;

    const toolStart = Date.now();

    try {
      const result = await toolMeta.tool.execute({
        query,
        queries: [query],
      });

      toolResults.push({
        tool: toolName,
        success: true,
        result,
        latencyMs: Date.now() - toolStart,
      });

      totalCost += toolMeta.pricePerCall;
    } catch (error) {
      toolResults.push({
        tool: toolName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - toolStart,
      });
    }
  }

  const totalLatencyMs = Date.now() - startTime;

  // Update agent stats
  await db
    .update(agent)
    .set({
      totalExecutions: sql`${agent.totalExecutions} + 1`,
      totalRevenue: sql`CAST(CAST(${agent.totalRevenue} AS NUMERIC) + ${totalCost} AS TEXT)`,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, agentId));

  // Log usage
  if (apiKeyId) {
    await db.insert(toolUsage).values({
      id: generateId(),
      apiKeyId,
      agentId,
      toolName: 'agent_execution',
      inputParams: { query },
      outputSummary: `Ran ${toolResults.length} tools, ${toolResults.filter((r) => r.success).length} succeeded`,
      cost: String(totalCost),
      latencyMs: totalLatencyMs,
      status: toolResults.some((r) => r.success) ? 'success' : 'error',
      createdAt: new Date(),
    });
  }

  return {
    agentId,
    agentName: agentData.name,
    query,
    toolResults,
    totalCost,
    totalLatencyMs,
  };
}
