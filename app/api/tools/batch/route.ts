export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * Inline auth: validate API key from request headers using raw SQL.
 */
async function authenticateRequestEdge(request: Request) {
  const authHeader = request.headers.get('authorization');
  let key: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    key = authHeader.slice(7);
  }
  if (!key) {
    key = request.headers.get('x-api-key');
  }

  if (!key) {
    return {
      error: true,
      status: 401,
      body: { error: 'Missing API key. Include it as Bearer token or x-api-key header.' },
    } as const;
  }

  if (!key.startsWith('bb_sk_')) {
    return {
      error: true,
      status: 401,
      body: { error: 'Invalid or revoked API key.' },
    } as const;
  }

  const sql = neon(process.env.DATABASE_URL!);
  const records = await sql`
    SELECT * FROM api_key WHERE key = ${key} AND status = 'active' LIMIT 1
  `;

  if (records.length === 0) {
    return {
      error: true,
      status: 401,
      body: { error: 'Invalid or revoked API key.' },
    } as const;
  }

  const record = records[0];
  sql`UPDATE api_key SET last_used_at = NOW() WHERE id = ${record.id}`.catch(() => {});

  return { error: false, apiKey: record } as const;
}

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
  const authResult = await authenticateRequestEdge(request);
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

  const sql = neon(process.env.DATABASE_URL!);

  // Execute all tools in parallel
  const startTime = Date.now();
  const results = await Promise.allSettled(
    body.requests.map(async (req) => {
      const toolMeta = getTool(req.tool)!;
      const toolStart = Date.now();

      try {
        const result = await toolMeta.tool.execute(req.input);
        const latencyMs = Date.now() - toolStart;

        const usageId = crypto.randomUUID();
        await sql`
          INSERT INTO tool_usage (id, api_key_id, tool_name, input_params, output_summary, cost, latency_ms, status, created_at)
          VALUES (${usageId}, ${apiKey.id}, ${req.tool}, ${JSON.stringify(req.input)}, ${JSON.stringify(result).slice(0, 500)}, ${String(toolMeta.pricePerCall)}, ${latencyMs}, 'success', NOW())
        `;

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
  await sql`
    UPDATE api_key
    SET total_queries = total_queries + ${body.requests.length},
        total_spent = CAST(CAST(total_spent AS NUMERIC) + ${totalCost} AS TEXT)
    WHERE id = ${apiKey.id}
  `;

  return NextResponse.json({
    success: true,
    totalLatencyMs: Date.now() - startTime,
    totalCost,
    costUnit: 'BBAI',
    results: results.map((r) => (r.status === 'fulfilled' ? r.value : { success: false, error: 'Execution failed' })),
  });
}
