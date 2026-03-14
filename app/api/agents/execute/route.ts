export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextRequest } from 'next/server';
import { MOCK_AGENTS } from '@/lib/mock-data';
import {
  executeAgent,
  type AgentConfig,
  type LLMProvider,
} from '@/lib/agent-executor';
import { getToolPrice } from '@/lib/tool-pricing';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  type Schema,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const executeSchema: Schema = {
  agentId: { type: 'string', required: true, maxLength: 200 },
  prompt: { type: 'string', required: true, maxLength: 10000 },
  context: { type: 'string', required: false, maxLength: 5000 },
  provider: { type: 'string', required: false, enum: ['openai', 'anthropic', 'xai', 'google'] },
  model: { type: 'string', required: false, maxLength: 100 },
};

// ---------------------------------------------------------------------------
// Agent lookup (reuse MOCK_AGENTS + inline discovery agents)
// ---------------------------------------------------------------------------

const DISCOVERY_AGENTS: Array<{
  id: string;
  name: string;
  description: string;
  tools: string[];
  pricePerQuery: number;
}> = [
  {
    id: 'agent-defi-oracle',
    name: 'DeFi Oracle',
    description: 'Analyzes DeFi protocols, yield farming, and liquidity data.',
    tools: ['coin_data', 'coin_ohlc', 'wallet_analyzer', 'token_retrieval'],
    pricePerQuery: 40,
  },
  {
    id: 'agent-alpha-hunter',
    name: 'Alpha Hunter',
    description: 'Hunts market opportunities via whale monitoring and signals.',
    tools: ['web_search', 'x_search', 'coin_data', 'whale_alert'],
    pricePerQuery: 35,
  },
  {
    id: 'agent-research-bot',
    name: 'Research Bot',
    description: 'Academic and deep-web research with code execution.',
    tools: ['academic_search', 'web_search', 'retrieve', 'code_interpreter'],
    pricePerQuery: 30,
  },
  {
    id: 'agent-news-aggregator',
    name: 'News Aggregator',
    description: 'Compiles news from web, Reddit, YouTube, and X/Twitter.',
    tools: ['web_search', 'reddit_search', 'youtube_search', 'x_search'],
    pricePerQuery: 20,
  },
  {
    id: 'agent-code-auditor',
    name: 'Code Auditor',
    description: 'Smart contract vulnerability and gas auditing.',
    tools: ['code_interpreter', 'smart_contract_audit', 'web_search'],
    pricePerQuery: 45,
  },
  {
    id: 'agent-nft-analyst',
    name: 'NFT Analyst',
    description: 'NFT market analysis, collection tracking, and social buzz.',
    tools: ['nft_retrieval', 'wallet_analyzer', 'web_search', 'x_search'],
    pricePerQuery: 30,
  },
];

function resolveAgent(agentId: string): AgentConfig | null {
  // Check discovery agents
  const disc = DISCOVERY_AGENTS.find((a) => a.id === agentId);
  if (disc) {
    return {
      id: disc.id,
      name: disc.name,
      description: disc.description,
      tools: disc.tools,
    };
  }

  // Check mock agents
  const mock = MOCK_AGENTS.find((a) => a.id === agentId);
  if (mock) {
    return {
      id: mock.id,
      name: mock.name,
      description: mock.description,
      systemPrompt: mock.systemPrompt,
      tools: mock.tools as string[],
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST /api/agents/execute
// ---------------------------------------------------------------------------

/**
 * Execute an agent with a given prompt using real LLM providers.
 *
 * Request body:
 * {
 *   "agentId": "agent-alpha-researcher",
 *   "prompt": "Analyze Bitcoin market trends",
 *   "context": "Focus on DeFi integrations",     // optional
 *   "provider": "openai",                         // optional: openai|anthropic|xai|google
 *   "model": "gpt-4o"                             // optional model override
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "agentId": "...",
 *   "agentName": "...",
 *   "response": { content, model, tokensUsed, toolCalls, simulated },
 *   "billing": { estimatedCost, toolCosts, totalCost, costUnit }
 * }
 */
export async function POST(request: NextRequest) {
  // Parse body
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data as Record<string, unknown>;

  // Validate
  const { valid, errors, sanitized } = validateBody(body, executeSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const agentId = sanitized.agentId as string;
  const prompt = sanitized.prompt as string;
  const context = sanitized.context ? sanitizeString(sanitized.context, 5000) : undefined;
  const preferredProvider = sanitized.provider as LLMProvider | undefined;
  const preferredModel = sanitized.model ? sanitizeString(sanitized.model, 100) : undefined;

  // Resolve the agent
  const agentConfig = resolveAgent(agentId);
  if (!agentConfig) {
    return apiError(
      `Agent "${agentId}" not found. Use GET /api/agents/discover to list available agents.`,
      404,
    );
  }

  // Apply provider/model overrides
  if (preferredProvider) agentConfig.preferredProvider = preferredProvider;
  if (preferredModel) agentConfig.preferredModel = preferredModel;

  // Execute
  const startTime = Date.now();

  try {
    const response = await executeAgent(agentConfig, prompt, context);
    const latencyMs = Date.now() - startTime;

    // Calculate billing
    const toolCosts =
      response.toolCalls?.map((tc) => ({
        tool: tc.tool,
        cost: getToolPrice(tc.tool) ?? 5,
      })) ?? [];

    const toolTotal = toolCosts.reduce((sum, t) => sum + t.cost, 0);
    const llmCost = response.simulated ? 0 : Math.ceil(response.tokensUsed / 100); // 1 BBAI per 100 tokens

    return apiSuccess({
      agentId: agentConfig.id,
      agentName: agentConfig.name,
      response: {
        content: response.content,
        model: response.model,
        tokensUsed: response.tokensUsed,
        toolCalls: response.toolCalls,
        simulated: response.simulated,
      },
      billing: {
        llmCost,
        toolCosts,
        totalCost: llmCost + toolTotal,
        costUnit: 'BBAI',
      },
      meta: {
        latencyMs,
        timestamp: new Date().toISOString(),
        prompt: prompt.slice(0, 200),
      },
    });
  } catch (error) {
    console.error(`[agents/execute] Error executing agent ${agentId}:`, error);
    return apiError(
      error instanceof Error ? error.message : 'Agent execution failed',
      500,
    );
  }
}
