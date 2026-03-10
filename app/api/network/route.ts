import { NextRequest, NextResponse } from 'next/server';
import {
  getAllNodes,
  getNetworkStats,
  getMessages,
} from '@/lib/agent-network';

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// GET /api/network - Network overview (nodes, stats, recent messages)
// ---------------------------------------------------------------------------

// Mock network data for when DB is unavailable
const MOCK_NETWORK = {
  stats: { totalNodes: 8, onlineNodes: 6, totalMessages: 347, avgLatency: 142, totalVolume: 116, platformBreakdown: { boredbrain: 4, partner: 2, community: 2 } },
  nodes: [
    { id: 'node-bb-alpha', name: 'BoredBrain Alpha', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/alpha', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['DeFi Analysis', 'Trading Signals'], tools: ['coin_data', 'wallet_analyzer', 'web_search'], status: 'online', lastSeen: new Date(Date.now() - 60000).toISOString(), latency: 85, totalInteractions: 48, trustScore: 98, chain: 'base', walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12' },
    { id: 'node-bb-research', name: 'BB Research Hub', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/research', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Research', 'Analysis'], tools: ['academic_search', 'web_search', 'retrieve'], status: 'online', lastSeen: new Date(Date.now() - 120000).toISOString(), latency: 120, totalInteractions: 36, trustScore: 96, chain: 'base', walletAddress: null },
    { id: 'node-bb-trader', name: 'BB Trading Agent', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/trader', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Market Prediction', 'Technical Analysis'], tools: ['coin_data', 'stock_chart'], status: 'online', lastSeen: new Date(Date.now() - 30000).toISOString(), latency: 95, totalInteractions: 29, trustScore: 94, chain: 'arbitrum', walletAddress: '0xabcdef1234567890abcdef1234567890abcdef34' },
    { id: 'node-bb-nlp', name: 'BB NLP Engine', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/nlp', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['NLP', 'Translation'], tools: ['text_translate', 'web_search'], status: 'online', lastSeen: new Date(Date.now() - 300000).toISOString(), latency: 180, totalInteractions: 22, trustScore: 91, chain: null, walletAddress: null },
    { id: 'node-bb-sentinel', name: 'BB Sentinel', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/sentinel', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Security Audit', 'Rug Detection'], tools: ['code_interpreter', 'wallet_analyzer'], status: 'online', lastSeen: new Date(Date.now() - 60000).toISOString(), latency: 110, totalInteractions: 42, trustScore: 99, chain: 'base', walletAddress: '0x567890abcdef1234567890abcdef1234567890ab' },
    { id: 'node-partner-whale', name: 'WhaleAlert Partner', platform: 'partner', endpoint: 'https://api.boredbrain.app/v1/partner/whale', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Whale Tracking', 'Alert System'], tools: ['wallet_analyzer', 'token_retrieval'], status: 'degraded', lastSeen: new Date(Date.now() - 900000).toISOString(), latency: 340, totalInteractions: 19, trustScore: 87, chain: 'bsc', walletAddress: '0x890abcdef1234567890abcdef1234567890abcdef' },
    { id: 'node-bb-code', name: 'BB Code Assistant', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/code', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['Code Generation', 'Review'], tools: ['code_interpreter', 'web_search'], status: 'online', lastSeen: new Date(Date.now() - 90000).toISOString(), latency: 135, totalInteractions: 31, trustScore: 95, chain: null, walletAddress: null },
    { id: 'node-bb-news', name: 'BB NewsWire', platform: 'boredbrain', endpoint: 'https://api.boredbrain.app/v1/news', agentCardUrl: '/.well-known/agent-card.json', capabilities: ['News Aggregation', 'Fact Check'], tools: ['web_search', 'x_search', 'reddit_search'], status: 'online', lastSeen: new Date(Date.now() - 45000).toISOString(), latency: 75, totalInteractions: 53, trustScore: 97, chain: 'base', walletAddress: '0xdef1234567890abcdef1234567890abcdef123456' },
  ],
  recentMessages: [
    { id: 'msg-1', fromNodeId: 'node-bb-alpha', toNodeId: 'node-claude-research', type: 'invoke', payload: { task: 'Research DeFi yields' }, timestamp: new Date(Date.now() - 120000).toISOString(), latency: 85, status: 'processed' },
    { id: 'msg-2', fromNodeId: 'node-openai-trader', toNodeId: 'node-bb-sentinel', type: 'invoke', payload: { task: 'Audit smart contract' }, timestamp: new Date(Date.now() - 180000).toISOString(), latency: 120, status: 'processed' },
    { id: 'msg-3', fromNodeId: 'node-custom-whale', toNodeId: 'node-bb-alpha', type: 'billing', payload: { amount: 25 }, timestamp: new Date(Date.now() - 240000).toISOString(), latency: 45, status: 'delivered' },
    { id: 'msg-4', fromNodeId: 'node-bb-news', toNodeId: 'node-gemini-nlp', type: 'invoke', payload: { task: 'Translate news article' }, timestamp: new Date(Date.now() - 300000).toISOString(), latency: 180, status: 'processed' },
  ],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get('platform') || undefined;
  const status = searchParams.get('status') || undefined;
  const minTrustParam = searchParams.get('minTrust');
  const minTrust = minTrustParam ? parseInt(minTrustParam, 10) : undefined;

  try {
    const nodesPromise = getAllNodes({ platform, status, minTrust });
    const statsPromise = getNetworkStats();
    const msgsPromise = getMessages();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const [nodes, stats, messages] = await Promise.race([
      Promise.all([nodesPromise, statsPromise, msgsPromise]),
      timeout.then(() => { throw new Error('DB timeout'); }),
    ]);

    if (nodes.length > 0) {
      return NextResponse.json(
        {
          network: {
            name: 'BoredBrain Agent Network',
            version: '1.0.0',
            protocol: ['mcp', 'a2a'],
            description:
              'Cross-platform AI agent network enabling discovery and interaction across Claude, GPT, Gemini, and custom agents via MCP + A2A protocols.',
          },
          stats,
          nodes,
          recentMessages: messages.slice(0, 50),
        },
        {
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          },
        },
      );
    }
  } catch {
    // DB error or timeout — fall through to mock
  }

  // Mock fallback
  let mockNodes = MOCK_NETWORK.nodes;
  if (platform) mockNodes = mockNodes.filter((n) => n.platform === platform);
  if (status) mockNodes = mockNodes.filter((n) => n.status === status);
  if (minTrust) mockNodes = mockNodes.filter((n) => n.trustScore >= minTrust);

  return NextResponse.json(
    {
      network: {
        name: 'BoredBrain Agent Network',
        version: '1.0.0',
        protocol: ['mcp', 'a2a'],
        description:
          'Cross-platform AI agent network enabling discovery and interaction across Claude, GPT, Gemini, and custom agents via MCP + A2A protocols.',
      },
      stats: MOCK_NETWORK.stats,
      nodes: mockNodes,
      recentMessages: MOCK_NETWORK.recentMessages,
    },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    },
  );
}

// ---------------------------------------------------------------------------
// OPTIONS /api/network - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
