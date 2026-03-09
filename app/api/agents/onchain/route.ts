import { NextRequest } from 'next/server';
import {
  registerAgentOnChain,
  getOnChainAgent,
  getOnChainAgentsByOwner,
  updateAgentOnChain,
  deregisterAgent,
  getRegistryStats,
  getContractInfo,
} from '@/lib/erc8004/registry-client';
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
// Schemas
// ---------------------------------------------------------------------------

const registerSchema: Schema = {
  name: { type: 'string', required: true, maxLength: 128 },
  description: { type: 'string', required: true, maxLength: 2000 },
  endpointUrl: { type: 'string', required: true, maxLength: 500 },
  agentCardUrl: { type: 'string', required: false, maxLength: 500 },
  ownerAddress: { type: 'string', required: true, maxLength: 42 },
};

const updateSchema: Schema = {
  agentId: { type: 'number', required: true, min: 1 },
  name: { type: 'string', required: false, maxLength: 128 },
  description: { type: 'string', required: false, maxLength: 2000 },
  endpointUrl: { type: 'string', required: false, maxLength: 500 },
  agentCardUrl: { type: 'string', required: false, maxLength: 500 },
};

// ---------------------------------------------------------------------------
// POST /api/agents/onchain - Register agent on-chain (builds unsigned tx)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;
    const body = parsed.data as Record<string, unknown>;

    const { valid, errors, sanitized } = validateBody(body, registerSchema);
    if (!valid) {
      return apiError(errors.join('; '), 400);
    }

    const name = sanitized.name as string;
    const description = sanitized.description as string;
    const endpointUrl = sanitized.endpointUrl as string;
    const agentCardUrl = sanitizeString(sanitized.agentCardUrl ?? '', 500);
    const ownerAddress = sanitized.ownerAddress as string;

    // Validate Ethereum address
    if (!isValidEthAddress(ownerAddress)) {
      return apiError('Valid Ethereum wallet address is required (0x + 40 hex characters)', 400);
    }

    // Validate endpoint URL
    if (!isValidUrl(endpointUrl)) {
      return apiError('endpointUrl must be a valid http(s) URL', 400);
    }

    // Validate agent card URL if provided
    if (agentCardUrl && !isValidUrl(agentCardUrl)) {
      return apiError('agentCardUrl must be a valid http(s) URL', 400);
    }

    // Parse tools from body (not in schema since it's an array)
    const tools = Array.isArray(body.tools)
      ? (body.tools as string[])
          .filter((t): t is string => typeof t === 'string')
          .map((t) => sanitizeString(t, 100))
          .filter((t) => t.length > 0)
          .slice(0, 50)
      : [];

    const result = await registerAgentOnChain({
      name,
      description,
      endpointUrl,
      agentCardUrl,
      tools,
      ownerAddress,
    });

    const contractInfo = getContractInfo();

    return apiSuccess(
      {
        ...result,
        contractInfo: {
          registryAddress: contractInfo.registryAddress,
          bbaiTokenAddress: contractInfo.bbaiTokenAddress,
          chain: contractInfo.chain.name,
          chainId: contractInfo.chain.chainId,
          blockExplorer: contractInfo.chain.blockExplorer,
          simulationMode: contractInfo.simulationMode,
        },
        message: result.simulated
          ? `Agent "${name}" registered in simulation mode. Deploy the ERC-8004 registry contract to register on-chain.`
          : `Unsigned transactions generated for on-chain registration of "${name}". Sign the approve tx first, then the register tx.`,
        instructions: result.simulated
          ? undefined
          : [
              'Step 1: Sign the approveTx to allow the registry to stake 100 USDT on your behalf.',
              'Step 2: Wait for the approval transaction to confirm.',
              'Step 3: Sign the tx to register your agent on BNB Chain.',
              'Your 100 USDT stake will be locked for 30 days.',
            ],
      },
      201,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to prepare on-chain registration';
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/agents/onchain - Query on-chain agents
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get('agentId');
    const ownerParam = searchParams.get('owner');
    const statsParam = searchParams.get('stats');

    // Return registry stats
    if (statsParam === 'true') {
      const stats = await getRegistryStats();
      const contractInfo = getContractInfo();
      return apiSuccess({
        stats,
        contractInfo: {
          registryAddress: contractInfo.registryAddress,
          chain: contractInfo.chain.name,
          chainId: contractInfo.chain.chainId,
          simulationMode: contractInfo.simulationMode,
        },
      });
    }

    // Query by agent ID
    if (agentIdParam) {
      const agentId = parseInt(agentIdParam, 10);
      if (isNaN(agentId) || agentId < 1) {
        return apiError('agentId must be a positive integer', 400);
      }

      const agent = await getOnChainAgent(agentId);
      if (!agent) {
        return apiError(`Agent #${agentId} not found on-chain`, 404);
      }

      return apiSuccess({ agent });
    }

    // Query by owner address
    if (ownerParam) {
      if (!isValidEthAddress(ownerParam)) {
        return apiError('owner must be a valid Ethereum address (0x + 40 hex characters)', 400);
      }

      const agents = await getOnChainAgentsByOwner(ownerParam);
      return apiSuccess({
        owner: ownerParam,
        agents,
        count: agents.length,
      });
    }

    // No filter - return stats + contract info
    const stats = await getRegistryStats();
    const contractInfo = getContractInfo();
    return apiSuccess({
      stats,
      contractInfo: {
        registryAddress: contractInfo.registryAddress,
        bbaiTokenAddress: contractInfo.bbaiTokenAddress,
        chain: contractInfo.chain.name,
        chainId: contractInfo.chain.chainId,
        blockExplorer: contractInfo.chain.blockExplorer,
        simulationMode: contractInfo.simulationMode,
      },
      usage: {
        queryByAgent: 'GET /api/agents/onchain?agentId=1',
        queryByOwner: 'GET /api/agents/onchain?owner=0x...',
        queryStats: 'GET /api/agents/onchain?stats=true',
        register: 'POST /api/agents/onchain',
        update: 'PUT /api/agents/onchain',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query on-chain agents';
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/agents/onchain - Update agent metadata on-chain
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;
    const body = parsed.data as Record<string, unknown>;

    const { valid, errors, sanitized } = validateBody(body, updateSchema);
    if (!valid) {
      return apiError(errors.join('; '), 400);
    }

    const agentId = sanitized.agentId as number;
    const name = sanitized.name as string | undefined;
    const description = sanitized.description as string | undefined;
    const endpointUrl = sanitized.endpointUrl as string | undefined;
    const agentCardUrl = sanitized.agentCardUrl as string | undefined;

    // Validate URLs if provided
    if (endpointUrl && !isValidUrl(endpointUrl)) {
      return apiError('endpointUrl must be a valid http(s) URL', 400);
    }
    if (agentCardUrl && !isValidUrl(agentCardUrl)) {
      return apiError('agentCardUrl must be a valid http(s) URL', 400);
    }

    // Parse tools from body
    const tools = Array.isArray(body.tools)
      ? (body.tools as string[])
          .filter((t): t is string => typeof t === 'string')
          .map((t) => sanitizeString(t, 100))
          .filter((t) => t.length > 0)
          .slice(0, 50)
      : undefined;

    const result = await updateAgentOnChain(agentId, {
      name,
      description,
      endpointUrl,
      agentCardUrl,
      tools,
    });

    return apiSuccess({
      ...result,
      message: result.simulated
        ? `Agent #${agentId} updated in simulation mode.`
        : `Unsigned transaction generated to update agent #${agentId}. Sign with the agent owner wallet.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to prepare on-chain update';
    return apiError(message, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/agents/onchain - Deregister agent (bonus endpoint)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get('agentId');

    if (!agentIdParam) {
      return apiError('agentId query parameter is required', 400);
    }

    const agentId = parseInt(agentIdParam, 10);
    if (isNaN(agentId) || agentId < 1) {
      return apiError('agentId must be a positive integer', 400);
    }

    const result = await deregisterAgent(agentId);

    return apiSuccess({
      ...result,
      message: result.simulated
        ? `Agent #${agentId} deregistered in simulation mode.`
        : `Unsigned transaction generated to deregister agent #${agentId}. Sign with the agent owner wallet to return staked USDT.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to prepare deregistration';
    return apiError(message, 500);
  }
}
