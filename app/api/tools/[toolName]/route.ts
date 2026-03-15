export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * Inline auth: validate API key from request headers using raw SQL.
 */
async function authenticateRequestEdge(request: Request) {
  // Extract API key
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

  // Update last used timestamp (fire and forget)
  sql`UPDATE api_key SET last_used_at = NOW() WHERE id = ${record.id}`.catch(() => {});

  return { error: false, apiKey: record } as const;
}

/**
 * POST /api/tools/[toolName] - Execute a specific tool
 * Requires API key authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ toolName: string }> }
) {
  const { toolName } = await params;

  // Dynamic import to avoid Daytona SDK init at build time
  const { hasTool, getTool } = await import('@/lib/agent-api/tool-registry');

  // Check tool exists
  if (!hasTool(toolName)) {
    return NextResponse.json(
      {
        error: `Tool '${toolName}' not found`,
        availableTools: '/api/tools',
      },
      { status: 404 }
    );
  }

  // Authenticate
  const authResult = await authenticateRequestEdge(request);
  if (authResult.error) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  const { apiKey } = authResult;
  const toolMeta = getTool(toolName)!;

  // Check permissions
  const permissions = apiKey.permissions as string[] | null;
  if (permissions && permissions.length > 0 && !permissions.includes('*') && !permissions.includes(toolName)) {
    return NextResponse.json(
      { error: `API key does not have permission to use tool '${toolName}'` },
      { status: 403 }
    );
  }

  // Parse input
  let input: any;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Execute tool
  const startTime = Date.now();
  try {
    const result = await toolMeta.tool.execute(input);
    const latencyMs = Date.now() - startTime;

    // Log usage
    const usageId = crypto.randomUUID();
    await sql`
      INSERT INTO tool_usage (id, api_key_id, tool_name, input_params, output_summary, cost, latency_ms, status, created_at)
      VALUES (${usageId}, ${apiKey.id}, ${toolName}, ${JSON.stringify(input)}, ${typeof result === 'object' ? JSON.stringify(result).slice(0, 500) : String(result).slice(0, 500)}, ${String(toolMeta.pricePerCall)}, ${latencyMs}, 'success', NOW())
    `;

    // Increment query count
    await sql`
      UPDATE api_key
      SET total_queries = total_queries + 1,
          total_spent = CAST(CAST(total_spent AS NUMERIC) + ${toolMeta.pricePerCall} AS TEXT)
      WHERE id = ${apiKey.id}
    `;

    return NextResponse.json({
      success: true,
      tool: toolName,
      result,
      meta: {
        latencyMs,
        cost: toolMeta.pricePerCall,
        costUnit: 'BBAI',
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Log failed usage
    const usageId = crypto.randomUUID();
    await sql`
      INSERT INTO tool_usage (id, api_key_id, tool_name, input_params, output_summary, cost, latency_ms, status, created_at)
      VALUES (${usageId}, ${apiKey.id}, ${toolName}, ${JSON.stringify(input)}, ${error instanceof Error ? error.message : 'Unknown error'}, '0', ${latencyMs}, 'error', NOW())
    `;

    return NextResponse.json(
      {
        success: false,
        tool: toolName,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tools/[toolName] - Get tool details and schema
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ toolName: string }> }
) {
  const { toolName } = await params;

  const { hasTool: hasT, getTool: getT } = await import('@/lib/agent-api/tool-registry');
  if (!hasT(toolName)) {
    return NextResponse.json({ error: `Tool '${toolName}' not found` }, { status: 404 });
  }

  const toolMeta = getT(toolName)!;

  return NextResponse.json({
    name: toolMeta.name,
    description: toolMeta.description,
    category: toolMeta.category,
    pricePerCall: toolMeta.pricePerCall,
    priceUnit: 'BBAI',
    rateLimit: toolMeta.rateLimit,
    inputSchema: toolMeta.tool.inputSchema
      ? JSON.parse(JSON.stringify(toolMeta.tool.inputSchema))
      : null,
  });
}
