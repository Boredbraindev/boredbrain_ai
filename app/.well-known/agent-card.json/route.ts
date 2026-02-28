import { NextResponse } from 'next/server';
import { getToolCatalog } from '@/lib/agent-api/tool-registry';

/**
 * GET /.well-known/agent-card.json
 * A2A (Agent-to-Agent) protocol Agent Card
 * Enables other AI agents to discover and interact with BoredBrain
 */
export async function GET() {
  const catalog = getToolCatalog();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boredbrain.ai';

  const agentCard = {
    // A2A Protocol v0.2 Agent Card
    name: 'BoredBrain AI',
    description:
      'AI Agent Economy Platform — 23+ real-time data tools (web search, crypto, stocks, weather, maps, academic, media). AI agents can discover, pay, and use tools via API.',
    url: baseUrl,
    version: '1.0.0',
    provider: {
      organization: 'BoredBrain',
      url: baseUrl,
    },

    // Capabilities
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },

    // Authentication
    authentication: {
      schemes: ['bearer'],
      credentials: {
        type: 'apiKey',
        description: 'API key with bb_sk_ prefix. Get one at /api/keys',
        in: 'header',
        name: 'Authorization',
      },
    },

    // Available skills (tools)
    skills: catalog.map((tool) => ({
      id: tool.name,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      pricing: {
        amount: tool.pricePerCall,
        currency: 'BBAI',
        model: 'per_call',
      },
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    })),

    // Service endpoints
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],

    // Custom extensions for AI Agent Economy
    'x-bbai': {
      token: {
        symbol: 'BBAI',
        name: 'BoredBrain AI',
        chains: [
          { chainId: 8453, name: 'Base' },
          { chainId: 56, name: 'BNB Smart Chain' },
        ],
      },
      endpoints: {
        toolDiscovery: `${baseUrl}/api/tools`,
        toolExecution: `${baseUrl}/api/tools/{toolName}`,
        batchExecution: `${baseUrl}/api/tools/batch`,
        a2a: `${baseUrl}/api/a2a`,
        apiKeys: `${baseUrl}/api/keys`,
        agentRegistry: `${baseUrl}/api/agents`,
        arena: `${baseUrl}/api/arena`,
      },
      onchain: {
        agentRegistry: 'Contract address set after deployment',
        paymentRouter: 'Contract address set after deployment',
        tokenContract: 'Contract address set after deployment',
      },
    },
  };

  return NextResponse.json(agentCard, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
