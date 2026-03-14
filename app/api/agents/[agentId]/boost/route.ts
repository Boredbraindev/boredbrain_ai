export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * POST /api/agents/[agentId]/boost — Boost agent visibility in marketplace.
 *
 * Costs 200 BP for 24 hours of marketplace top placement.
 *
 * Body: { walletAddress: string }
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { externalAgent, userPoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { awardPoints } from '@/lib/points';

const BOOST_COST = 200; // BP
const BOOST_DURATION_HOURS = 24;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  let body: { walletAddress?: string };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const { walletAddress } = body;
  if (!walletAddress || typeof walletAddress !== 'string') {
    return apiError('walletAddress is required', 400);
  }

  try {
    // 1. Verify agent exists
    const [agent] = await db
      .select({ id: externalAgent.id, name: externalAgent.name, ownerAddress: externalAgent.ownerAddress, boostedUntil: externalAgent.boostedUntil })
      .from(externalAgent)
      .where(eq(externalAgent.id, agentId))
      .limit(1);

    if (!agent) {
      return apiError('Agent not found', 404);
    }

    // 2. Check if already boosted
    if (agent.boostedUntil && agent.boostedUntil.getTime() > Date.now()) {
      const remainingHours = Math.ceil((agent.boostedUntil.getTime() - Date.now()) / (1000 * 60 * 60));
      return apiError(`Agent is already boosted for ${remainingHours} more hours`, 400);
    }

    // 3. Check user has enough BP
    const [userRow] = await db
      .select({ totalBp: userPoints.totalBp })
      .from(userPoints)
      .where(eq(userPoints.walletAddress, walletAddress))
      .limit(1);

    const userBp = userRow?.totalBp ?? 0;
    if (userBp < BOOST_COST) {
      return apiError(`Insufficient BP. You have ${userBp} BP but need ${BOOST_COST} BP`, 400);
    }

    // 4. Deduct BP
    await awardPoints(walletAddress, 'agent_boost', agentId, -BOOST_COST);

    // 5. Set boostedUntil
    const boostedUntil = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000);
    await db
      .update(externalAgent)
      .set({ boostedUntil })
      .where(eq(externalAgent.id, agentId));

    return apiSuccess({
      boosted: true,
      agentId,
      agentName: agent.name,
      cost: BOOST_COST,
      boostedUntil: boostedUntil.toISOString(),
      durationHours: BOOST_DURATION_HOURS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(`Boost failed: ${msg}`, 500);
  }
}
