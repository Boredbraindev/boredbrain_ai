/**
 * Cross-Platform Agent Network
 *
 * Enables external AI platforms (Claude, GPT, Gemini, custom agents) to
 * discover and interact with BoredBrain via standard protocols (MCP + A2A).
 * Backed by Drizzle ORM with PostgreSQL.
 */

import { db } from '@/lib/db';
import { networkNode, networkMessage } from '@/lib/db/schema';
import { eq, and, gte, desc, sql, or } from 'drizzle-orm';
import { getAllTools, getToolPrice } from '@/lib/tool-pricing';
import { settleBilling } from '@/lib/inter-agent-billing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetworkNode {
  id: string;
  name: string;
  platform: 'boredbrain' | 'claude' | 'openai' | 'gemini' | 'custom';
  endpoint: string;
  agentCardUrl: string;
  capabilities: string[];
  tools: string[];
  status: 'online' | 'offline' | 'degraded';
  lastSeen: string;
  latency: number; // ms
  totalInteractions: number;
  trustScore: number; // 0-100
  chain: string | null;
  walletAddress: string | null;
}

export interface NetworkMessage {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: 'discovery' | 'invoke' | 'response' | 'billing' | 'heartbeat';
  payload: any;
  timestamp: string;
  latency: number;
  status: 'sent' | 'delivered' | 'processed' | 'failed';
}

export interface NetworkStats {
  totalNodes: number;
  onlineNodes: number;
  totalMessages: number;
  avgLatency: number;
  totalVolume: number; // USDT
  platformBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateWalletAddress(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  let hex = '';
  let s = Math.abs(hash);
  while (hex.length < 40) {
    s = ((s * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    hex += s.toString(16);
  }
  return '0x' + hex.slice(0, 40);
}

function rowToNode(row: typeof networkNode.$inferSelect): NetworkNode {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform as NetworkNode['platform'],
    endpoint: row.endpoint,
    agentCardUrl: row.agentCardUrl || `${row.endpoint}/.well-known/agent.json`,
    capabilities: row.capabilities ?? [],
    tools: row.tools ?? [],
    status: row.status as NetworkNode['status'],
    lastSeen: row.lastSeen.toISOString(),
    latency: row.latency,
    totalInteractions: row.totalInteractions,
    trustScore: row.trustScore,
    chain: row.chain ?? null,
    walletAddress: row.walletAddress ?? null,
  };
}

function rowToMessage(row: typeof networkMessage.$inferSelect): NetworkMessage {
  return {
    id: row.id,
    fromNodeId: row.fromNodeId,
    toNodeId: row.toNodeId,
    type: row.type as NetworkMessage['type'],
    payload: row.payload,
    timestamp: row.timestamp.toISOString(),
    latency: row.latency ?? 0,
    status: row.status as NetworkMessage['status'],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a new node in the network.
 */
export async function registerNode(data: {
  name: string;
  platform: NetworkNode['platform'];
  endpoint: string;
  agentCardUrl?: string;
  capabilities?: string[];
  tools?: string[];
  chain?: string | null;
  walletAddress?: string | null;
  trustScore?: number;
  id?: string;
}): Promise<NetworkNode> {
  const id =
    data.id ||
    `node-${data.platform}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  // Don't duplicate
  const existing = await db
    .select()
    .from(networkNode)
    .where(eq(networkNode.id, id))
    .limit(1);

  if (existing.length > 0) {
    return rowToNode(existing[0]);
  }

  const [inserted] = await db
    .insert(networkNode)
    .values({
      id,
      name: data.name,
      platform: data.platform,
      endpoint: data.endpoint,
      agentCardUrl:
        data.agentCardUrl || `${data.endpoint}/.well-known/agent.json`,
      capabilities: data.capabilities || [],
      tools: data.tools || [],
      status: 'online',
      lastSeen: new Date(),
      latency: Math.floor(Math.random() * 100) + 20,
      totalInteractions: 0,
      trustScore: data.trustScore ?? 50,
      chain: data.chain || null,
      walletAddress: data.walletAddress || generateWalletAddress(id),
    })
    .returning();

  return rowToNode(inserted);
}

/**
 * Retrieve a single node by ID.
 */
export async function getNode(
  nodeId: string,
): Promise<NetworkNode | undefined> {
  const rows = await db
    .select()
    .from(networkNode)
    .where(eq(networkNode.id, nodeId))
    .limit(1);

  return rows.length > 0 ? rowToNode(rows[0]) : undefined;
}

/**
 * List all nodes, optionally filtered.
 */
export async function getAllNodes(filters?: {
  platform?: string;
  status?: string;
  minTrust?: number;
}): Promise<NetworkNode[]> {
  const conditions = [];

  if (filters?.platform) {
    conditions.push(eq(networkNode.platform, filters.platform));
  }
  if (filters?.status) {
    conditions.push(eq(networkNode.status, filters.status));
  }
  if (filters?.minTrust !== undefined) {
    conditions.push(gte(networkNode.trustScore, filters.minTrust));
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(networkNode)
          .where(and(...conditions))
      : await db.select().from(networkNode);

  return rows.map(rowToNode);
}

/**
 * Update a node's status and lastSeen.
 */
export async function updateNodeStatus(
  nodeId: string,
  status: NetworkNode['status'],
): Promise<void> {
  await db
    .update(networkNode)
    .set({ status, lastSeen: new Date() })
    .where(eq(networkNode.id, nodeId));
}

/**
 * Record a message between two network nodes.
 */
export async function sendMessage(
  fromNodeId: string,
  toNodeId: string,
  type: NetworkMessage['type'],
  payload: any,
): Promise<NetworkMessage> {
  const latency = Math.floor(Math.random() * 200) + 10;

  const [inserted] = await db
    .insert(networkMessage)
    .values({
      fromNodeId,
      toNodeId,
      type,
      payload,
      timestamp: new Date(),
      latency,
      status: 'processed',
    })
    .returning();

  // Update interaction counts for both nodes
  await db
    .update(networkNode)
    .set({
      totalInteractions: sql`${networkNode.totalInteractions} + 1`,
      lastSeen: new Date(),
    })
    .where(eq(networkNode.id, fromNodeId));

  await db
    .update(networkNode)
    .set({
      totalInteractions: sql`${networkNode.totalInteractions} + 1`,
      lastSeen: new Date(),
    })
    .where(eq(networkNode.id, toNodeId));

  return rowToMessage(inserted);
}

/**
 * Get messages, optionally filtered by a specific node.
 */
export async function getMessages(
  nodeId?: string,
): Promise<NetworkMessage[]> {
  let rows;

  if (!nodeId) {
    rows = await db
      .select()
      .from(networkMessage)
      .orderBy(desc(networkMessage.timestamp));
  } else {
    rows = await db
      .select()
      .from(networkMessage)
      .where(
        or(
          eq(networkMessage.fromNodeId, nodeId),
          eq(networkMessage.toNodeId, nodeId),
        ),
      )
      .orderBy(desc(networkMessage.timestamp));
  }

  return rows.map(rowToMessage);
}

/**
 * Compute aggregate network statistics.
 */
export async function getNetworkStats(): Promise<NetworkStats> {
  // Aggregate node stats in a single query
  const [nodeStats] = await db
    .select({
      totalNodes: sql<number>`count(*)::int`,
      onlineNodes: sql<number>`count(*) filter (where ${networkNode.status} = 'online')::int`,
      avgLatency: sql<number>`coalesce(round(avg(${networkNode.latency}))::int, 0)`,
    })
    .from(networkNode);

  // Total message count
  const [msgStats] = await db
    .select({
      totalMessages: sql<number>`count(*)::int`,
    })
    .from(networkMessage);

  // Platform breakdown
  const platformRows = await db
    .select({
      platform: networkNode.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(networkNode)
    .groupBy(networkNode.platform);

  const platformBreakdown: Record<string, number> = {};
  for (const row of platformRows) {
    platformBreakdown[row.platform] = row.count;
  }

  // Calculate total volume from billing/invoke messages
  const [volumeResult] = await db
    .select({
      totalVolume: sql<number>`coalesce(sum(
        coalesce(
          (${networkMessage.payload}->>'cost')::numeric,
          (${networkMessage.payload}->>'totalCost')::numeric,
          0
        )
      ), 0)::numeric`,
    })
    .from(networkMessage)
    .where(
      or(
        eq(networkMessage.type, 'billing'),
        eq(networkMessage.type, 'invoke'),
      ),
    );

  return {
    totalNodes: nodeStats.totalNodes,
    onlineNodes: nodeStats.onlineNodes,
    totalMessages: msgStats.totalMessages,
    avgLatency: nodeStats.avgLatency,
    totalVolume: Number(Number(volumeResult.totalVolume).toFixed(2)),
    platformBreakdown,
  };
}

/**
 * Fetch an agent card from a remote URL and register the node.
 * Makes a real HTTP GET to retrieve the agent card JSON.
 * Falls back to simulation if the fetch fails (backward compatible).
 */
export async function discoverExternalAgent(
  agentCardUrl: string,
): Promise<NetworkNode> {
  const url = new URL(agentCardUrl);
  const hostname = url.hostname;

  // Defaults derived from the URL (used as fallback if fetch fails)
  let platform: NetworkNode['platform'] = 'custom';
  let name = hostname.replace(/\./g, '-');
  let capabilities: string[] = ['text-generation', 'tool-use'];
  let tools: string[] = [];
  let endpoint = `${url.protocol}//${url.host}${url.pathname.replace(/\/\.well-known\/agent(?:-card)?\.json$/, '')}`;
  let trustScore = Math.floor(Math.random() * 30) + 50;

  // Detect platform from hostname (fallback heuristic)
  if (hostname.includes('anthropic') || hostname.includes('claude')) {
    platform = 'claude';
    name = `claude-agent-${Math.random().toString(36).slice(2, 6)}`;
  } else if (hostname.includes('openai') || hostname.includes('gpt')) {
    platform = 'openai';
    name = `gpt-agent-${Math.random().toString(36).slice(2, 6)}`;
  } else if (hostname.includes('google') || hostname.includes('gemini')) {
    platform = 'gemini';
    name = `gemini-agent-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Attempt to fetch the real agent card
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(agentCardUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[agent-network] Agent card fetch returned ${response.status} for ${agentCardUrl}, falling back to simulation`,
      );
    } else {
      const card = await response.json();

      // Extract fields from the agent card, with safe fallbacks
      if (card.name && typeof card.name === 'string') {
        name = card.name;
      }

      // Detect platform from the card
      if (card.provider?.organization) {
        const org = card.provider.organization.toLowerCase();
        if (org.includes('anthropic') || org.includes('claude')) platform = 'claude';
        else if (org.includes('openai') || org.includes('gpt')) platform = 'openai';
        else if (org.includes('google') || org.includes('gemini')) platform = 'gemini';
        else if (org.includes('boredbrain')) platform = 'boredbrain';
      }

      // Extract capabilities
      if (card.capabilities) {
        if (Array.isArray(card.capabilities)) {
          capabilities = card.capabilities;
        } else if (card.capabilities.protocols && Array.isArray(card.capabilities.protocols)) {
          capabilities = card.capabilities.protocols;
        }
      }

      // Extract tools from skills or agents
      if (card.skills && Array.isArray(card.skills)) {
        tools = card.skills.map((s: any) => s.id || s.name).filter(Boolean);
      } else if (card.agents && Array.isArray(card.agents)) {
        const allTools = new Set<string>();
        for (const agent of card.agents) {
          if (agent.tools && Array.isArray(agent.tools)) {
            agent.tools.forEach((t: string) => allTools.add(t));
          }
        }
        tools = Array.from(allTools);
      }

      // Extract endpoint from card
      if (card.url && typeof card.url === 'string') {
        endpoint = card.url;
      } else if (card.endpoints?.a2a) {
        // If relative, resolve against the agent card URL
        try {
          endpoint = new URL(card.endpoints.a2a, agentCardUrl).toString();
        } catch {
          // keep the default endpoint
        }
      }

      // Higher trust for agents that actually respond with a valid card
      trustScore = Math.floor(Math.random() * 20) + 70;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[agent-network] Failed to fetch agent card from ${agentCardUrl}: ${message}. Falling back to simulation.`,
    );
    // Continue with defaults -- backward compatible simulation
  }

  const node = await registerNode({
    name,
    platform,
    endpoint,
    agentCardUrl,
    capabilities,
    tools,
    trustScore,
  });

  // Record the discovery message
  await sendMessage('bb-network-hub', node.id, 'discovery', {
    action: 'agent_discovered',
    agentCardUrl,
    platform,
    fetchedRealCard: trustScore >= 70,
  });

  return node;
}

/**
 * Invoke an agent on a target node. For external nodes with an endpoint,
 * this makes a real HTTP POST with the A2A protocol request format.
 * Falls back to simulated responses if the HTTP call fails or the endpoint
 * is not reachable.
 */
export async function invokeExternalAgent(
  nodeId: string,
  query: string,
  tools?: string[],
  callerNodeId?: string,
): Promise<{ response: string; cost: number; latency: number }> {
  const node = await getNode(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (node.status === 'offline') {
    throw new Error(`Node is offline: ${node.name}`);
  }

  // Calculate cost based on requested tools
  const toolsToUse =
    tools && tools.length > 0 ? tools : node.tools.slice(0, 2);
  let totalCost = 0;
  for (const tool of toolsToUse) {
    const price = getToolPrice(tool);
    totalCost += price ?? 5; // default 5 USDT if tool not in pricing
  }

  let response: string;
  let latency: number;

  // Attempt real HTTP invocation if the node has a valid endpoint
  const hasValidEndpoint =
    node.endpoint &&
    (node.endpoint.startsWith('http://') || node.endpoint.startsWith('https://'));

  if (hasValidEndpoint) {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      // Build the A2A endpoint URL -- prefer /api/a2a if the endpoint is a base URL
      let invokeUrl = node.endpoint;
      if (!invokeUrl.includes('/api/a2a') && !invokeUrl.includes('/invoke')) {
        invokeUrl = invokeUrl.replace(/\/+$/, '') + '/api/a2a';
      }

      const rpcId = `bb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      const httpResponse = await fetch(invokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'agent/invoke',
          params: {
            tool: toolsToUse[0] || 'default',
            input: query,
            tools: toolsToUse,
            query,
            callerAgentId: callerNodeId || 'bb-network-hub',
          },
          id: rpcId,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      latency = Date.now() - startTime;

      if (!httpResponse.ok) {
        throw new Error(
          `HTTP ${httpResponse.status}: ${httpResponse.statusText}`,
        );
      }

      const rpcResponse = await httpResponse.json();

      // Parse the JSON-RPC response
      if (rpcResponse.error) {
        throw new Error(
          `RPC error ${rpcResponse.error.code}: ${rpcResponse.error.message}`,
        );
      }

      // Extract the response text from the RPC result
      if (rpcResponse.result) {
        const result = rpcResponse.result;
        response =
          typeof result === 'string'
            ? result
            : result.response ||
              result.output ||
              result.text ||
              JSON.stringify(result);

        // Use cost from remote if provided
        if (result.billing?.cost && typeof result.billing.cost === 'number') {
          totalCost = result.billing.cost;
        }
      } else {
        response = JSON.stringify(rpcResponse);
      }

      console.log(
        `[agent-network] Real invocation to ${node.name} (${invokeUrl}) succeeded in ${latency}ms`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout =
        errMsg.includes('aborted') || errMsg.includes('abort');

      console.warn(
        `[agent-network] External invocation to ${node.name} failed: ${errMsg}. Falling back to simulation.`,
      );

      // If the error was a timeout, mark the node as degraded
      if (isTimeout) {
        await db
          .update(networkNode)
          .set({ status: 'degraded', lastSeen: new Date() })
          .where(eq(networkNode.id, nodeId));
      }

      // Fall back to simulated response
      const fallback = generateSimulatedResponse(node, query, toolsToUse);
      response = fallback.response;
      latency = fallback.latency;
    }
  } else {
    // No valid endpoint -- use simulation (backward compatible)
    const fallback = generateSimulatedResponse(node, query, toolsToUse);
    response = fallback.response;
    latency = fallback.latency;
  }

  // Record the invoke message
  const fromNode = callerNodeId || 'bb-network-hub';
  await sendMessage(fromNode, nodeId, 'invoke', {
    query,
    tools: toolsToUse,
    cost: totalCost,
  });

  // Record the response message
  await sendMessage(nodeId, fromNode, 'response', {
    response: response.slice(0, 100) + '...',
    latency,
    cost: totalCost,
  });

  // Handle billing if callerNodeId provided
  if (callerNodeId) {
    const providerNodeId = nodeId;
    const callerAgentId = callerNodeId.startsWith('node-')
      ? callerNodeId
      : callerNodeId;
    const providerAgentId = providerNodeId.startsWith('node-')
      ? providerNodeId
      : providerNodeId;

    await settleBilling(callerAgentId, providerAgentId, toolsToUse, totalCost);

    await sendMessage(fromNode, nodeId, 'billing', {
      totalCost,
      currency: 'USDT',
      tools: toolsToUse,
      status: 'settled',
    });
  }

  // Update node stats
  await db
    .update(networkNode)
    .set({
      totalInteractions: sql`${networkNode.totalInteractions} + 1`,
      lastSeen: new Date(),
      latency,
    })
    .where(eq(networkNode.id, nodeId));

  return { response, cost: totalCost, latency };
}

/**
 * Generate a simulated response for agents that cannot be reached via HTTP.
 * Used as a fallback when the real HTTP call fails or no endpoint is configured.
 */
function generateSimulatedResponse(
  node: NetworkNode,
  query: string,
  toolsToUse: string[],
): { response: string; latency: number } {
  const baseLatency: Record<string, number> = {
    boredbrain: 50,
    claude: 120,
    openai: 110,
    gemini: 130,
    custom: 200,
  };
  const latency =
    (baseLatency[node.platform] || 150) + Math.floor(Math.random() * 100);

  const platformResponses: Record<string, string> = {
    boredbrain: `[BoredBrain ${node.name}] Processed query: "${query}". Used tools: ${toolsToUse.join(', ')}. Analysis complete with ${toolsToUse.length} data sources cross-referenced.`,
    claude: `[Claude Agent ${node.name}] Research analysis for "${query}" completed. Synthesized findings from ${toolsToUse.length} tools with high-confidence results. Key insights identified and ranked by relevance.`,
    openai: `[GPT Agent ${node.name}] Trading analysis for "${query}" complete. Identified ${Math.floor(Math.random() * 5) + 1} actionable signals across ${toolsToUse.length} data sources. Confidence level: ${(Math.random() * 20 + 80).toFixed(1)}%.`,
    gemini: `[Gemini Agent ${node.name}] Data analysis for "${query}" processed. Multi-modal analysis across ${toolsToUse.length} channels with ${Math.floor(Math.random() * 10) + 5} data points extracted.`,
    custom: `[Custom Agent ${node.name}] Executed query "${query}" using ${toolsToUse.length} tools. Results aggregated and formatted. Processing time: ${latency}ms.`,
  };

  const response =
    platformResponses[node.platform] || platformResponses.custom;

  return { response, latency };
}
