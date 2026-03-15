export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { MOCK_PROMPTS } from '../route';
import { SHOWCASE_PROMPTS } from '@/lib/showcase-prompts';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Helper to get current user in Edge
async function getEdgeUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/prompts/[promptId] - Get prompt template details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  const { promptId } = await params;

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const dbPromise = sql`
      SELECT
        pt.id, pt.creator_id, u.name AS creator_name,
        pt.title, pt.description, pt.system_prompt,
        pt.category, pt.tags, pt.preview_messages, pt.tools,
        pt.price, pt.total_sales, pt.total_revenue,
        pt.rating, pt.rating_count, pt.status, pt.featured,
        pt.created_at, pt.updated_at
      FROM prompt_template pt
      LEFT JOIN "user" u ON pt.creator_id = u.id
      WHERE pt.id = ${promptId}
      LIMIT 1
    `;

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    const rows = await Promise.race([dbPromise, timeout]);
    const prompt = rows[0];

    if (prompt) {
      // Check if current user has purchased
      const currentUser = await getEdgeUser();
      let purchased = false;
      if (currentUser) {
        const purchaseRows = await sql`
          SELECT id FROM prompt_purchase
          WHERE prompt_id = ${promptId} AND buyer_id = ${currentUser.id}
          LIMIT 1
        `;
        purchased = purchaseRows.length > 0 || prompt.creator_id === currentUser.id;
      }

      return NextResponse.json({ prompt, purchased });
    }
  } catch {
    // DB failed, try mock
  }

  // Mock fallback — check both MOCK_PROMPTS and SHOWCASE_PROMPTS
  const mockPrompt = MOCK_PROMPTS.find((p) => p.id === promptId)
    || SHOWCASE_PROMPTS.find((p) => p.id === promptId);
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
  const currentUser = await getEdgeUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { action: 'purchase' | 'convert_to_agent' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Get prompt
  const promptRows = await sql`
    SELECT * FROM prompt_template WHERE id = ${promptId} LIMIT 1
  `;
  const prompt = promptRows[0];

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }

  if (body.action === 'purchase') {
    // Check if already purchased
    const existingRows = await sql`
      SELECT id FROM prompt_purchase
      WHERE prompt_id = ${promptId} AND buyer_id = ${currentUser.id}
      LIMIT 1
    `;

    if (existingRows.length > 0 || prompt.creator_id === currentUser.id) {
      return NextResponse.json({ error: 'Already owned' }, { status: 400 });
    }

    // Generate a unique ID
    const purchaseId = crypto.randomUUID();

    // Record purchase
    const [purchase] = await sql`
      INSERT INTO prompt_purchase (id, prompt_id, buyer_id, price, created_at)
      VALUES (${purchaseId}, ${promptId}, ${currentUser.id}, ${prompt.price}, NOW())
      RETURNING *
    `;

    // Update sales stats
    const newSales = (prompt.total_sales || 0) + 1;
    const newRevenue = (
      parseFloat(prompt.total_revenue || '0') + parseFloat(prompt.price)
    ).toString();

    await sql`
      UPDATE prompt_template SET total_sales = ${newSales}, total_revenue = ${newRevenue}, updated_at = NOW()
      WHERE id = ${promptId}
    `;

    return NextResponse.json({ purchase, success: true }, { status: 201 });
  }

  if (body.action === 'convert_to_agent') {
    // Check ownership (purchased or creator)
    const purchaseRows = await sql`
      SELECT id FROM prompt_purchase
      WHERE prompt_id = ${promptId} AND buyer_id = ${currentUser.id}
      LIMIT 1
    `;

    if (purchaseRows.length === 0 && prompt.creator_id !== currentUser.id) {
      return NextResponse.json(
        { error: 'You must purchase this prompt first' },
        { status: 403 }
      );
    }

    // Create agent from prompt template
    const agentId = crypto.randomUUID();
    const tags = prompt.tags || [];
    const tools = prompt.tools || [];

    const [newAgent] = await sql`
      INSERT INTO agent (id, owner_id, name, description, capabilities, system_prompt, tools, price_per_query, chain_id, total_executions, total_revenue, rating, status, created_at, updated_at)
      VALUES (${agentId}, ${currentUser.id}, ${prompt.title}, ${prompt.description || ''}, ${JSON.stringify(tags)}::jsonb, ${prompt.system_prompt}, ${JSON.stringify(tools)}::jsonb, '10', 8453, 0, '0', 0, 'active', NOW(), NOW())
      RETURNING *
    `;

    return NextResponse.json({ agent: newAgent, success: true }, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
