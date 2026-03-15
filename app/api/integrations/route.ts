export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import {
  EXTERNAL_INTEGRATIONS,
  getIntegrationsByChain,
  getIntegrationsByCategory,
  getIntegrationById,
} from '@/lib/external-integrations';
import { registerNode } from '@/lib/agent-network';

// ---------------------------------------------------------------------------
// GET: List all integrations with optional filters (chain, category, search)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get('chain');
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let integrations = EXTERNAL_INTEGRATIONS;

  if (chain) {
    integrations = getIntegrationsByChain(chain);
  }
  if (category) {
    integrations = integrations.filter((i) => i.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    integrations = integrations.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tools.some((t) => t.toLowerCase().includes(q)),
    );
  }

  return NextResponse.json({
    integrations,
    stats: {
      total: EXTERNAL_INTEGRATIONS.length,
      totalTools: EXTERNAL_INTEGRATIONS.reduce((sum, i) => sum + i.toolCount, 0),
      totalChains: [...new Set(EXTERNAL_INTEGRATIONS.flatMap((i) => i.chains))].length,
      categories: [...new Set(EXTERNAL_INTEGRATIONS.map((i) => i.category))],
    },
  });
}

// ---------------------------------------------------------------------------
// POST: Connect an integration to the network (registers as network node)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { integrationId } = body;

    if (!integrationId || typeof integrationId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid integrationId' },
        { status: 400 },
      );
    }

    const integration = getIntegrationById(integrationId);
    if (!integration) {
      return NextResponse.json(
        { error: `Integration not found: ${integrationId}` },
        { status: 404 },
      );
    }

    if (integration.status === 'coming_soon') {
      return NextResponse.json(
        { error: `Integration "${integration.name}" is not yet available` },
        { status: 422 },
      );
    }

    // Derive a platform value compatible with the NetworkNode type.
    // External integrations are always registered as 'custom' platform nodes.
    const node = await registerNode({
      id: `integration-${integration.id}`,
      name: integration.name,
      platform: 'custom',
      endpoint: integration.repo
        ? `https://github.com/${integration.repo}`
        : `https://${integration.id}.integration.boredbrain.io`,
      agentCardUrl: integration.repo
        ? `https://raw.githubusercontent.com/${integration.repo}/main/.well-known/agent.json`
        : undefined,
      capabilities: integration.compatibility ?? [],
      tools: integration.tools,
      chain: integration.chains[0] ?? null,
      trustScore: 70,
    });

    return NextResponse.json({
      success: true,
      integration,
      node,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/integrations] POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
