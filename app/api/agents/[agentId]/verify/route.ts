import { NextRequest, NextResponse } from 'next/server';
import { verifyAgent, getRegisteredAgent } from '@/lib/agent-registry';

/**
 * POST /api/agents/[agentId]/verify - Verify a registered agent
 *
 * Checks the agent's agent-card.json endpoint (mocked for now)
 * and promotes the agent to 'active' status.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  try {
    // Check the agent exists first
    const existing = await getRegisteredAgent(agentId);
    if (!existing) {
      return NextResponse.json(
        { error: `Registered agent not found: ${agentId}` },
        { status: 404 },
      );
    }

    const agent = await verifyAgent(agentId);

    return NextResponse.json({
      success: true,
      agent,
      message: `Agent "${agent.name}" has been verified and is now active.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 400 },
    );
  }
}
