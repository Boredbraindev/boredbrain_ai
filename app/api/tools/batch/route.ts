import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agent-api/auth';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { toolUsage, apiKey as apiKeyTable } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateId } from 'ai';

interface BatchRequest {
  tool: string;
  input: any;
}

/**
 * POST /api/tools/batch - Execute multiple tools in parallel
 * Requires API key authentication
 *
 * Body: { requests: [{ tool: "coin_data", input: { coinId: "bitcoin" } }, ...] }
 * Max 10 tools per batch
 */
export async function POST(request: NextRequest) {
  const { getTool, hasTool } = await import('@/lib/agent-api/tool-registry');
  // Authenticate
  const authResult = await authenticateRequest(request);
  if (authResult.error) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  const { apiKey } = authResult;

  let body: { requests: BatchRequest[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.requests || !Array.isArray(body.requests) || body.requests.length === 0) {
    return NextResponse.json({ error: 'requests array is required' }, { status: 400 });
  }

  if (body.requests.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 tools per batch' }, { status: 400 });
  }

  // Validate all tools exist
  for (const req of body.requests) {
    if (!hasTool(req.tool)) {
      return NextResponse.json({ error: `Tool '${req.tool}' not found` }, { status: 404 });
    }
  }

  // Execute all tools in parallel
  const startTime = Date.now();
  const results = await Promise.allSettled(
    body.requests.map(async (req) => {
      const toolMeta = getTool(req.tool)!;
      const toolStart = Date.now();

      try {
        const result = await toolMeta.tool.execute(req.input);
        const latencyMs = Date.now() - toolStart;

        await db.insert(toolUsage).values({
          id: generateId(),
          apiKeyId: apiKey.id,
          toolName: req.tool,
          inputParams: req.input,
          outputSummary: JSON.stringify(result).slice(0, 500),
          cost: String(toolMeta.pricePerCall),
          latencyMs,
          status: 'success',
          createdAt: new Date(),
        });

        return {
          tool: req.tool,
          success: true,
          result,
          latencyMs,
          cost: toolMeta.pricePerCall,
        };
      } catch (error) {
        return {
          tool: req.tool,
          success: false,
          error: error instanceof Error ? error.message : 'Failed',
          latencyMs: Date.now() - toolStart,
          cost: 0,
        };
      }
    })
  );

  const totalCost = results.reduce((sum, r) => {
    if (r.status === 'fulfilled') return sum + (r.value.cost || 0);
    return sum;
  }, 0);

  // Update API key stats
  await db
    .update(apiKeyTable)
    .set({
      totalQueries: sql`${apiKeyTable.totalQueries} + ${body.requests.length}`,
      totalSpent: sql`CAST(CAST(${apiKeyTable.totalSpent} AS NUMERIC) + ${totalCost} AS TEXT)`,
    })
    .where(eq(apiKeyTable.id, apiKey.id));

  return NextResponse.json({
    success: true,
    totalLatencyMs: Date.now() - startTime,
    totalCost,
    costUnit: 'BBAI',
    results: results.map((r) => (r.status === 'fulfilled' ? r.value : { success: false, error: 'Execution failed' })),
  });
}
