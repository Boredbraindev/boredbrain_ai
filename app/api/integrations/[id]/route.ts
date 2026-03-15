export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getIntegrationById } from '@/lib/external-integrations';
import { getNode } from '@/lib/agent-network';

// ---------------------------------------------------------------------------
// GET: Get details for a specific integration by ID
// Returns the integration data + any connected network node info
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  const integration = getIntegrationById(id);
  if (!integration) {
    return NextResponse.json(
      { error: `Integration not found: ${id}` },
      { status: 404 },
    );
  }

  // Check whether this integration has already been connected as a network node
  let connectedNode = null;
  try {
    const node = await getNode(`integration-${id}`);
    if (node) {
      connectedNode = node;
    }
  } catch {
    // DB may not be available; continue without node info
  }

  return NextResponse.json({
    integration,
    connected: connectedNode !== null,
    node: connectedNode,
  });
}
