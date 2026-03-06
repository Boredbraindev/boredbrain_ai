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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get('platform') || undefined;
  const status = searchParams.get('status') || undefined;
  const minTrustParam = searchParams.get('minTrust');
  const minTrust = minTrustParam ? parseInt(minTrustParam, 10) : undefined;

  const nodes = await getAllNodes({ platform, status, minTrust });
  const stats = await getNetworkStats();
  const recentMessages = (await getMessages()).slice(0, 50);

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
      recentMessages,
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
