import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { promptTemplate, promptPurchase, user, agent } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from 'ai';
import { MOCK_PROMPTS } from '../route';

/**
 * GET /api/prompts/[promptId] - Get prompt template details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  const { promptId } = await params;

  try {
    const dbPromise = db
      .select({
        id: promptTemplate.id,
        creatorId: promptTemplate.creatorId,
        creatorName: user.name,
        title: promptTemplate.title,
        description: promptTemplate.description,
        systemPrompt: promptTemplate.systemPrompt,
        category: promptTemplate.category,
        tags: promptTemplate.tags,
        previewMessages: promptTemplate.previewMessages,
        tools: promptTemplate.tools,
        price: promptTemplate.price,
        totalSales: promptTemplate.totalSales,
        totalRevenue: promptTemplate.totalRevenue,
        rating: promptTemplate.rating,
        ratingCount: promptTemplate.ratingCount,
        status: promptTemplate.status,
        featured: promptTemplate.featured,
        createdAt: promptTemplate.createdAt,
        updatedAt: promptTemplate.updatedAt,
      })
      .from(promptTemplate)
      .leftJoin(user, eq(promptTemplate.creatorId, user.id))
      .where(eq(promptTemplate.id, promptId))
      .limit(1);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    const [prompt] = await Promise.race([dbPromise, timeout]);

    if (prompt) {
      // Check if current user has purchased
      const currentUser = await getUser();
      let purchased = false;
      if (currentUser) {
        const [purchase] = await db
          .select()
          .from(promptPurchase)
          .where(
            and(
              eq(promptPurchase.promptId, promptId),
              eq(promptPurchase.buyerId, currentUser.id)
            )
          )
          .limit(1);
        purchased = !!purchase || prompt.creatorId === currentUser.id;
      }

      return NextResponse.json({ prompt, purchased });
    }
  } catch {
    // DB failed, try mock
  }

  // Mock fallback
  const mockPrompt = MOCK_PROMPTS.find((p) => p.id === promptId);
  if (mockPrompt) {
    return NextResponse.json({ prompt: mockPrompt, purchased: false });
  }

  return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
}

/**
 * POST /api/prompts/[promptId] - Purchase prompt or convert to agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  const { promptId } = await params;
  const currentUser = await getUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { action: 'purchase' | 'convert_to_agent' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Get prompt
  const [prompt] = await db
    .select()
    .from(promptTemplate)
    .where(eq(promptTemplate.id, promptId))
    .limit(1);

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }

  if (body.action === 'purchase') {
    // Check if already purchased
    const [existing] = await db
      .select()
      .from(promptPurchase)
      .where(
        and(
          eq(promptPurchase.promptId, promptId),
          eq(promptPurchase.buyerId, currentUser.id)
        )
      )
      .limit(1);

    if (existing || prompt.creatorId === currentUser.id) {
      return NextResponse.json({ error: 'Already owned' }, { status: 400 });
    }

    // Record purchase
    const [purchase] = await db
      .insert(promptPurchase)
      .values({
        id: generateId(),
        promptId,
        buyerId: currentUser.id,
        price: prompt.price,
        createdAt: new Date(),
      })
      .returning();

    // Update sales stats
    const newSales = (prompt.totalSales || 0) + 1;
    const newRevenue = (
      parseFloat(prompt.totalRevenue || '0') + parseFloat(prompt.price)
    ).toString();

    await db
      .update(promptTemplate)
      .set({
        totalSales: newSales,
        totalRevenue: newRevenue,
        updatedAt: new Date(),
      })
      .where(eq(promptTemplate.id, promptId));

    return NextResponse.json({ purchase, success: true }, { status: 201 });
  }

  if (body.action === 'convert_to_agent') {
    // Check ownership (purchased or creator)
    const [purchase] = await db
      .select()
      .from(promptPurchase)
      .where(
        and(
          eq(promptPurchase.promptId, promptId),
          eq(promptPurchase.buyerId, currentUser.id)
        )
      )
      .limit(1);

    if (!purchase && prompt.creatorId !== currentUser.id) {
      return NextResponse.json(
        { error: 'You must purchase this prompt first' },
        { status: 403 }
      );
    }

    // Create agent from prompt template
    const [newAgent] = await db
      .insert(agent)
      .values({
        id: generateId(),
        ownerId: currentUser.id,
        name: prompt.title,
        description: prompt.description || '',
        capabilities: (prompt.tags as string[]) || [],
        systemPrompt: prompt.systemPrompt,
        tools: (prompt.tools as string[]) || [],
        pricePerQuery: '10',
        chainId: 8453,
        totalExecutions: 0,
        totalRevenue: '0',
        rating: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ agent: newAgent, success: true }, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
