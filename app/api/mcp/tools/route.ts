export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getPooledClient, releasePooledClient } from '@/lib/mcp/client';
import type { MCPToolDefinition } from '@/lib/mcp/client';
import {
  getProviderConfig,
  getStaticToolList,
  isProviderConfigured,
  getAllProviderIds,
  getProviderStatus,
} from '@/lib/mcp/providers';
import { getIntegrationById, EXTERNAL_INTEGRATIONS } from '@/lib/external-integrations';

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// In-memory cache for tool lists fetched from live MCP servers
// ---------------------------------------------------------------------------

interface CachedToolList {
  tools: MCPToolDefinition[];
  fetchedAt: number;
  source: 'live' | 'static';
}

const toolCache = new Map<string, CachedToolList>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// GET /api/mcp/tools
//
// Query params:
//   - integrationId: (optional) Return tools for a specific MCP provider
//   - refresh:       (optional) Set to "true" to bypass cache
//
// If no integrationId is provided, returns a summary of all providers with
// their tool counts and configuration status.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('integrationId');
  const refresh = searchParams.get('refresh') === 'true';

  // ---------------------------------------------------------------------------
  // Single provider: return its tool list
  // ---------------------------------------------------------------------------
  if (integrationId) {
    return handleSingleProvider(integrationId, refresh);
  }

  // ---------------------------------------------------------------------------
  // No integrationId: return summary of all providers
  // ---------------------------------------------------------------------------
  return handleAllProviders();
}

// ---------------------------------------------------------------------------
// Fetch tools for a single MCP provider
// ---------------------------------------------------------------------------

async function handleSingleProvider(integrationId: string, refresh: boolean) {
  const integration = getIntegrationById(integrationId);
  if (!integration) {
    return NextResponse.json(
      {
        error: `Unknown integration: "${integrationId}". Use GET /api/integrations to list all.`,
      },
      { status: 404, headers: corsHeaders },
    );
  }

  const providerConfig = getProviderConfig(integrationId);
  if (!providerConfig) {
    // No MCP config - return static tools from the integration registry
    const staticTools = integration.tools.map((name) => ({
      name,
      description: `Tool from ${integration.name}`,
    }));

    return NextResponse.json(
      {
        integrationId,
        name: integration.name,
        tools: staticTools,
        toolCount: staticTools.length,
        source: 'registry',
        status: 'no_mcp_config',
        message: 'No MCP connection configured. Showing tools from integration registry.',
      },
      { headers: corsHeaders },
    );
  }

  // Check cache first (unless refresh requested)
  if (!refresh) {
    const cached = toolCache.get(integrationId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        {
          integrationId,
          name: integration.name,
          tools: cached.tools,
          toolCount: cached.tools.length,
          source: cached.source,
          cached: true,
          cachedAt: new Date(cached.fetchedAt).toISOString(),
          transport: providerConfig.transport,
          configured: isProviderConfigured(integrationId),
        },
        { headers: corsHeaders },
      );
    }
  }

  // Try to fetch tools from the live MCP server
  if (isProviderConfigured(integrationId)) {
    try {
      const client = await getPooledClient(providerConfig);
      const liveTools = await client.listTools();

      // Cache the result
      const cacheEntry: CachedToolList = {
        tools: liveTools,
        fetchedAt: Date.now(),
        source: 'live',
      };
      toolCache.set(integrationId, cacheEntry);

      return NextResponse.json(
        {
          integrationId,
          name: integration.name,
          tools: liveTools,
          toolCount: liveTools.length,
          source: 'live',
          cached: false,
          transport: providerConfig.transport,
          configured: true,
        },
        { headers: corsHeaders },
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[mcp/tools] Failed to fetch tools from ${integrationId}:`,
        errorMessage,
      );

      // Release broken connection
      await releasePooledClient(integrationId).catch(() => {});

      // Fall back to static tool list
      const staticTools = getStaticToolList(integrationId);

      // Cache the static fallback too (shorter TTL)
      toolCache.set(integrationId, {
        tools: staticTools,
        fetchedAt: Date.now(),
        source: 'static',
      });

      return NextResponse.json(
        {
          integrationId,
          name: integration.name,
          tools: staticTools,
          toolCount: staticTools.length,
          source: 'static',
          cached: false,
          transport: providerConfig.transport,
          configured: true,
          warning: `Could not reach MCP server. Showing static tool list. Error: ${errorMessage}`,
        },
        { headers: corsHeaders },
      );
    }
  }

  // Provider exists but is not configured (missing env vars)
  const staticTools = getStaticToolList(integrationId);

  return NextResponse.json(
    {
      integrationId,
      name: integration.name,
      tools: staticTools,
      toolCount: staticTools.length,
      source: 'static',
      cached: false,
      transport: providerConfig.transport,
      configured: false,
      warning: 'Provider is not fully configured. Missing required environment variables.',
    },
    { headers: corsHeaders },
  );
}

// ---------------------------------------------------------------------------
// Return a summary of all providers
// ---------------------------------------------------------------------------

async function handleAllProviders() {
  const providerStatuses = getProviderStatus();
  const allProviderIds = getAllProviderIds();

  const summary = EXTERNAL_INTEGRATIONS.map((integration) => {
    const hasConfig = allProviderIds.includes(integration.id);
    const status = providerStatuses.find((s) => s.providerId === integration.id);
    const staticTools = getStaticToolList(integration.id);
    const cached = toolCache.get(integration.id);

    return {
      integrationId: integration.id,
      name: integration.name,
      category: integration.category,
      registeredToolCount: integration.toolCount,
      staticToolCount: staticTools.length,
      cachedToolCount: cached?.tools.length ?? null,
      cachedSource: cached?.source ?? null,
      hasMCPConfig: hasConfig,
      transport: status?.transport ?? null,
      configured: status?.configured ?? false,
      missingEnvVars: status?.missingEnvVars ?? [],
      integrationStatus: integration.status,
      chains: integration.chains,
      compatibility: integration.compatibility,
    };
  });

  const totalTools = summary.reduce((sum, s) => sum + s.registeredToolCount, 0);
  const configuredCount = summary.filter((s) => s.configured).length;

  return NextResponse.json(
    {
      providers: summary,
      stats: {
        totalProviders: summary.length,
        configuredProviders: configuredCount,
        unconfiguredProviders: summary.length - configuredCount,
        totalRegisteredTools: totalTools,
      },
      usage: 'Add ?integrationId=<id> to get the full tool list for a specific provider.',
    },
    { headers: corsHeaders },
  );
}

// ---------------------------------------------------------------------------
// OPTIONS /api/mcp/tools - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
