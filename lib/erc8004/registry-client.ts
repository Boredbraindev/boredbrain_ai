/**
 * ERC-8004 On-Chain Agent Registry Client
 *
 * Client-side utilities for interacting with the AgentRegistry8004 contract
 * on BNB Chain (BSC mainnet and testnet).
 *
 * If no contract address is configured, all operations run in simulation mode
 * and return mock data, allowing development without a deployed contract.
 */

import { encodeFunctionData, decodeFunctionResult, type Hex, type Address } from 'viem';

// ---------------------------------------------------------------------------
// Chain Configuration
// ---------------------------------------------------------------------------

export const BSC_MAINNET = {
  chainId: 56,
  name: 'BNB Smart Chain',
  rpcUrl: 'https://bsc-dataseed1.binance.org',
  blockExplorer: 'https://bscscan.com',
} as const;

export const BSC_TESTNET = {
  chainId: 97,
  name: 'BNB Smart Chain Testnet',
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  blockExplorer: 'https://testnet.bscscan.com',
} as const;

export type SupportedChain = typeof BSC_MAINNET | typeof BSC_TESTNET;

// ---------------------------------------------------------------------------
// Contract ABI (minimal ABI for the functions we call)
// ---------------------------------------------------------------------------

const AGENT_REGISTRY_8004_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'endpointUrl', type: 'string' },
      { name: 'agentCardUrl', type: 'string' },
      { name: 'tools', type: 'string' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'updateAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'endpointUrl', type: 'string' },
      { name: 'agentCardUrl', type: 'string' },
      { name: 'tools', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'deregisterAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        name: 'metadata',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'endpointUrl', type: 'string' },
          { name: 'agentCardUrl', type: 'string' },
          { name: 'tools', type: 'string' },
          { name: 'owner', type: 'address' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getAgentsByOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'agentIds', type: 'uint256[]' }],
  },
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'registered', type: 'bool' }],
  },
  {
    name: 'totalAgents',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
  },
  {
    name: 'activeAgentCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'stakeRequirement',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isStakeLocked',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'locked', type: 'bool' }],
  },
  {
    name: 'ownerOfAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ERC-20 approve ABI for USDT token approval
const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnChainAgent {
  agentId: number;
  name: string;
  description: string;
  endpointUrl: string;
  agentCardUrl: string;
  tools: string[];
  owner: string;
  registeredAt: number;
  updatedAt: number;
  active: boolean;
}

export interface RegisterAgentOnChainInput {
  name: string;
  description: string;
  endpointUrl: string;
  agentCardUrl: string;
  tools: string[];
  ownerAddress: string;
}

export interface UpdateAgentOnChainInput {
  name?: string;
  description?: string;
  endpointUrl?: string;
  agentCardUrl?: string;
  tools?: string[];
}

export interface UnsignedTxData {
  to: string;
  data: string;
  chainId: number;
  value: string;
  /** Human-readable description of what this tx does */
  description: string;
}

export interface RegistryClientConfig {
  registryAddress?: string;
  bbaiTokenAddress?: string;
  chain?: SupportedChain;
}

// ---------------------------------------------------------------------------
// Environment / Config
// ---------------------------------------------------------------------------

function getConfig(): RegistryClientConfig {
  return {
    registryAddress: process.env.NEXT_PUBLIC_ERC8004_REGISTRY_ADDRESS || '',
    bbaiTokenAddress: process.env.NEXT_PUBLIC_BBAI_TOKEN_ADDRESS || '',
    chain:
      process.env.NEXT_PUBLIC_BSC_CHAIN === 'mainnet' ? BSC_MAINNET : BSC_TESTNET,
  };
}

function isSimulationMode(): boolean {
  const config = getConfig();
  return !config.registryAddress || config.registryAddress.length < 42;
}

// ---------------------------------------------------------------------------
// Simulation Store (in-memory mock for dev without deployed contract)
// ---------------------------------------------------------------------------

let _simNextId = 1;
const _simAgents = new Map<number, OnChainAgent>();

function simulateRegister(input: RegisterAgentOnChainInput): OnChainAgent {
  const agentId = _simNextId++;
  const now = Math.floor(Date.now() / 1000);
  const agent: OnChainAgent = {
    agentId,
    name: input.name,
    description: input.description,
    endpointUrl: input.endpointUrl,
    agentCardUrl: input.agentCardUrl,
    tools: input.tools,
    owner: input.ownerAddress,
    registeredAt: now,
    updatedAt: now,
    active: true,
  };
  _simAgents.set(agentId, agent);
  return agent;
}

function simulateGetAgent(agentId: number): OnChainAgent | null {
  return _simAgents.get(agentId) ?? null;
}

function simulateGetAgentsByOwner(owner: string): OnChainAgent[] {
  const result: OnChainAgent[] = [];
  for (const agent of _simAgents.values()) {
    if (agent.owner.toLowerCase() === owner.toLowerCase() && agent.active) {
      result.push(agent);
    }
  }
  return result;
}

function simulateUpdate(agentId: number, updates: UpdateAgentOnChainInput): OnChainAgent | null {
  const agent = _simAgents.get(agentId);
  if (!agent || !agent.active) return null;

  if (updates.name) agent.name = updates.name;
  if (updates.description) agent.description = updates.description;
  if (updates.endpointUrl) agent.endpointUrl = updates.endpointUrl;
  if (updates.agentCardUrl) agent.agentCardUrl = updates.agentCardUrl;
  if (updates.tools) agent.tools = updates.tools;
  agent.updatedAt = Math.floor(Date.now() / 1000);

  return agent;
}

function simulateDeregister(agentId: number): boolean {
  const agent = _simAgents.get(agentId);
  if (!agent || !agent.active) return false;
  agent.active = false;
  agent.updatedAt = Math.floor(Date.now() / 1000);
  return true;
}

// ---------------------------------------------------------------------------
// RPC Helpers
// ---------------------------------------------------------------------------

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const config = getConfig();
  const rpcUrl = config.chain?.rpcUrl ?? BSC_TESTNET.rpcUrl;

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  const json = await response.json();
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message ?? JSON.stringify(json.error)}`);
  }
  return json.result;
}

async function ethCall(to: string, data: string): Promise<string> {
  const result = await rpcCall('eth_call', [{ to, data }, 'latest']);
  return result as string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register an agent on-chain. Returns an unsigned transaction for wallet signing.
 * In simulation mode, registers immediately and returns a mock tx.
 */
export async function registerAgentOnChain(
  input: RegisterAgentOnChainInput,
): Promise<{ tx: UnsignedTxData; approveTx?: UnsignedTxData; agent?: OnChainAgent; simulated: boolean }> {
  if (isSimulationMode()) {
    const agent = simulateRegister(input);
    return {
      tx: {
        to: '0x0000000000000000000000000000000000000000',
        data: '0x',
        chainId: BSC_TESTNET.chainId,
        value: '0',
        description: `[SIMULATED] Register agent "${input.name}" on-chain`,
      },
      agent,
      simulated: true,
    };
  }

  const config = getConfig();
  const registryAddress = config.registryAddress!;
  const bbaiTokenAddress = config.bbaiTokenAddress!;
  const chain = config.chain ?? BSC_TESTNET;

  // Tools encoded as comma-separated string for Solidity
  const toolsStr = input.tools.join(',');

  // Build approve tx (user must approve USDT spend first)
  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [registryAddress as Address, BigInt('100000000000000000000')], // 100 USDT (18 decimals)
  });

  const approveTx: UnsignedTxData = {
    to: bbaiTokenAddress,
    data: approveData,
    chainId: chain.chainId,
    value: '0',
    description: 'Approve 100 USDT for agent registration staking',
  };

  // Build register tx
  const registerData = encodeFunctionData({
    abi: AGENT_REGISTRY_8004_ABI,
    functionName: 'registerAgent',
    args: [input.name, input.description, input.endpointUrl, input.agentCardUrl, toolsStr],
  });

  const tx: UnsignedTxData = {
    to: registryAddress,
    data: registerData,
    chainId: chain.chainId,
    value: '0',
    description: `Register agent "${input.name}" on BNB Chain (ERC-8004)`,
  };

  return { tx, approveTx, simulated: false };
}

/**
 * Read agent data from the on-chain registry.
 * In simulation mode, returns from in-memory store.
 */
export async function getOnChainAgent(agentId: number): Promise<OnChainAgent | null> {
  if (isSimulationMode()) {
    return simulateGetAgent(agentId);
  }

  const config = getConfig();
  const registryAddress = config.registryAddress!;

  try {
    // Check if registered first
    const isRegData = encodeFunctionData({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'isRegistered',
      args: [BigInt(agentId)],
    });
    const isRegResult = await ethCall(registryAddress, isRegData);
    const isRegistered = decodeFunctionResult({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'isRegistered',
      data: isRegResult as Hex,
    });

    // Fetch full agent data
    const getAgentData = encodeFunctionData({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'getAgent',
      args: [BigInt(agentId)],
    });
    const agentResult = await ethCall(registryAddress, getAgentData);
    const decoded = decodeFunctionResult({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'getAgent',
      data: agentResult as Hex,
    });

    const metadata = decoded as unknown as {
      name: string;
      description: string;
      endpointUrl: string;
      agentCardUrl: string;
      tools: string;
      owner: string;
      registeredAt: bigint;
      updatedAt: bigint;
      active: boolean;
    };

    return {
      agentId,
      name: metadata.name,
      description: metadata.description,
      endpointUrl: metadata.endpointUrl,
      agentCardUrl: metadata.agentCardUrl,
      tools: metadata.tools ? metadata.tools.split(',').filter(Boolean) : [],
      owner: metadata.owner,
      registeredAt: Number(metadata.registeredAt),
      updatedAt: Number(metadata.updatedAt),
      active: metadata.active,
    };
  } catch (error) {
    console.error(`[erc8004] Failed to fetch agent ${agentId}:`, error);
    return null;
  }
}

/**
 * Get all on-chain agents owned by an address.
 * In simulation mode, returns from in-memory store.
 */
export async function getOnChainAgentsByOwner(ownerAddress: string): Promise<OnChainAgent[]> {
  if (isSimulationMode()) {
    return simulateGetAgentsByOwner(ownerAddress);
  }

  const config = getConfig();
  const registryAddress = config.registryAddress!;

  try {
    const data = encodeFunctionData({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'getAgentsByOwner',
      args: [ownerAddress as Address],
    });
    const result = await ethCall(registryAddress, data);
    const agentIds = decodeFunctionResult({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'getAgentsByOwner',
      data: result as Hex,
    }) as bigint[];

    // Fetch each agent's metadata
    const agents: OnChainAgent[] = [];
    for (const id of agentIds) {
      const agent = await getOnChainAgent(Number(id));
      if (agent) agents.push(agent);
    }
    return agents;
  } catch (error) {
    console.error(`[erc8004] Failed to fetch agents for ${ownerAddress}:`, error);
    return [];
  }
}

/**
 * Build an unsigned transaction to update agent metadata on-chain.
 * In simulation mode, updates immediately and returns a mock tx.
 */
export async function updateAgentOnChain(
  agentId: number,
  updates: UpdateAgentOnChainInput,
): Promise<{ tx: UnsignedTxData; agent?: OnChainAgent; simulated: boolean }> {
  if (isSimulationMode()) {
    const agent = simulateUpdate(agentId, updates);
    return {
      tx: {
        to: '0x0000000000000000000000000000000000000000',
        data: '0x',
        chainId: BSC_TESTNET.chainId,
        value: '0',
        description: `[SIMULATED] Update agent #${agentId} on-chain`,
      },
      agent: agent ?? undefined,
      simulated: true,
    };
  }

  const config = getConfig();
  const registryAddress = config.registryAddress!;
  const chain = config.chain ?? BSC_TESTNET;

  const toolsStr = updates.tools ? updates.tools.join(',') : '';

  const data = encodeFunctionData({
    abi: AGENT_REGISTRY_8004_ABI,
    functionName: 'updateAgent',
    args: [
      BigInt(agentId),
      updates.name ?? '',
      updates.description ?? '',
      updates.endpointUrl ?? '',
      updates.agentCardUrl ?? '',
      toolsStr,
    ],
  });

  return {
    tx: {
      to: registryAddress,
      data,
      chainId: chain.chainId,
      value: '0',
      description: `Update agent #${agentId} metadata on BNB Chain (ERC-8004)`,
    },
    simulated: false,
  };
}

/**
 * Build an unsigned transaction to deregister an agent and unstake tokens.
 * In simulation mode, deregisters immediately.
 */
export async function deregisterAgent(
  agentId: number,
): Promise<{ tx: UnsignedTxData; success?: boolean; simulated: boolean }> {
  if (isSimulationMode()) {
    const success = simulateDeregister(agentId);
    return {
      tx: {
        to: '0x0000000000000000000000000000000000000000',
        data: '0x',
        chainId: BSC_TESTNET.chainId,
        value: '0',
        description: `[SIMULATED] Deregister agent #${agentId}`,
      },
      success,
      simulated: true,
    };
  }

  const config = getConfig();
  const registryAddress = config.registryAddress!;
  const chain = config.chain ?? BSC_TESTNET;

  const data = encodeFunctionData({
    abi: AGENT_REGISTRY_8004_ABI,
    functionName: 'deregisterAgent',
    args: [BigInt(agentId)],
  });

  return {
    tx: {
      to: registryAddress,
      data,
      chainId: chain.chainId,
      value: '0',
      description: `Deregister agent #${agentId} and return staked USDT`,
    },
    simulated: false,
  };
}

/**
 * Get registry-wide statistics from the on-chain contract.
 */
export async function getRegistryStats(): Promise<{
  totalAgents: number;
  activeAgents: number;
  stakeRequirement: string;
  simulated: boolean;
}> {
  if (isSimulationMode()) {
    let activeCount = 0;
    for (const agent of _simAgents.values()) {
      if (agent.active) activeCount++;
    }
    return {
      totalAgents: _simAgents.size,
      activeAgents: activeCount,
      stakeRequirement: '100',
      simulated: true,
    };
  }

  const config = getConfig();
  const registryAddress = config.registryAddress!;

  try {
    const totalData = encodeFunctionData({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'totalAgents',
      args: [],
    });
    const activeData = encodeFunctionData({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'activeAgentCount',
      args: [],
    });
    const stakeData = encodeFunctionData({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'stakeRequirement',
      args: [],
    });

    const [totalResult, activeResult, stakeResult] = await Promise.all([
      ethCall(registryAddress, totalData),
      ethCall(registryAddress, activeData),
      ethCall(registryAddress, stakeData),
    ]);

    const total = decodeFunctionResult({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'totalAgents',
      data: totalResult as Hex,
    }) as bigint;

    const active = decodeFunctionResult({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'activeAgentCount',
      data: activeResult as Hex,
    }) as bigint;

    const stake = decodeFunctionResult({
      abi: AGENT_REGISTRY_8004_ABI,
      functionName: 'stakeRequirement',
      data: stakeResult as Hex,
    }) as bigint;

    // Convert from wei to token units (18 decimals)
    const stakeInTokens = Number(stake) / 1e18;

    return {
      totalAgents: Number(total),
      activeAgents: Number(active),
      stakeRequirement: stakeInTokens.toString(),
      simulated: false,
    };
  } catch (error) {
    console.error('[erc8004] Failed to fetch registry stats:', error);
    return {
      totalAgents: 0,
      activeAgents: 0,
      stakeRequirement: '100',
      simulated: false,
    };
  }
}

/**
 * Get the contract addresses and chain info for the current configuration.
 */
export function getContractInfo(): {
  registryAddress: string;
  bbaiTokenAddress: string;
  chain: SupportedChain;
  simulationMode: boolean;
} {
  const config = getConfig();
  return {
    registryAddress: config.registryAddress ?? '',
    bbaiTokenAddress: config.bbaiTokenAddress ?? '',
    chain: config.chain ?? BSC_TESTNET,
    simulationMode: isSimulationMode(),
  };
}
