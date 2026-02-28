import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { agent } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateId } from 'ai';
import { hasTool } from '@/lib/agent-api/tool-registry';
import { MOCK_AGENTS } from '@/lib/mock-data';

/**
 * GET /api/agents - List all active agents (marketplace)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const dbPromise = db
      .select()
      .from(agent)
      .where(eq(agent.status, 'active'))
      .orderBy(desc(agent.totalExecutions))
      .limit(limit)
      .offset(offset);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    const agents = await Promise.race([dbPromise, timeout]);

    if (agents.length > 0) {
      return NextResponse.json({
        agents,
        pagination: { limit, offset, total: agents.length },
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
  } catch {
    // DB connection failed or timeout, fall through to mock data
  }

  // Return mock data as fallback
  const mockSlice = MOCK_AGENTS.slice(offset, offset + limit);
  return NextResponse.json({
    agents: mockSlice,
    pagination: { limit, offset, total: MOCK_AGENTS.length },
  });
}

/**
 * POST /api/agents - Register a new agent
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: {
    name: string;
    description?: string;
    capabilities: string[];
    systemPrompt?: string;
    tools: string[];
    pricePerQuery?: string;
    chainId?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.name || !body.tools || body.tools.length === 0) {
    return NextResponse.json({ error: 'name and tools are required' }, { status: 400 });
  }

  // Validate tools exist
  for (const toolName of body.tools) {
    if (!hasTool(toolName)) {
      return NextResponse.json({ error: `Tool '${toolName}' not found` }, { status: 400 });
    }
  }

  const [newAgent] = await db
    .insert(agent)
    .values({
      id: generateId(),
      ownerId: user.id,
      name: body.name,
      description: body.description || '',
      capabilities: body.capabilities || body.tools,
      systemPrompt: body.systemPrompt || '',
      tools: body.tools,
      pricePerQuery: body.pricePerQuery || '10',
      chainId: body.chainId || 8453,
      totalExecutions: 0,
      totalRevenue: '0',
      rating: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ agent: newAgent }, { status: 201 });
}
