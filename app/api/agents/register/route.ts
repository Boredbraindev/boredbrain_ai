export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { registerAgent, getRegistryStats, getDemoAgentCount, getTotalAgentCount } from '@/lib/agent-registry';
import { checkNftHoldings } from '@/lib/nft-checker';
import { getUserPoints } from '@/lib/points';
import { getSlotsForLevel } from '@/lib/agent-tiers';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  isValidEthAddress,
  isValidUrl,
  type Schema,
} from '@/lib/api-utils';

const registerSchema: Schema = {
  name: { type: 'string', required: true, maxLength: 100 },
  description: { type: 'string', required: true, maxLength: 2000 },
  ownerAddress: { type: 'string', required: true, maxLength: 42 },
  agentCardUrl: { type: 'string', required: false, maxLength: 500 },
  endpoint: { type: 'string', required: false, maxLength: 500 },
  specialization: { type: 'string', required: false, maxLength: 100 },
  stakingAmount: { type: 'number', required: false, min: 0, max: 1_000_000 },
  isDemo: { type: 'boolean', required: false },
};

/**
 * POST /api/agents/register - Register a new external agent
 */
export async function POST(request: NextRequest) {
  try {
    // Safe JSON parse
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;
    const body = parsed.data as Record<string, unknown>;

    // Schema validation
    const { valid, errors, sanitized } = validateBody(body, registerSchema);
    if (!valid) {
      return apiError(errors.join('; '), 400);
    }

    const name = sanitized.name as string;
    const description = sanitized.description as string;
    const ownerAddress = sanitized.ownerAddress as string;
    const agentCardUrl = sanitized.agentCardUrl as string | undefined;
    const endpoint = sanitized.endpoint as string | undefined;
    const tools = Array.isArray(body.tools) ? (body.tools as string[]).slice(0, 50) : [];
    const specialization = sanitizeString(sanitized.specialization ?? 'general', 100);
    const stakingAmount = (sanitized.stakingAmount as number) ?? 0;
    const isDemo = !!sanitized.isDemo;

    // Ethereum address format check (strict: 0x + 40 hex chars)
    if (!isValidEthAddress(ownerAddress)) {
      return apiError('Valid Ethereum wallet address is required (0x + 40 hex characters)', 400);
    }

    // ── One agent per wallet check ──────────────────────────────────────
    try {
      const { neon: neonSql } = await import('@neondatabase/serverless');
      const sql = neonSql(process.env.DATABASE_URL!);
      const existing = await sql`
        SELECT id, name FROM external_agent
        WHERE owner_address = ${ownerAddress}
          AND owner_address != 'platform-fleet'
        LIMIT 1
      `;
      if (existing.length > 0) {
        return apiError(
          `This wallet already has a registered agent ("${existing[0].name}"). Each wallet can register one agent.`,
          400,
        );
      }
    } catch (err) {
      console.warn('[register] Wallet agent check failed, continuing:', err);
    }

    // ── Wallet signature verification ──────────────────────────────────
    const signature = body.signature as string | undefined;
    const signedMessage = body.message as string | undefined;
    const signTimestamp = body.timestamp as number | undefined;

    if (!signature || !signedMessage) {
      return apiError('Wallet signature is required. Please sign the registration message in your wallet.', 400);
    }

    // Check timestamp freshness (10 minutes max)
    if (signTimestamp && Date.now() - signTimestamp > 10 * 60 * 1000) {
      return apiError('Registration signature has expired. Please try again.', 400);
    }

    // Verify the message contains the correct wallet and agent name
    if (!signedMessage.includes(ownerAddress) || !signedMessage.includes(name)) {
      return apiError('Signature message does not match registration details.', 400);
    }

    // Verify signature on-chain using viem
    try {
      const { verifyMessage } = await import('viem');
      const valid = await verifyMessage({
        address: ownerAddress as `0x${string}`,
        message: signedMessage,
        signature: signature as `0x${string}`,
      });
      if (!valid) {
        return apiError('Invalid wallet signature. Please sign again.', 400);
      }
    } catch (sigErr) {
      console.warn('[register] Signature verification failed:', sigErr);
      return apiError('Failed to verify wallet signature. Please try again.', 400);
    }

    // URL validation for optional URL fields
    if (agentCardUrl && !isValidUrl(agentCardUrl)) {
      return apiError('agentCardUrl must be a valid http(s) URL', 400);
    }
    if (endpoint && !isValidUrl(endpoint)) {
      return apiError('endpoint must be a valid http(s) URL', 400);
    }

    // Sanitize tool names
    const sanitizedTools = tools
      .filter((t): t is string => typeof t === 'string')
      .map((t) => sanitizeString(t, 100))
      .filter((t) => t.length > 0);

    // Check NFT holdings for tier benefits (fail gracefully)
    let nftHoldings: Awaited<ReturnType<typeof checkNftHoldings>> | null = null;
    try {
      nftHoldings = await checkNftHoldings(ownerAddress);
    } catch (err) {
      console.warn('[register] NFT check failed, continuing with default tier:', err);
    }

    const nftTier = nftHoldings?.tier ?? 'none';
    const stakingDiscount = nftHoldings?.stakingDiscount ?? 0;
    const feeDiscount = nftHoldings?.feeDiscount ?? 0;
    const extraDemoAgents = nftHoldings?.extraDemoAgents ?? 0;

    // ── Slot limit check based on user's BP level ──────────────────────
    try {
      const userPointsData = await getUserPoints(ownerAddress);
      const slotInfo = getSlotsForLevel(userPointsData.level);
      const totalAgents = await getTotalAgentCount(ownerAddress);

      if (totalAgents >= slotInfo.maxAgents) {
        return apiError(
          `Agent slot limit reached for your level (${userPointsData.title}, max ${slotInfo.maxAgents} agents). ` +
          `Earn more BP to level up and unlock additional slots.`,
          400,
        );
      }
    } catch (err) {
      // Fail gracefully — don't block registration if points system is unavailable
      console.warn('[register] Slot check failed, continuing:', err);
    }

    // Demo mode: base limit of 1 free agent per wallet, increased by NFT tier
    if (isDemo) {
      const demoCount = await getDemoAgentCount(ownerAddress);
      const maxDemoAgents = 1 + extraDemoAgents;
      if (demoCount >= maxDemoAgents) {
        const limitMsg = extraDemoAgents > 0
          ? `You have reached your ${nftTier}-tier demo limit of ${maxDemoAgents} agents. Stake BBAI to register more.`
          : 'You have already used your free demo registration. Stake BBAI to register more agents.';
        return apiError(limitMsg, 400);
      }
    } else {
      // Apply staking discount from NFT tier
      const stakingWaived = stakingDiscount === 100;
      const effectiveMinStake = stakingWaived ? 0 : Math.ceil(100 * (1 - stakingDiscount / 100));

      if (!stakingWaived && (typeof stakingAmount !== 'number' || stakingAmount < effectiveMinStake)) {
        return apiError(
          `Minimum staking amount is ${effectiveMinStake} BBAI${stakingDiscount > 0 ? ` (${stakingDiscount}% ${nftTier}-tier discount applied)` : ''}`,
          400,
        );
      }
    }

    // Build NFT metadata to persist with the agent
    const nftMetadata: Record<string, unknown> = {};
    if (nftTier !== 'none' && nftHoldings) {
      nftMetadata.nftTier = nftTier;
      nftMetadata.nftCollections = nftHoldings.collections;
      nftMetadata.feeDiscount = feeDiscount;
      nftMetadata.stakingDiscount = stakingDiscount;
      nftMetadata.stakingWaived = stakingDiscount === 100;
      nftMetadata.nftCheckedAt = new Date().toISOString();
    }

    const agent = await registerAgent({
      name,
      description,
      ownerAddress,
      agentCardUrl: agentCardUrl || '',
      endpoint: endpoint || '',
      tools: sanitizedTools,
      specialization,
      stakingAmount: isDemo ? 0 : stakingAmount,
      isDemo,
      metadata: nftMetadata,
    });

    // ── Verify agent was actually created in DB before awarding rewards ──
    let agentVerified = false;
    try {
      const { neon: neonSql } = await import('@neondatabase/serverless');
      const sql = neonSql(process.env.DATABASE_URL!);
      const verification = await sql`
        SELECT id FROM external_agent WHERE id = ${agent.id} LIMIT 1
      `;
      agentVerified = verification.length > 0;
    } catch (err) {
      console.warn('[register] Agent verification query failed:', err);
    }

    if (!agentVerified) {
      console.error('[register] Agent not found in DB after registerAgent() — skipping rewards');
      return apiSuccess({ agent, message: `Agent "${agent.name}" registered but reward could not be verified.`, isDemo, nftTier, rewardAwarded: false, rewardAmount: 0 }, 201);
    }

    // ── Record staking deduction for non-demo registrations ────────────
    if (!isDemo && stakingAmount > 0) {
      try {
        const { awardPoints } = await import('@/lib/points');
        // Record as a negative point transaction (staking deduction)
        await awardPoints(
          ownerAddress,
          'agent_stake',
          agent.id,
          -stakingAmount,
        );
      } catch (err) {
        // Log but don't fail the registration — staking record is secondary
        console.warn('[register] Failed to record staking deduction:', err);
      }
    }

    // ── Award 1000 BBAI registration reward (only after DB verification) ─
    let rewardAwarded = false;
    try {
      const { neon: neonSql } = await import('@neondatabase/serverless');
      const sql = neonSql(process.env.DATABASE_URL!);

      // Insert point transaction for registration reward
      await sql`
        INSERT INTO point_transaction (wallet_address, amount, reason, reference_id, season)
        VALUES (${ownerAddress}, 1000, 'agent_registration_reward', ${agent.id}, 1)
      `;

      // Upsert user_points: create if not exists, add 1000 BP
      await sql`
        INSERT INTO user_points (wallet_address, total_bp, level, streak_days, season)
        VALUES (${ownerAddress}, 1000, 1, 0, 1)
        ON CONFLICT (wallet_address)
        DO UPDATE SET total_bp = user_points.total_bp + 1000
      `;

      rewardAwarded = true;
    } catch (err) {
      console.warn('[register] Failed to award registration reward:', err);
    }

    const message = isDemo
      ? `Demo agent "${agent.name}" registered! You get 50 free calls/day. Stake BBAI to upgrade.${rewardAwarded ? ' +1000 BBAI reward!' : ''}`
      : `Agent "${agent.name}" registered successfully. ${stakingAmount} BBAI staked.${rewardAwarded ? ' +1000 BBAI reward!' : ''}`;

    return apiSuccess(
      {
        agent,
        message,
        isDemo,
        nftTier,
        rewardAwarded,
        rewardAmount: rewardAwarded ? 1000 : 0,
        ...(nftTier !== 'none' && nftHoldings ? {
          nftBenefits: {
            tier: nftTier,
            collections: nftHoldings.collections,
            benefits: nftHoldings.benefits,
            feeDiscount,
            stakingDiscount,
          },
        } : {}),
      },
      201,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to register agent';
    return apiError(message, 400);
  }
}

/**
 * GET /api/agents/register - Get registry stats
 */
export async function GET() {
  try {
    const stats = await getRegistryStats();
    return apiSuccess({ stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch registry stats';
    return apiError(message, 500);
  }
}
