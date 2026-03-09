import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agent } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { MOCK_AGENTS } from '@/lib/mock-data';

/**
 * GET /api/agents/[agentId] - Get agent details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    const [agentData] = await db
      .select()
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1);

    if (agentData) {
      return NextResponse.json({ agent: agentData });
    }
  } catch {
    // DB error - fall through to mock
  }

  // Fallback to mock data
  const mockAgent = MOCK_AGENTS.find((a) => a.id === agentId);
  if (mockAgent) {
    return NextResponse.json({ agent: mockAgent });
  }

  return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
}
