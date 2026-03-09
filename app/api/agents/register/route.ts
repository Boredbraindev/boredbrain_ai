import { NextRequest } from 'next/server';
import { registerAgent, getRegistryStats, getDemoAgentCount } from '@/lib/agent-registry';
import { checkNftHoldings } from '@/lib/nft-checker';
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

    // Demo mode: base limit of 1 free agent per wallet, increased by NFT tier
    if (isDemo) {
      const demoCount = await getDemoAgentCount(ownerAddress);
      const maxDemoAgents = 1 + extraDemoAgents;
      if (demoCount >= maxDemoAgents) {
        const limitMsg = extraDemoAgents > 0
          ? `You have reached your ${nftTier}-tier demo limit of ${maxDemoAgents} agents. Stake USDT to register more.`
          : 'You have already used your free demo registration. Stake USDT to register more agents.';
        return apiError(limitMsg, 400);
      }
    } else {
      // Apply staking discount from NFT tier
      const stakingWaived = stakingDiscount === 100;
      const effectiveMinStake = stakingWaived ? 0 : Math.ceil(100 * (1 - stakingDiscount / 100));

      if (!stakingWaived && (typeof stakingAmount !== 'number' || stakingAmount < effectiveMinStake)) {
        return apiError(
          `Minimum staking amount is ${effectiveMinStake} USDT${stakingDiscount > 0 ? ` (${stakingDiscount}% ${nftTier}-tier discount applied)` : ''}`,
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

    const message = isDemo
      ? `Demo agent "${agent.name}" registered! You get 50 free calls/day. Stake USDT to upgrade.`
      : `Agent "${agent.name}" registered successfully. Stake ${agent.stakingAmount} USDT to proceed with verification.`;

    return apiSuccess(
      {
        agent,
        message,
        isDemo,
        nftTier,
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
