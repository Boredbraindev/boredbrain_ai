export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllNodes,
  registerNode,
  type NetworkNode,
} from '@/lib/agent-network';

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// GET /api/network/nodes - List all nodes with filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get('platform') || undefined;
  const status = searchParams.get('status') || undefined;
  const minTrustParam = searchParams.get('minTrust');
  const minTrust = minTrustParam ? parseInt(minTrustParam, 10) : undefined;

  const nodes = await getAllNodes({ platform, status, minTrust });

  return NextResponse.json(
    {
      totalNodes: nodes.length,
      nodes,
    },
    { headers: corsHeaders },
  );
}

// ---------------------------------------------------------------------------
// POST /api/network/nodes - Register a new external node
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    platform?: NetworkNode['platform'];
    endpoint?: string;
    agentCardUrl?: string;
    capabilities?: string[];
    tools?: string[];
    chain?: string | null;
    walletAddress?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    );
  }

  if (!body.name || !body.platform || !body.endpoint) {
    return NextResponse.json(
      {
        error: 'Missing required fields: name, platform, endpoint',
        required: ['name', 'platform', 'endpoint'],
        optional: ['agentCardUrl', 'capabilities', 'tools', 'chain', 'walletAddress'],
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const validPlatforms: NetworkNode['platform'][] = [
    'boredbrain',
    'claude',
    'openai',
    'gemini',
    'custom',
  ];

  if (!validPlatforms.includes(body.platform)) {
    return NextResponse.json(
      {
        error: `Invalid platform: "${body.platform}". Must be one of: ${validPlatforms.join(', ')}`,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const node = await registerNode({
    name: body.name,
    platform: body.platform,
    endpoint: body.endpoint,
    agentCardUrl: body.agentCardUrl,
    capabilities: body.capabilities,
    tools: body.tools,
    chain: body.chain,
    walletAddress: body.walletAddress,
  });

  return NextResponse.json(
    {
      success: true,
      node,
    },
    { status: 201, headers: corsHeaders },
  );
}

// ---------------------------------------------------------------------------
// OPTIONS /api/network/nodes - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
