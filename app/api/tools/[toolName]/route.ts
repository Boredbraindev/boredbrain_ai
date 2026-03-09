import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agent-api/auth';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { toolUsage, apiKey as apiKeyTable } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateId } from 'ai';

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
  const authResult = await authenticateRequest(request);
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

  // Execute tool
  const startTime = Date.now();
  try {
    const result = await toolMeta.tool.execute(input);
    const latencyMs = Date.now() - startTime;

    // Log usage
    await db.insert(toolUsage).values({
      id: generateId(),
      apiKeyId: apiKey.id,
      toolName,
      inputParams: input,
      outputSummary: typeof result === 'object' ? JSON.stringify(result).slice(0, 500) : String(result).slice(0, 500),
      cost: String(toolMeta.pricePerCall),
      latencyMs,
      status: 'success',
      createdAt: new Date(),
    });

    // Increment query count
    await db
      .update(apiKeyTable)
      .set({
        totalQueries: sql`${apiKeyTable.totalQueries} + 1`,
        totalSpent: sql`CAST(CAST(${apiKeyTable.totalSpent} AS NUMERIC) + ${toolMeta.pricePerCall} AS TEXT)`,
      })
      .where(eq(apiKeyTable.id, apiKey.id));

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
    await db.insert(toolUsage).values({
      id: generateId(),
      apiKeyId: apiKey.id,
      toolName,
      inputParams: input,
      outputSummary: error instanceof Error ? error.message : 'Unknown error',
      cost: '0',
      latencyMs,
      status: 'error',
      createdAt: new Date(),
    });

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
