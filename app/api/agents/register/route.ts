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

// ---------------------------------------------------------------------------
// Verification helpers (non-blocking — failures don't prevent registration)
// ---------------------------------------------------------------------------

/**
 * Ping an agent's endpoint URL with a 5-second timeout.
 * Returns true if the endpoint responds with a 2xx status.
 */
/** Block SSRF — reject private/internal IPs and non-HTTPS URLs */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Block private/internal ranges
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.')) return false;
    if (host.startsWith('169.254.')) return false; // link-local / cloud metadata
    if (host.endsWith('.internal') || host.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

async function pingEndpoint(endpointUrl: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!isSafeUrl(endpointUrl)) {
    return { ok: false, error: 'Endpoint must be a public HTTPS URL' };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(endpointUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual', // Don't follow redirects to internal URLs
    });
    clearTimeout(timeoutId);
    return { ok: response.ok, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes('aborted') || message.includes('abort');
    return { ok: false, error: isTimeout ? 'Endpoint ping timed out (5s)' : message };
  }
}

/**
 * Fetch an agent card URL and validate it contains required JSON fields (name, description).
 * Returns the parsed card on success or an error string on failure.
 */
async function validateAgentCard(
  cardUrl: string,
): Promise<{ valid: boolean; card?: Record<string, unknown>; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(cardUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { valid: false, error: `Agent card URL returned HTTP ${response.status}` };
    }

    let card: Record<string, unknown>;
    try {
      card = await response.json();
    } catch {
      return { valid: false, error: 'Agent card URL did not return valid JSON' };
    }

    if (typeof card !== 'object' || card === null || Array.isArray(card)) {
      return { valid: false, error: 'Agent card must be a JSON object' };
    }

    // Required fields: name and description
    if (!card.name || typeof card.name !== 'string') {
      return { valid: false, error: 'Agent card missing required field: name' };
    }
    if (!card.description || typeof card.description !== 'string') {
      return { valid: false, error: 'Agent card missing required field: description' };
    }

    return { valid: true, card };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes('aborted') || message.includes('abort');
    return { valid: false, error: isTimeout ? 'Agent card fetch timed out (5s)' : message };
  }
}

/**
 * Run post-registration verification checks (endpoint ping + agent card).
 * Non-blocking: if checks pass, updates agent status to 'verified' in DB.
 * If checks fail, agent stays 'pending' and verification details are stored in metadata.
 */
async function runPostRegistrationVerification(
  agentId: string,
  endpoint: string | undefined,
  agentCardUrl: string | undefined,
): Promise<{ verified: boolean; endpointOk: boolean | null; agentCardOk: boolean | null; details: Record<string, unknown> }> {
  const details: Record<string, unknown> = {};
  let endpointOk: boolean | null = null;
  let agentCardOk: boolean | null = null;

  // 1. Endpoint ping check
  if (endpoint && endpoint.length > 0) {
    const pingResult = await pingEndpoint(endpoint);
    endpointOk = pingResult.ok;
    details.endpointPing = {
      ok: pingResult.ok,
      status: pingResult.status ?? null,
      error: pingResult.error ?? null,
      checkedAt: new Date().toISOString(),
    };
  }

  // 2. Agent card check
  if (agentCardUrl && agentCardUrl.length > 0) {
    const cardResult = await validateAgentCard(agentCardUrl);
    agentCardOk = cardResult.valid;
    details.agentCardCheck = {
      valid: cardResult.valid,
      error: cardResult.error ?? null,
      checkedAt: new Date().toISOString(),
    };
  }

  // Determine if agent should be marked verified:
  //   - If endpoint provided, it must respond 2xx
  //   - If agentCardUrl provided, it must be valid JSON with name+description
  //   - If neither provided, stay pending (nothing to verify)
  const hasEndpoint = endpoint && endpoint.length > 0;
  const hasCard = agentCardUrl && agentCardUrl.length > 0;
  const verified =
    (hasEndpoint || hasCard) &&
    (endpointOk !== false) &&
    (agentCardOk !== false);

  // Update agent status + metadata in DB
  if (verified || Object.keys(details).length > 0) {
    try {
      const { neon: neonSql } = await import('@neondatabase/serverless');
      const sql = neonSql(process.env.DATABASE_URL!);

      if (verified) {
        await sql`
          UPDATE external_agent
          SET status = 'verified',
              verified_at = NOW(),
              metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ verification: details })}::jsonb
          WHERE id = ${agentId}
        `;
      } else {
        await sql`
          UPDATE external_agent
          SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ verification: details })}::jsonb
          WHERE id = ${agentId}
        `;
      }
    } catch (err) {
      console.warn('[register] Post-registration verification DB update failed:', err);
    }
  }

  return { verified, endpointOk, agentCardOk, details };
}

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

    // ── Post-registration verification (endpoint ping + agent card) ────
    // Non-blocking: if verification fails, agent stays 'pending'
    let verificationResult: Awaited<ReturnType<typeof runPostRegistrationVerification>> | null = null;
    try {
      verificationResult = await runPostRegistrationVerification(
        agent.id,
        endpoint,
        agentCardUrl,
      );
      if (verificationResult.verified) {
        agent.status = 'verified' as typeof agent.status;
        agent.verifiedAt = new Date().toISOString();
      }
    } catch (err) {
      console.warn('[register] Post-registration verification failed:', err);
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

    const verifiedLabel = verificationResult?.verified ? ' Status: verified.' : ' Status: pending (verification incomplete).';
    const message = isDemo
      ? `Demo agent "${agent.name}" registered! You get 50 free calls/day. Stake BBAI to upgrade.${rewardAwarded ? ' +1000 BBAI reward!' : ''}${verifiedLabel}`
      : `Agent "${agent.name}" registered successfully. ${stakingAmount} BBAI staked.${rewardAwarded ? ' +1000 BBAI reward!' : ''}${verifiedLabel}`;

    return apiSuccess(
      {
        agent,
        message,
        isDemo,
        nftTier,
        rewardAwarded,
        rewardAmount: rewardAwarded ? 1000 : 0,
        verification: verificationResult
          ? {
              verified: verificationResult.verified,
              endpointOk: verificationResult.endpointOk,
              agentCardOk: verificationResult.agentCardOk,
              details: verificationResult.details,
            }
          : null,
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
 * GET /api/agents/register - Get registration stats (total, active, pending, verified counts)
 * Uses DB-first pattern with 3-second timeout, falls back to Drizzle-based stats.
 */
export async function GET() {
  try {
    // DB-first: raw SQL with 3s timeout for fast stats
    try {
      const { neon: neonSql } = await import('@neondatabase/serverless');
      const sql = neonSql(process.env.DATABASE_URL!);

      const result = await Promise.race([
        sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'active')::int AS active,
            count(*) FILTER (WHERE status = 'pending')::int AS pending,
            count(*) FILTER (WHERE status = 'verified')::int AS verified,
            count(*) FILTER (WHERE status = 'suspended')::int AS suspended,
            COALESCE(sum(staking_amount), 0)::float AS total_staked,
            COALESCE(sum(total_earned), 0)::float AS total_earnings
          FROM external_agent
        `,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB query timed out (3s)')), 3_000),
        ),
      ]);

      const row = result[0];
      return apiSuccess({
        stats: {
          total: row.total,
          active: row.active,
          pending: row.pending,
          verified: row.verified,
          suspended: row.suspended,
          totalStaked: Number(Number(row.total_staked).toFixed(4)),
          totalEarnings: Number(Number(row.total_earnings).toFixed(4)),
        },
      });
    } catch (dbErr) {
      console.warn('[register/GET] DB-first stats failed, falling back to Drizzle:', dbErr);
    }

    // Fallback: Drizzle ORM query
    const stats = await getRegistryStats();
    return apiSuccess({ stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch registry stats';
    return apiError(message, 500);
  }
}
