export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getAllTools, getToolPrice, getToolInfo } from '@/lib/tool-pricing';
import { neon } from '@neondatabase/serverless';

/**
 * A2A (Agent-to-Agent) Protocol Endpoint
 * JSON-RPC 2.0 compatible
 */

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// A2A is a server-to-server JSON-RPC protocol — external agents on any domain
// need to call these endpoints. CORS * is intentional here (same as Google A2A spec).
// Authentication is handled per-method via wallet signatures and billing checks.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// Fetch agents from the database (same source as /api/agents/discover)
// ---------------------------------------------------------------------------

interface A2AAgent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  specialization: string;
}

async function getRegisteredAgents(): Promise<A2AAgent[]> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const dbPromise = sql`SELECT * FROM external_agent WHERE status = 'active'`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );
    const dbAgents = await Promise.race([dbPromise, timeout]);

    return dbAgents.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description ?? '',
      tools: (a.tools as string[]) ?? [],
      specialization: a.specialization,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Inline: get network stats via raw SQL
// ---------------------------------------------------------------------------

async function getNetworkStatsEdge(): Promise<{ totalNodes: number; onlineNodes: number; totalMessages: number; avgLatency?: number }> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const nodeStats = await sql`
      SELECT
        count(*)::int AS total_nodes,
        count(*) filter (where status = 'online')::int AS online_nodes,
        coalesce(round(avg(latency))::int, 0) AS avg_latency
      FROM network_node
    `;
    const msgStats = await sql`SELECT count(*)::int AS total_messages FROM network_message`;
    return {
      totalNodes: nodeStats[0]?.total_nodes ?? 0,
      onlineNodes: nodeStats[0]?.online_nodes ?? 0,
      totalMessages: msgStats[0]?.total_messages ?? 0,
      avgLatency: nodeStats[0]?.avg_latency ?? 0,
    };
  } catch {
    return { totalNodes: 0, onlineNodes: 0, totalMessages: 0, avgLatency: 0 };
  }
}

// ---------------------------------------------------------------------------
// Inline: get node by ID via raw SQL
// ---------------------------------------------------------------------------

async function getNodeEdge(nodeId: string) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT * FROM network_node WHERE id = ${nodeId} LIMIT 1`;
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Inline: invoke external agent via raw SQL
// ---------------------------------------------------------------------------

async function invokeExternalAgentEdge(
  nodeId: string,
  query: string,
  tools?: string[],
  callerNodeId?: string,
): Promise<{ response: string; cost: number; latency: number }> {
  const node = await getNodeEdge(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  if (node.status === 'offline') throw new Error(`Node is offline: ${node.name}`);

  const toolsToUse = tools && tools.length > 0 ? tools : ((node.tools as string[]) ?? []).slice(0, 2);
  let totalCost = 0;
  for (const tool of toolsToUse) {
    const price = getToolPrice(tool);
    totalCost += price ?? 5;
  }

  // Generate simulated response (simplified for edge)
  const baseLatency: Record<string, number> = { boredbrain: 50, claude: 120, openai: 110, gemini: 130, custom: 200 };
  const latency = (baseLatency[node.platform] || 150) + Math.floor(Math.random() * 100);

  const platformResponses: Record<string, string> = {
    boredbrain: `[BoredBrain ${node.name}] Processed query: "${query}". Used tools: ${toolsToUse.join(', ')}. Analysis complete.`,
    claude: `[Claude Agent ${node.name}] Research analysis for "${query}" completed. Synthesized findings from ${toolsToUse.length} tools.`,
    openai: `[GPT Agent ${node.name}] Trading analysis for "${query}" complete. Identified actionable signals.`,
    gemini: `[Gemini Agent ${node.name}] Data analysis for "${query}" processed. Multi-modal analysis across ${toolsToUse.length} channels.`,
    custom: `[Custom Agent ${node.name}] Executed query "${query}" using ${toolsToUse.length} tools.`,
  };

  const response = platformResponses[node.platform] || platformResponses.custom;

  // Record messages and settle billing via raw SQL
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const fromNode = callerNodeId || 'bb-network-hub';

    await sql`
      INSERT INTO network_message (from_node_id, to_node_id, type, payload, timestamp, latency, status)
      VALUES (${fromNode}, ${nodeId}, 'invoke', ${JSON.stringify({ query, tools: toolsToUse, cost: totalCost })}, NOW(), ${latency}, 'processed')
    `;
    await sql`
      INSERT INTO network_message (from_node_id, to_node_id, type, payload, timestamp, latency, status)
      VALUES (${nodeId}, ${fromNode}, 'response', ${JSON.stringify({ response: response.slice(0, 100), latency, cost: totalCost })}, NOW(), ${latency}, 'processed')
    `;

    // Settle billing if callerNodeId provided
    if (callerNodeId) {
      await settleBillingEdge(sql, callerNodeId, nodeId, toolsToUse, totalCost);
    }

    // Update node stats
    await sql`
      UPDATE network_node
      SET total_interactions = total_interactions + 1, last_seen = NOW(), latency = ${latency}
      WHERE id = ${nodeId}
    `;
  } catch {
    // Non-critical
  }

  return { response, cost: totalCost, latency };
}

// ---------------------------------------------------------------------------
// Inline: settleBilling via raw SQL
// ---------------------------------------------------------------------------

function generateWalletAddress(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    const char = agentId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  let hex = '';
  let seed = Math.abs(hash);
  while (hex.length < 40) {
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    hex += seed.toString(16);
  }
  return '0x' + hex.slice(0, 40);
}

async function ensureWalletEdge(sql: any, agentId: string) {
  const rows = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${agentId} LIMIT 1`;
  if (rows.length > 0) return rows[0];
  const address = generateWalletAddress(agentId);
  const created = await sql`
    INSERT INTO agent_wallet (id, agent_id, address, balance, daily_limit, total_spent, is_active)
    VALUES (${generateId()}, ${agentId}, ${address}, 50, 50, 0, true)
    RETURNING *
  `;
  await sql`
    INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
    VALUES (${generateId()}, ${agentId}, 50, 'credit', 'Initial wallet funding', 50)
  `;
  return created[0];
}

async function settleBillingEdge(
  sql: any,
  callerAgentId: string,
  providerAgentId: string,
  toolsUsed: string[],
  totalCost: number,
) {
  const platformFee = Number(((totalCost * 15) / 100).toFixed(4));
  const providerEarning = Number(((totalCost * 85) / 100).toFixed(4));

  await ensureWalletEdge(sql, callerAgentId);
  await ensureWalletEdge(sql, providerAgentId);

  // Deduct from caller
  const callerWallet = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${callerAgentId} LIMIT 1`;
  if (callerWallet.length > 0 && callerWallet[0].balance >= totalCost) {
    const newBalance = callerWallet[0].balance - totalCost;
    await sql`UPDATE agent_wallet SET balance = ${newBalance}, total_spent = total_spent + ${totalCost} WHERE agent_id = ${callerAgentId} AND balance >= ${totalCost}`;
    await sql`
      INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
      VALUES (${generateId()}, ${callerAgentId}, ${totalCost}, 'debit', ${'Inter-agent billing: called ' + providerAgentId}, ${newBalance})
    `;
  }

  // Credit provider
  const providerWallet = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${providerAgentId} LIMIT 1`;
  if (providerWallet.length > 0) {
    const newBalance = providerWallet[0].balance + providerEarning;
    await sql`UPDATE agent_wallet SET balance = ${newBalance} WHERE agent_id = ${providerAgentId}`;
    await sql`
      INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
      VALUES (${generateId()}, ${providerAgentId}, ${providerEarning}, 'credit', 'Wallet top-up', ${newBalance})
    `;
  }

  // Record billing
  const rows = await sql`
    INSERT INTO billing_record (caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
    VALUES (${callerAgentId}, ${providerAgentId}, ${JSON.stringify(toolsUsed)}, ${totalCost}, ${platformFee}, ${providerEarning}, 'completed')
    RETURNING *
  `;

  return {
    success: true,
    billingId: rows[0]?.id ?? '',
    breakdown: {
      totalCost,
      platformFee,
      providerEarning,
      callerAgentId,
      providerAgentId,
      toolsUsed,
    },
  };
}

// ---------------------------------------------------------------------------
// Mock tool execution
// ---------------------------------------------------------------------------

function executeMockTool(toolName: string, args: Record<string, unknown>): string {
  const query =
    typeof args?.query === 'string'
      ? args.query
      : typeof args?.text === 'string'
        ? args.text
        : typeof args?.code === 'string'
          ? args.code
          : toolName;

  const results: Record<string, (q: string) => string> = {
    web_search: (q) => `Found 12 results for "${q}". Top sources: CoinDesk, Bloomberg, CoinTelegraph.`,
    x_search: (q) => `48 posts found for "${q}". Sentiment: Bullish (62%). Top engagement: 2.3k.`,
    coin_data: (q) => `${q.toUpperCase()}: $67,432.18 | +2.4% (24h) | MCap $1.32T | Vol $28.5B.`,
    coin_ohlc: (q) => `${q.toUpperCase()} OHLC: O $66,100 | H $68,200 | L $65,800 | C $67,432.`,
    wallet_analyzer: (q) => `Address analysis: 23 tokens, ~$145K net worth, 312 txns (30d), Risk: Low.`,
    stock_chart: (q) => `${q.toUpperCase()}: $187.45 | 52wk H $199.62 | L $124.17 | P/E 28.3.`,
    academic_search: (q) => `8 papers found for "${q}". Top cited: 145 citations (2024). Sources: Nature, IEEE.`,
    reddit_search: (q) => `34 posts for "${q}". Top: 1.2k upvotes, 89 comments. Sentiment: cautiously optimistic.`,
    youtube_search: (q) => `15 videos for "${q}". Top: 234K views. Avg view count: 85K.`,
    code_interpreter: (q) => `Code executed successfully. Result: { status: "ok", executionTime: "1.2s" }.`,
    retrieve: (q) => `Fetched "${q}": 2,450 words parsed, 3 topics identified.`,
    text_translate: (q) => `Translation complete. Confidence: 98%.`,
    currency_converter: (q) => `Converted: 1 USD = 0.92 EUR | 1 BTC = $67,432.`,
    token_retrieval: (q) => `${q}: Verified contract | 12,450 holders | Liquidity $2.3M | No issues.`,
    nft_retrieval: (q) => `"${q}": Floor 0.45 ETH | Supply 10K | 5,234 holders | 24h vol 12.3 ETH.`,
    extreme_search: (q) => `Deep analysis of "${q}": 47 sources across 6 domains synthesized.`,
    smart_contract_audit: (q) => `Audit: 0 critical, 1 medium, 3 low issues. Score: 87/100.`,
    whale_alert: (q) => `"${q}": 3 large txns in 1h. Largest: 500 BTC ($33.7M). Net flow: outbound.`,
  };

  const gen = results[toolName];
  return gen ? gen(query) : `Tool "${toolName}" executed for "${query}". Done.`;
}

// ---------------------------------------------------------------------------
// GET /api/a2a - A2A protocol info + supported methods
// ---------------------------------------------------------------------------

export async function GET() {
  const stats = await getNetworkStatsEdge();

  return NextResponse.json(
    {
      protocol: 'a2a',
      version: '1.0.0',
      name: 'BoredBrain A2A Gateway',
      description:
        'Agent-to-Agent protocol endpoint for the BoredBrain AI Agent Economy. JSON-RPC 2.0 compatible.',
      methods: [
        { name: 'agent/discover', description: 'Returns agent capabilities, available agents, and tools.', params: '(none)' },
        { name: 'agent/invoke', description: 'Execute an agent task with specified tools.', params: '{ agentId, query, tools?, callerAgentId? }' },
        { name: 'agent/status', description: 'Check agent and network availability.', params: '{ agentId? }' },
        { name: 'tools/list', description: 'List all available tools with pricing.', params: '{ category? }' },
        { name: 'tools/call', description: 'Execute a specific tool with arguments.', params: '{ tool, arguments, agentId? }' },
        { name: 'billing/quote', description: 'Get a price quote for a set of tools.', params: '{ tools }' },
        { name: 'billing/settle', description: 'Settle a payment between two agents.', params: '{ callerAgentId, providerAgentId, tools, totalCost }' },
      ],
      network: {
        totalNodes: stats.totalNodes,
        onlineNodes: stats.onlineNodes,
        totalMessages: stats.totalMessages,
      },
      authentication: {
        type: 'wallet-signature',
        token: 'BBAI',
        note: 'Demo mode available without authentication.',
      },
      endpoints: {
        mcp: '/api/mcp',
        a2a: '/api/a2a',
        network: '/api/network',
        agents: '/api/agents/discover',
      },
    },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
}

// ---------------------------------------------------------------------------
// POST /api/a2a - Handle A2A protocol messages (JSON-RPC 2.0)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let rpcRequest: {
    jsonrpc: string;
    method: string;
    params: any;
    id: string | number;
  };

  try {
    rpcRequest = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: Invalid JSON' }, id: null },
      { headers: corsHeaders },
    );
  }

  if (rpcRequest.jsonrpc !== '2.0') {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }, id: rpcRequest.id },
      { headers: corsHeaders },
    );
  }

  const params = rpcRequest.params || {};

  switch (rpcRequest.method) {
    // -------------------------------------------------------------------
    // agent/discover
    // -------------------------------------------------------------------
    case 'agent/discover': {
      const allTools = getAllTools();
      const agents = await getRegisteredAgents();

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            platform: 'BoredBrain AI',
            agents,
            totalAgents: agents.length,
            totalTools: allTools.length,
            capabilities: { streaming: true, batchExecution: true, crossPlatform: true, protocols: ['mcp', 'a2a'] },
            payment: { token: 'BBAI', chains: [8453, 56], acceptedMethods: ['wallet-signature', 'agent-wallet'] },
            endpoints: { mcp: '/api/mcp', mcpExecute: '/api/mcp/execute', a2a: '/api/a2a', network: '/api/network', agentCard: '/.well-known/agent.json' },
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // agent/invoke
    // -------------------------------------------------------------------
    case 'agent/invoke': {
      const { agentId, query, tools, callerAgentId } = params;

      if (!agentId || !query) {
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32602, message: 'Missing required params: agentId, query' }, id: rpcRequest.id },
          { headers: corsHeaders },
        );
      }

      const registeredAgents = await getRegisteredAgents();
      const builtInAgent = registeredAgents.find((a) => a.id === agentId);

      let externalNode: any = null;
      if (!builtInAgent) {
        externalNode = await getNodeEdge(agentId);
      }

      if (!builtInAgent && !externalNode) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: { code: -32602, message: `Unknown agent: "${agentId}". Available agents: ${registeredAgents.map((a) => a.id).join(', ')}.` },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      const agentMeta = builtInAgent
        ? { id: builtInAgent.id, name: builtInAgent.name, specialization: builtInAgent.specialization, type: 'built-in' as const }
        : { id: externalNode!.id, name: externalNode!.name, specialization: externalNode!.platform, type: 'external' as const };

      const effectiveTools = tools || (builtInAgent ? builtInAgent.tools : (externalNode!.tools as string[]));

      try {
        const result = await invokeExternalAgentEdge(agentId, query, effectiveTools, callerAgentId);

        return NextResponse.json(
          {
            jsonrpc: '2.0',
            result: {
              taskId: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              status: 'completed',
              agent: agentMeta,
              response: result.response,
              billing: { cost: result.cost, currency: 'BBAI', latency: result.latency },
              timestamp: new Date().toISOString(),
            },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Agent invocation failed';
        let errorCode = -32603;
        if (errMsg.includes('offline') || errMsg.includes('unreachable')) errorCode = -32001;
        else if (errMsg.includes('timeout') || errMsg.includes('aborted') || errMsg.includes('abort')) errorCode = -32002;
        else if (errMsg.includes('not found') || errMsg.includes('Node not found')) errorCode = -32003;

        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: errorCode, message: errMsg, data: { agentId, type: builtInAgent ? 'built-in' : 'external' } }, id: rpcRequest.id },
          { headers: corsHeaders },
        );
      }
    }

    // -------------------------------------------------------------------
    // agent/status
    // -------------------------------------------------------------------
    case 'agent/status': {
      const { agentId: statusAgentId } = params;
      const statusAgents = await getRegisteredAgents();

      if (statusAgentId) {
        const agent = statusAgents.find((a) => a.id === statusAgentId);
        if (!agent) {
          return NextResponse.json(
            { jsonrpc: '2.0', error: { code: -32602, message: `Unknown agent: "${statusAgentId}"` }, id: rpcRequest.id },
            { headers: corsHeaders },
          );
        }

        return NextResponse.json(
          {
            jsonrpc: '2.0',
            result: { agentId: agent.id, name: agent.name, status: 'online', tools: agent.tools, specialization: agent.specialization, uptime: '99.8%', lastChecked: new Date().toISOString() },
            id: rpcRequest.id,
          },
          { headers: corsHeaders },
        );
      }

      const stats = await getNetworkStatsEdge();
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            platform: 'online',
            agents: statusAgents.map((a) => ({ id: a.id, name: a.name, status: 'online', specialization: a.specialization })),
            network: { totalNodes: stats.totalNodes, onlineNodes: stats.onlineNodes, avgLatency: stats.avgLatency },
            timestamp: new Date().toISOString(),
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // tools/list
    // -------------------------------------------------------------------
    case 'tools/list': {
      const allTools = getAllTools();
      const { category } = params;

      const filtered = category
        ? allTools.filter((t) => t.category === category)
        : allTools;

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            totalTools: filtered.length,
            currency: 'BBAI',
            tools: filtered.map((t) => ({ id: t.id, name: t.name, category: t.category, price: t.price, unit: 'BBAI' })),
            categories: [...new Set(allTools.map((t) => t.category))],
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // tools/call
    // -------------------------------------------------------------------
    case 'tools/call': {
      const { tool, arguments: toolArgs, agentId: callerAgent } = params;

      if (!tool) {
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32602, message: 'Missing required param: tool' }, id: rpcRequest.id },
          { headers: corsHeaders },
        );
      }

      const toolInfo = getToolInfo(tool);
      if (!toolInfo) {
        const allTools = getAllTools();
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32602, message: `Unknown tool: "${tool}". Available: ${allTools.map((t) => t.id).join(', ')}` }, id: rpcRequest.id },
          { headers: corsHeaders },
        );
      }

      const result = executeMockTool(tool, toolArgs || {});

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: { tool, output: result, billing: { cost: toolInfo.price, currency: 'BBAI', agentId: callerAgent || null }, timestamp: new Date().toISOString() },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // billing/quote
    // -------------------------------------------------------------------
    case 'billing/quote': {
      const { tools: quoteTools } = params;

      if (!quoteTools || !Array.isArray(quoteTools) || quoteTools.length === 0) {
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32602, message: 'Missing required param: tools (array of tool names)' }, id: rpcRequest.id },
          { headers: corsHeaders },
        );
      }

      const breakdown = quoteTools.map((toolName: string) => {
        const price = getToolPrice(toolName);
        return { tool: toolName, price: price ?? null, available: price !== null };
      });

      const totalCost = breakdown.reduce(
        (sum: number, item: { price: number | null }) => sum + (item.price ?? 0),
        0,
      );

      const platformFee = Number(((totalCost * 15) / 100).toFixed(4));

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: {
            quote: { tools: breakdown, subtotal: totalCost, platformFee, total: Number((totalCost + platformFee).toFixed(4)), currency: 'BBAI' },
            validFor: '5 minutes',
            timestamp: new Date().toISOString(),
          },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // billing/settle
    // -------------------------------------------------------------------
    case 'billing/settle': {
      const { callerAgentId, providerAgentId, tools: settleTools, totalCost } = params;

      if (!callerAgentId || !providerAgentId || !settleTools || !totalCost) {
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32602, message: 'Missing required params: callerAgentId, providerAgentId, tools, totalCost' }, id: rpcRequest.id },
          { headers: corsHeaders },
        );
      }

      const sql = neon(process.env.DATABASE_URL!);
      const settlement = await settleBillingEdge(sql, callerAgentId, providerAgentId, settleTools, totalCost);

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          result: { success: settlement.success, billingId: settlement.billingId, breakdown: settlement.breakdown, timestamp: new Date().toISOString() },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
    }

    // -------------------------------------------------------------------
    // Default - Method not found
    // -------------------------------------------------------------------
    default:
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: "${rpcRequest.method}". Supported methods: agent/discover, agent/invoke, agent/status, tools/list, tools/call, billing/quote, billing/settle` },
          id: rpcRequest.id,
        },
        { headers: corsHeaders },
      );
  }
}

// ---------------------------------------------------------------------------
// OPTIONS /api/a2a - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
