import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agent } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/agents/[agentId] - Get agent details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  const [agentData] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1);

  if (!agentData) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({ agent: agentData });
}
