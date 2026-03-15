export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

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
  const sql = neon(process.env.DATABASE_URL!);

  // Authenticate — inline API key validation
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');
  const key = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : apiKeyHeader;

  if (!key) {
    return NextResponse.json(
      { error: 'Missing API key. Include it as Bearer token or x-api-key header.' },
      { status: 401 },
    );
  }

  const apiKeyRows = await sql`
    SELECT id, rate_limit, status FROM api_key
    WHERE key = ${key} AND status = 'active'
    LIMIT 1
  `;

  if (apiKeyRows.length === 0) {
    return NextResponse.json({ error: 'Invalid or revoked API key.' }, { status: 401 });
  }

  const apiKeyRecord = apiKeyRows[0];

  // Update last used
  await sql`UPDATE api_key SET last_used_at = NOW() WHERE id = ${apiKeyRecord.id}`;

  // Get agent from the `agent` table (not external_agent)
  const agentRows = await sql`
    SELECT * FROM agent
    WHERE id = ${agentId}
    LIMIT 1
  `;

  if (agentRows.length === 0 || agentRows[0].status !== 'active') {
    return NextResponse.json({ error: 'Agent not found or inactive' }, { status: 404 });
  }

  const agentData = agentRows[0];

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
  await sql`
    UPDATE agent
    SET total_executions = total_executions + 1,
        total_revenue = CAST(CAST(total_revenue AS NUMERIC) + ${totalCost} AS TEXT),
        updated_at = NOW()
    WHERE id = ${agentId}
  `;

  // Log usage
  const usageId = crypto.randomUUID();
  await sql`
    INSERT INTO tool_usage (id, api_key_id, agent_id, tool_name, input_params, output_summary, cost, latency_ms, status, created_at)
    VALUES (${usageId}, ${apiKeyRecord.id}, ${agentId}, 'agent_execution', ${JSON.stringify({ query: body.query })}, ${`Executed ${results.length} tools`}, ${String(totalCost)}, ${latencyMs}, ${results.some((r) => r.success) ? 'success' : 'error'}, NOW())
  `;

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
