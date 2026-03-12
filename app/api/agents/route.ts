import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { agent, user } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateId } from 'ai';
import { MOCK_AGENTS } from '@/lib/mock-data';

/**
 * GET /api/agents - List agents
 *   ?owner=0xABC...  — filter by wallet address (returns only that user's agents)
 *   Without owner    — returns all active agents (marketplace view)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
  const offset = parseInt(searchParams.get('offset') || '0');
  const ownerWallet = searchParams.get('owner');

  try {
    let dbPromise;

    if (ownerWallet && /^0x[0-9a-fA-F]{40}$/.test(ownerWallet)) {
      // User-specific: join agent + user to filter by wallet address
      dbPromise = db
        .select({
          id: agent.id,
          ownerId: agent.ownerId,
          name: agent.name,
          description: agent.description,
          capabilities: agent.capabilities,
          systemPrompt: agent.systemPrompt,
          tools: agent.tools,
          pricePerQuery: agent.pricePerQuery,
          nftTokenId: agent.nftTokenId,
          chainId: agent.chainId,
          txHash: agent.txHash,
          totalExecutions: agent.totalExecutions,
          totalRevenue: agent.totalRevenue,
          rating: agent.rating,
          eloRating: agent.eloRating,
          status: agent.status,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        })
        .from(agent)
        .innerJoin(user, eq(agent.ownerId, user.id))
        .where(eq(user.walletAddress, ownerWallet.toLowerCase()))
        .orderBy(desc(agent.totalExecutions))
        .limit(limit)
        .offset(offset);
    } else {
      // Marketplace: all active agents
      dbPromise = db
        .select()
        .from(agent)
        .where(eq(agent.status, 'active'))
        .orderBy(desc(agent.totalExecutions))
        .limit(limit)
        .offset(offset);
    }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    const agents = await Promise.race([dbPromise, timeout]);

    // For owner-filtered queries, always return result (even empty)
    if (ownerWallet) {
      return NextResponse.json({
        agents,
        pagination: { limit, offset, total: agents.length },
      });
    }

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
    // For owner-filtered queries, return empty on failure
    if (ownerWallet) {
      return NextResponse.json({
        agents: [],
        pagination: { limit, offset, total: 0 },
      });
    }
  }

  // Return mock data as fallback (marketplace only)
  const mockSlice = limit ? MOCK_AGENTS.slice(offset, offset + limit) : MOCK_AGENTS.slice(offset);
  return NextResponse.json({
    agents: mockSlice,
    pagination: { limit: limit ?? mockSlice.length, offset, total: MOCK_AGENTS.length },
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

  // Validate tools exist (dynamic import to avoid Daytona SDK init at build time)
  const { hasTool } = await import('@/lib/agent-api/tool-registry');
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
