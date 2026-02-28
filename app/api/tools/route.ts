import { NextResponse } from 'next/server';
import { getToolCatalog } from '@/lib/agent-api/tool-registry';

/**
 * GET /api/tools - Discover available tools, their schemas, and pricing
 * Public endpoint - no authentication required for discovery
 */
export async function GET() {
  const catalog = getToolCatalog();

  return NextResponse.json({
    platform: 'BoredBrain AI Agent Economy',
    version: '1.0.0',
    token: '$BBAI',
    chains: [
      { chainId: 8453, name: 'Base', status: 'active' },
      { chainId: 56, name: 'BNB Smart Chain', status: 'active' },
    ],
    authentication: {
      type: 'bearer',
      header: 'Authorization: Bearer bb_sk_xxx',
      alternateHeader: 'x-api-key: bb_sk_xxx',
      getKeyAt: '/api/keys',
    },
    tools: catalog,
    totalTools: catalog.length,
    protocols: {
      a2a: '/.well-known/agent-card.json',
      rest: '/api/tools/{toolName}',
      batch: '/api/tools/batch',
    },
  });
}
