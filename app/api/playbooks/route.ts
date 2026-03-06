import { NextRequest, NextResponse } from 'next/server';
import { createPlaybook, purchasePlaybook, getPlaybooks } from '@/lib/playbook-marketplace';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'purchase') {
      const { playbookId, buyerId } = body;
      if (!playbookId || !buyerId) {
        return NextResponse.json({ error: 'playbookId and buyerId are required' }, { status: 400 });
      }
      const purchase = await purchasePlaybook({ playbookId, buyerId });
      return NextResponse.json({ purchase }, { status: 201 });
    }

    // Default: create playbook
    const { creatorId, title, systemPrompt, toolConfig } = body;
    if (!creatorId || !title || !systemPrompt) {
      return NextResponse.json({ error: 'creatorId, title, and systemPrompt are required' }, { status: 400 });
    }

    const pb = await createPlaybook({
      creatorId,
      title,
      description: body.description,
      systemPrompt,
      toolConfig: toolConfig || [],
      agentId: body.agentId,
      matchId: body.matchId,
      matchType: body.matchType,
      winRate: body.winRate,
      price: body.price,
    });
    return NextResponse.json({ playbook: pb }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchType = searchParams.get('matchType') || undefined;
  const featured = searchParams.get('featured') === 'true';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

  try {
    const playbooks = await getPlaybooks({ matchType, featured, limit });
    return NextResponse.json({ playbooks }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error: any) {
    return NextResponse.json({ playbooks: [], error: error.message }, { status: 200 });
  }
}
