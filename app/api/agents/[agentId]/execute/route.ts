export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agent-api/auth';
import { db } from '@/lib/db';
import { agent, toolUsage } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateId } from 'ai';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agents/[agentId]/execute - Execute an agent's task
 * The agent runs its configured tools based on the input query
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  // Authenticate
  const authResult = await authenticateRequest(request);
  if (authResult.error) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  // Get agent
  const [agentData] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1);

  if (!agentData || agentData.status !== 'active') {
    return NextResponse.json({ error: 'Agent not found or inactive' }, { status: 404 });
  }

  let body: { query: string; toolOverrides?: Record<string, any> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const startTime = Date.now();
  const agentTools = (agentData.tools as string[]) || [];

  // Execute each tool the agent has access to (simplified: run first relevant tool)
  const results: any[] = [];
  let totalCost = 0;

  for (const toolName of agentTools) {
    const { getTool } = await import('@/lib/agent-api/tool-registry');
    const toolMeta = getTool(toolName);
    if (!toolMeta) continue;

    try {
      // Simple execution: pass query as input
      const toolInput = body.toolOverrides?.[toolName] || { query: body.query };
      const result = await toolMeta.tool.execute(toolInput);
      results.push({ tool: toolName, success: true, result });
      totalCost += toolMeta.pricePerCall;
    } catch (error) {
      results.push({
        tool: toolName,
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      });
    }
  }

  const latencyMs = Date.now() - startTime;

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
  await db.insert(toolUsage).values({
    id: generateId(),
    apiKeyId: authResult.apiKey.id,
    agentId,
    toolName: 'agent_execution',
    inputParams: { query: body.query },
    outputSummary: `Executed ${results.length} tools`,
    cost: String(totalCost),
    latencyMs,
    status: results.some((r) => r.success) ? 'success' : 'error',
    createdAt: new Date(),
  });

  return NextResponse.json({
    agentId,
    agentName: agentData.name,
    query: body.query,
    results,
    meta: {
      latencyMs,
      totalCost,
      costUnit: 'BBAI',
      toolsExecuted: results.length,
    },
  });
}
