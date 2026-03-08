import { NextRequest, NextResponse } from 'next/server';
import { registerAgent, getRegistryStats, getDemoAgentCount } from '@/lib/agent-registry';
import { checkNftHoldings } from '@/lib/nft-checker';

/**
 * POST /api/agents/register - Register a new external agent
 *
 * Body: {
 *   name, description, ownerAddress, agentCardUrl, endpoint,
 *   tools, specialization, stakingAmount, isDemo?
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
      isDemo,
    } = body;

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

    // Demo mode: 1 free agent per wallet, no staking required
    if (isDemo) {
      const demoCount = await getDemoAgentCount(ownerAddress);
      if (demoCount >= 1) {
        return NextResponse.json(
          { error: 'You have already used your free demo registration. Stake BBAI to register more agents.' },
          { status: 400 },
        );
      }
    } else {
      // Check if NFT holder gets staking waiver
      const nftTier = body.nftTier;
      let stakingWaived = false;
      if (nftTier && ownerAddress) {
        const holdings = await checkNftHoldings(ownerAddress);
        stakingWaived = holdings.stakingDiscount === 100;
      }

      // Validate staking amount for non-demo (unless NFT waived)
      if (!stakingWaived && (typeof stakingAmount !== 'number' || stakingAmount < 100)) {
        return NextResponse.json(
          { error: 'Minimum staking amount is 100 BBAI' },
          { status: 400 },
        );
      }
    }

    const agent = await registerAgent({
      name,
      description,
      ownerAddress,
      agentCardUrl,
      endpoint,
      tools: Array.isArray(tools) ? tools : [],
      specialization: specialization || 'general',
      stakingAmount: isDemo ? 0 : stakingAmount,
      isDemo: !!isDemo,
    });

    const message = isDemo
      ? `Demo agent "${agent.name}" registered! You get 50 free calls/day. Stake BBAI to upgrade.`
      : `Agent "${agent.name}" registered successfully. Stake ${agent.stakingAmount} BBAI to proceed with verification.`;

    return NextResponse.json(
      { success: true, agent, message, isDemo: !!isDemo },
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
