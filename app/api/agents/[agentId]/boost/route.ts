export const runtime = 'edge';

/**
 * POST /api/agents/[agentId]/boost — Boost agent visibility in marketplace.
 *
 * Costs 200 BP for 24 hours of marketplace top placement.
 *
 * Body: { walletAddress: string }
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

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
    const sql = neon(process.env.DATABASE_URL!);

    // 1. Verify agent exists
    const agents = await sql`
      SELECT id, name, owner_address, boosted_until
      FROM external_agent
      WHERE id = ${agentId}
      LIMIT 1
    `;

    if (agents.length === 0) {
      return apiError('Agent not found', 404);
    }

    const agent = agents[0];

    // 2. Check if already boosted
    if (agent.boosted_until && new Date(agent.boosted_until).getTime() > Date.now()) {
      const remainingHours = Math.ceil((new Date(agent.boosted_until).getTime() - Date.now()) / (1000 * 60 * 60));
      return apiError(`Agent is already boosted for ${remainingHours} more hours`, 400);
    }

    // 3. Check user has enough BP
    const userRows = await sql`
      SELECT total_bp FROM user_points
      WHERE wallet_address = ${walletAddress}
      LIMIT 1
    `;

    const userBp = userRows.length > 0 ? Number(userRows[0].total_bp) : 0;
    if (userBp < BOOST_COST) {
      return apiError(`Insufficient BP. You have ${userBp} BP but need ${BOOST_COST} BP`, 400);
    }

    // 4. Deduct BP (inline awardPoints logic)
    const bp = -BOOST_COST;
    await sql`
      INSERT INTO point_transaction (wallet_address, amount, reason, reference_id)
      VALUES (${walletAddress}, ${bp}, 'agent_boost', ${agentId})
    `;

    const newTotal = userBp + bp;
    // Determine level from BP thresholds
    const level = newTotal >= 200000 ? 50 : newTotal >= 50000 ? 30 : newTotal >= 10000 ? 20 : newTotal >= 2000 ? 10 : newTotal >= 500 ? 5 : 1;

    await sql`
      UPDATE user_points
      SET total_bp = ${newTotal}, level = ${level}
      WHERE wallet_address = ${walletAddress}
    `;

    // 5. Set boostedUntil
    const boostedUntil = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000);
    await sql`
      UPDATE external_agent
      SET boosted_until = ${boostedUntil.toISOString()}
      WHERE id = ${agentId}
    `;

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
