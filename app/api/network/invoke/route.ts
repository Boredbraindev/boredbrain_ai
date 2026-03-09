import { NextRequest, NextResponse } from 'next/server';
import {
  getNode,
  invokeExternalAgent,
} from '@/lib/agent-network';

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// POST /api/network/invoke - Invoke an agent on any network node
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: {
    targetNodeId?: string;
    query?: string;
    tools?: string[];
    maxBudget?: number;
    callerNodeId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    );
  }

  const { targetNodeId, query, tools, maxBudget, callerNodeId } = body;

  if (!targetNodeId || !query) {
    return NextResponse.json(
      {
        error: 'Missing required fields: targetNodeId, query',
        required: ['targetNodeId', 'query'],
        optional: ['tools', 'maxBudget', 'callerNodeId'],
      },
      { status: 400, headers: corsHeaders },
    );
  }

  // Resolve the target node
  const targetNode = await getNode(targetNodeId);
  if (!targetNode) {
    return NextResponse.json(
      { error: `Node not found: ${targetNodeId}` },
      { status: 404, headers: corsHeaders },
    );
  }

  if (targetNode.status === 'offline') {
    return NextResponse.json(
      {
        error: `Node is offline: ${targetNode.name}`,
        node: {
          id: targetNode.id,
          name: targetNode.name,
          status: targetNode.status,
          lastSeen: targetNode.lastSeen,
        },
      },
      { status: 503, headers: corsHeaders },
    );
  }

  try {
    const result = await invokeExternalAgent(
      targetNodeId,
      query,
      tools,
      callerNodeId,
    );

    // Check budget
    if (maxBudget !== undefined && result.cost > maxBudget) {
      return NextResponse.json(
        {
          error: 'Invocation cost exceeds max budget',
          cost: result.cost,
          maxBudget,
          currency: 'USDT',
        },
        { status: 402, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        success: true,
        result: {
          response: result.response,
          cost: result.cost,
          currency: 'USDT',
          latency: result.latency,
        },
        node: {
          id: targetNode.id,
          name: targetNode.name,
          platform: targetNode.platform,
          trustScore: targetNode.trustScore,
        },
        billing: callerNodeId
          ? {
              callerNodeId,
              targetNodeId,
              totalCost: result.cost,
              status: 'settled',
            }
          : null,
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Invocation failed',
        targetNodeId,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

// ---------------------------------------------------------------------------
// OPTIONS /api/network/invoke - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
