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
    const rows = await sql`
      SELECT * FROM agent
      WHERE id = ${agentId}
      LIMIT 1
    `;

    if (rows.length > 0) {
      return NextResponse.json({ agent: rows[0] });
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
