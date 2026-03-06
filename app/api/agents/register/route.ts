import { NextRequest, NextResponse } from 'next/server';
import { registerAgent, getRegistryStats } from '@/lib/agent-registry';

/**
 * POST /api/agents/register - Register a new external agent
 *
 * Body: {
 *   name, description, ownerAddress, agentCardUrl, endpoint,
 *   tools, specialization, stakingAmount
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      ownerAddress,
      agentCardUrl,
      endpoint,
      tools,
      specialization,
      stakingAmount,
    } = body;

    // Validate staking amount
    if (typeof stakingAmount !== 'number' || stakingAmount < 100) {
      return NextResponse.json(
        { error: 'Minimum staking amount is 100 BBAI' },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 },
      );
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 },
      );
    }

    if (!ownerAddress || typeof ownerAddress !== 'string' || !ownerAddress.startsWith('0x')) {
      return NextResponse.json(
        { error: 'Valid Ethereum wallet address is required (starting with 0x)' },
        { status: 400 },
      );
    }

    const agent = await registerAgent({
      name,
      description,
      ownerAddress,
      agentCardUrl,
      endpoint,
      tools: Array.isArray(tools) ? tools : [],
      specialization: specialization || 'general',
      stakingAmount,
    });

    return NextResponse.json(
      {
        success: true,
        agent,
        message: `Agent "${agent.name}" registered successfully. Stake ${agent.stakingAmount} BBAI to proceed with verification.`,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to register agent' },
      { status: 400 },
    );
  }
}

/**
 * GET /api/agents/register - Get registry stats
 */
export async function GET() {
  const stats = await getRegistryStats();
  return NextResponse.json({ stats });
}
