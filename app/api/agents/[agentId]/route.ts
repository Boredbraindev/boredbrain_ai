export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
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
    const sql = neon(process.env.DATABASE_URL!);

    // Try agent table first
    const rows = await sql`
      SELECT * FROM agent
      WHERE id = ${agentId}
      LIMIT 1
    `;
    if (rows.length > 0) {
      const badges = await sql`SELECT badge_type, debate_topic, earned_at FROM agent_badge WHERE agent_id = ${agentId} ORDER BY earned_at DESC LIMIT 20`.catch(() => []);
      return NextResponse.json({ agent: rows[0], badges });
    }

    // Try external_agent table (fleet agents)
    const extRows = await sql`
      SELECT * FROM external_agent
      WHERE id = ${agentId}
      LIMIT 1
    `;
    if (extRows.length > 0) {
      const badges = await sql`SELECT badge_type, debate_topic, earned_at FROM agent_badge WHERE agent_id = ${agentId} ORDER BY earned_at DESC LIMIT 20`.catch(() => []);
      return NextResponse.json({ agent: extRows[0], badges });
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
