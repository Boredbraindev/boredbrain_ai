export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * POST /api/topics/[debateId]/stake — Stake BP on a debate agent.
 *
 * Users bet BP (10–100) on an agent winning a debate.
 * If the agent finishes #1, stakers split the pool proportionally.
 *
 * Body: { walletAddress: string, agentId: string, amount: number }
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { topicDebate, debateOpinion, debateStake, userPoints } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { awardPoints } from '@/lib/points';

const MIN_STAKE = 10;
const MAX_STAKE = 100;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;

  let body: { walletAddress?: string; agentId?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const { walletAddress, agentId, amount } = body;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return apiError('walletAddress is required', 400);
  }
  if (!agentId || typeof agentId !== 'string') {
    return apiError('agentId is required', 400);
  }
  if (!amount || typeof amount !== 'number' || amount < MIN_STAKE || amount > MAX_STAKE) {
    return apiError(`amount must be between ${MIN_STAKE} and ${MAX_STAKE} BP`, 400);
  }

  try {
    // 1. Verify debate exists and is open
    const [debate] = await db
      .select()
      .from(topicDebate)
      .where(eq(topicDebate.id, debateId))
      .limit(1);

    if (!debate) {
      return apiError('Debate not found', 404);
    }
    if (debate.status !== 'open') {
      return apiError('Debate is no longer open for staking', 400);
    }

    // 2. Verify the agent has participated in this debate
    const [opinion] = await db
      .select({ id: debateOpinion.id })
      .from(debateOpinion)
      .where(
        and(
          eq(debateOpinion.debateId, debateId),
          eq(debateOpinion.agentId, agentId),
        ),
      )
      .limit(1);

    if (!opinion) {
      return apiError('Agent has not participated in this debate', 400);
    }

    // 3. Check user has enough BP
    const [userRow] = await db
      .select({ totalBp: userPoints.totalBp })
      .from(userPoints)
      .where(eq(userPoints.walletAddress, walletAddress))
      .limit(1);

    const userBp = userRow?.totalBp ?? 0;
    if (userBp < amount) {
      return apiError(`Insufficient BP. You have ${userBp} BP but need ${amount} BP`, 400);
    }

    // 4. Check if user already staked on this debate (max 1 stake per debate)
    const [existing] = await db
      .select({ id: debateStake.id })
      .from(debateStake)
      .where(
        and(
          eq(debateStake.debateId, debateId),
          eq(debateStake.walletAddress, walletAddress),
        ),
      )
      .limit(1);

    if (existing) {
      return apiError('You have already staked on this debate', 400);
    }

    // 5. Deduct BP from user (negative award)
    await awardPoints(walletAddress, 'debate_stake', debateId, -amount);

    // 6. Create stake record
    await db.insert(debateStake).values({
      debateId,
      walletAddress,
      agentId,
      amount,
    });

    // 7. Add to debate pool
    await db
      .update(topicDebate)
      .set({
        totalPool: sql`COALESCE(${topicDebate.totalPool}, 0) + ${amount}`,
      })
      .where(eq(topicDebate.id, debateId));

    return apiSuccess({
      staked: true,
      debateId,
      agentId,
      amount,
      message: `Staked ${amount} BP on this agent`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(`Staking failed: ${msg}`, 500);
  }
}

/**
 * GET /api/topics/[debateId]/stake — Get stakes for a debate.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;

  try {
    const stakes = await db
      .select()
      .from(debateStake)
      .where(eq(debateStake.debateId, debateId));

    // Aggregate by agent
    const agentStakes: Record<string, { totalStaked: number; stakers: number }> = {};
    for (const s of stakes) {
      if (!agentStakes[s.agentId]) {
        agentStakes[s.agentId] = { totalStaked: 0, stakers: 0 };
      }
      agentStakes[s.agentId].totalStaked += s.amount;
      agentStakes[s.agentId].stakers += 1;
    }

    return apiSuccess({
      debateId,
      totalPool: stakes.reduce((sum, s) => sum + s.amount, 0),
      agentStakes,
      totalStakers: stakes.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(`Failed: ${msg}`, 500);
  }
}
