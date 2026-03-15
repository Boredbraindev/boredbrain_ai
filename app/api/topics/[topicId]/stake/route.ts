export const runtime = 'edge';
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
import { neon } from '@neondatabase/serverless';

const MIN_STAKE = 10;
const MAX_STAKE = 100;

// ── Inline awardPoints (raw SQL version) ─────────────────────────────────────
const POINT_VALUES: Record<string, number> = {
  debate_stake: 0,
  arena_stake_win: 50,
};

function getLevelFromBp(bp: number): number {
  if (bp >= 200000) return 50;
  if (bp >= 50000) return 30;
  if (bp >= 10000) return 20;
  if (bp >= 2000) return 10;
  if (bp >= 500) return 5;
  return 1;
}

async function awardPointsEdge(
  sql: any,
  walletAddress: string,
  reason: string,
  referenceId?: string,
  customAmount?: number,
): Promise<void> {
  try {
    const bp = customAmount ?? POINT_VALUES[reason] ?? 0;
    if (bp === 0) return;

    // Insert transaction
    await sql`
      INSERT INTO point_transaction (wallet_address, amount, reason, reference_id)
      VALUES (${walletAddress}, ${bp}, ${reason}, ${referenceId ?? null})
    `;

    // Upsert user points
    const existing = await sql`
      SELECT * FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
    `;

    if (existing.length === 0) {
      const newTotal = bp;
      const level = getLevelFromBp(newTotal);
      await sql`
        INSERT INTO user_points (wallet_address, total_bp, level)
        VALUES (${walletAddress}, ${newTotal}, ${level})
      `;
    } else {
      const newTotal = existing[0].total_bp + bp;
      const level = getLevelFromBp(newTotal);
      await sql`
        UPDATE user_points
        SET total_bp = ${newTotal}, level = ${level}
        WHERE wallet_address = ${walletAddress}
      `;
    }
  } catch (err) {
    console.error('[points] awardPoints error:', err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const debateId = (await params).topicId;

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
    const sql = neon(process.env.DATABASE_URL!);

    // 1. Verify debate exists and is open
    const debates = await sql`
      SELECT * FROM topic_debate WHERE id = ${debateId} LIMIT 1
    `;

    if (debates.length === 0) {
      return apiError('Debate not found', 404);
    }
    if (debates[0].status !== 'open') {
      return apiError('Debate is no longer open for staking', 400);
    }

    // 2. Verify the agent has participated in this debate
    const opinions = await sql`
      SELECT id FROM debate_opinion
      WHERE debate_id = ${debateId} AND agent_id = ${agentId}
      LIMIT 1
    `;

    if (opinions.length === 0) {
      return apiError('Agent has not participated in this debate', 400);
    }

    // 3. Check user has enough BP
    const userRows = await sql`
      SELECT total_bp FROM user_points WHERE wallet_address = ${walletAddress} LIMIT 1
    `;

    const userBp = userRows.length > 0 ? userRows[0].total_bp : 0;
    if (userBp < amount) {
      return apiError(`Insufficient BP. You have ${userBp} BP but need ${amount} BP`, 400);
    }

    // 4. Check if user already staked on this debate (max 1 stake per debate)
    const existingStakes = await sql`
      SELECT id FROM debate_stake
      WHERE debate_id = ${debateId} AND wallet_address = ${walletAddress}
      LIMIT 1
    `;

    if (existingStakes.length > 0) {
      return apiError('You have already staked on this debate', 400);
    }

    // 5. Deduct BP from user (negative award)
    await awardPointsEdge(sql, walletAddress, 'debate_stake', debateId, -amount);

    // 6. Create stake record
    await sql`
      INSERT INTO debate_stake (debate_id, wallet_address, agent_id, amount)
      VALUES (${debateId}, ${walletAddress}, ${agentId}, ${amount})
    `;

    // 7. Add to debate pool
    await sql`
      UPDATE topic_debate
      SET total_pool = COALESCE(total_pool, 0) + ${amount}
      WHERE id = ${debateId}
    `;

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
  { params }: { params: Promise<{ topicId: string }> },
) {
  const debateId = (await params).topicId;

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const stakes = await sql`
      SELECT * FROM debate_stake WHERE debate_id = ${debateId}
    `;

    // Aggregate by agent
    const agentStakes: Record<string, { totalStaked: number; stakers: number }> = {};
    for (const s of stakes) {
      if (!agentStakes[s.agent_id]) {
        agentStakes[s.agent_id] = { totalStaked: 0, stakers: 0 };
      }
      agentStakes[s.agent_id].totalStaked += s.amount;
      agentStakes[s.agent_id].stakers += 1;
    }

    return apiSuccess({
      debateId,
      totalPool: stakes.reduce((sum: number, s: any) => sum + s.amount, 0),
      agentStakes,
      totalStakers: stakes.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(`Failed: ${msg}`, 500);
  }
}
