/**
 * Agent Execution Engine
 *
 * Core engine that routes agent prompts to real LLM providers (OpenAI, Anthropic,
 * xAI/Grok, Google Gemini) with automatic provider selection.
 * Returns an error response when no API keys are configured (no simulation).
 *
 * Uses raw fetch() for all API calls -- no SDK imports needed.
 */

import { serverEnv } from '@/env/server';
import { executeTool, getAvailableToolDefinitions } from '@/lib/tools/tool-executor';
import { buildContextFromMemory, recordMemory } from '@/lib/agent-memory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string | null;
  tools?: string[];
  /** Preferred LLM provider. If not set or unavailable, auto-selects. */
  preferredProvider?: LLMProvider;
  /** Preferred model name override (e.g. "gpt-4o", "claude-sonnet-4-20250514"). */
  preferredModel?: string;
}

export interface AgentResponse {
  content: string;
  model: string;
  tokensUsed: number;
  toolCalls?: ToolCallResult[];
  simulated: boolean;
}

export interface ToolCallResult {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
}

export type LLMProvider = 'openai' | 'anthropic' | 'xai' | 'google';

interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  endpoint: string;
}

interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Provider detection & selection
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  xai: 'grok-3',
  google: 'gemini-2.0-flash',
};

const PROVIDER_ENDPOINTS: Record<LLMProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  xai: 'https://api.x.ai/v1/chat/completions',
  google: '', // constructed dynamically with model name
};

function getGoogleEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/**
 * Detect which LLM providers have valid API keys configured.
 */
function getAvailableProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (serverEnv.OPENAI_API_KEY) {
    providers.push({
      provider: 'openai',
      apiKey: serverEnv.OPENAI_API_KEY,
      model: DEFAULT_MODELS.openai,
      endpoint: PROVIDER_ENDPOINTS.openai,
    });
  }

  if (serverEnv.ANTHROPIC_API_KEY) {
    providers.push({
      provider: 'anthropic',
      apiKey: serverEnv.ANTHROPIC_API_KEY,
      model: DEFAULT_MODELS.anthropic,
      endpoint: PROVIDER_ENDPOINTS.anthropic,
    });
  }

  if (serverEnv.XAI_API_KEY) {
    providers.push({
      provider: 'xai',
      apiKey: serverEnv.XAI_API_KEY,
      model: DEFAULT_MODELS.xai,
      endpoint: PROVIDER_ENDPOINTS.xai,
    });
  }

  if (serverEnv.GOOGLE_GENERATIVE_AI_API_KEY) {
    const model = DEFAULT_MODELS.google;
    providers.push({
      provider: 'google',
      apiKey: serverEnv.GOOGLE_GENERATIVE_AI_API_KEY,
      model,
      endpoint: getGoogleEndpoint(model),
    });
  }

  return providers;
}

/**
 * Select the best available provider, preferring the agent's preferred provider.
 */
function selectProvider(preferred?: LLMProvider, preferredModel?: string): ProviderConfig | null {
  const available = getAvailableProviders();
  if (available.length === 0) return null;

  // Try the preferred provider first
  if (preferred) {
    const match = available.find((p) => p.provider === preferred);
    if (match) {
      if (preferredModel) match.model = preferredModel;
      return match;
    }
  }

  // Fall back to first available, applying model override if same provider
  const fallback = available[0];
  if (preferredModel && preferred === fallback.provider) {
    fallback.model = preferredModel;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// LLM API callers (raw fetch)
// ---------------------------------------------------------------------------

interface LLMResult {
  content: string;
  model: string;
  tokensUsed: number;
  toolCallRequests?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

/**
 * Build OpenAI-compatible tool definitions from agent tool names.
 */
function buildToolDefs(toolNames: string[]): LLMToolDefinition[] {
  return getAvailableToolDefinitions(toolNames);
}

/**
 * Call OpenAI or xAI (both use the same chat completions format).
 */
async function callOpenAICompatible(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  tools?: LLMToolDefinition[],
): Promise<LLMResult> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.provider} API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message;
  const content = message?.content ?? '';
  const tokensUsed =
    (data.usage?.total_tokens) ??
    (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

  // Extract tool calls if present
  let toolCallRequests: LLMResult['toolCallRequests'];
  if (message?.tool_calls && Array.isArray(message.tool_calls)) {
    toolCallRequests = message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    }));
  }

  return {
    content,
    model: data.model ?? config.model,
    tokensUsed,
    toolCallRequests,
  };
}

/**
 * Call Anthropic Messages API.
 */
async function callAnthropic(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  tools?: LLMToolDefinition[],
): Promise<LLMResult> {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  // Convert OpenAI-style tool defs to Anthropic format
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Extract text content
  let content = '';
  let toolCallRequests: LLMResult['toolCallRequests'];

  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        if (!toolCallRequests) toolCallRequests = [];
        toolCallRequests.push({
          id: block.id,
          name: block.name,
          arguments: block.input ?? {},
        });
      }
    }
  }

  const tokensUsed =
    (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

  return {
    content,
    model: data.model ?? config.model,
    tokensUsed,
    toolCallRequests,
  };
}

/**
 * Call Google Gemini API.
 */
async function callGoogle(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  tools?: LLMToolDefinition[],
): Promise<LLMResult> {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  };

  // Convert tool defs to Gemini format
  if (tools && tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
  }

  const endpoint = `${config.endpoint}?key=${config.apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  let content = '';
  let toolCallRequests: LLMResult['toolCallRequests'];

  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) {
        content += part.text;
      } else if (part.functionCall) {
        if (!toolCallRequests) toolCallRequests = [];
        toolCallRequests.push({
          id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    }
  }

  const tokensUsed =
    (data.usageMetadata?.promptTokenCount ?? 0) +
    (data.usageMetadata?.candidatesTokenCount ?? 0);

  return {
    content,
    model: config.model,
    tokensUsed,
    toolCallRequests,
  };
}

// ---------------------------------------------------------------------------
// Error response when LLM is unavailable
// ---------------------------------------------------------------------------

function generateLLMUnavailableResponse(agent: AgentConfig, reason: string): AgentResponse {
  return {
    content: `[Agent ${agent.name}] LLM unavailable: ${reason}. Configure OPENAI_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.`,
    model: 'none',
    tokensUsed: 0,
    simulated: false,
  };
}

// ---------------------------------------------------------------------------
// Tool execution loop
// ---------------------------------------------------------------------------

/**
 * Execute tool calls requested by the LLM, returning results.
 */
async function executeToolCalls(
  toolRequests: NonNullable<LLMResult['toolCallRequests']>,
  allowedTools: string[],
): Promise<ToolCallResult[]> {
  const allowedSet = new Set(allowedTools);
  const results: ToolCallResult[] = [];

  for (const req of toolRequests) {
    // Only execute tools the agent is permitted to use
    if (!allowedSet.has(req.name)) {
      results.push({
        tool: req.name,
        input: req.arguments,
        output: { error: `Tool "${req.name}" is not available for this agent.` },
      });
      continue;
    }

    try {
      const output = await executeTool(req.name, req.arguments);
      results.push({ tool: req.name, input: req.arguments, output });
    } catch (err) {
      results.push({
        tool: req.name,
        input: req.arguments,
        output: { error: err instanceof Error ? err.message : 'Tool execution failed' },
      });
    }
  }

  return results;
}

/**
 * Build the follow-up messages that include tool results, to send back to the
 * LLM for a final synthesis. Returns the messages in OpenAI format.
 */
function buildToolResultMessages(
  systemPrompt: string,
  userPrompt: string,
  assistantContent: string,
  toolRequests: NonNullable<LLMResult['toolCallRequests']>,
  toolResults: ToolCallResult[],
  provider: LLMProvider,
): { messages: any[]; system?: string } {
  if (provider === 'anthropic') {
    // Anthropic format: messages array with tool_use and tool_result blocks
    return {
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
        {
          role: 'assistant',
          content: [
            ...(assistantContent ? [{ type: 'text', text: assistantContent }] : []),
            ...toolRequests.map((req) => ({
              type: 'tool_use',
              id: req.id,
              name: req.name,
              input: req.arguments,
            })),
          ],
        },
        {
          role: 'user',
          content: toolResults.map((r) => ({
            type: 'tool_result',
            tool_use_id: toolRequests.find((t) => t.name === r.tool)?.id ?? r.tool,
            content: JSON.stringify(r.output).slice(0, 10000),
          })),
        },
      ],
    };
  }

  // OpenAI / xAI format
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
      {
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolRequests.map((req) => ({
          id: req.id,
          type: 'function',
          function: {
            name: req.name,
            arguments: JSON.stringify(req.arguments),
          },
        })),
      },
      ...toolResults.map((r) => ({
        role: 'tool',
        tool_call_id: toolRequests.find((t) => t.name === r.tool)?.id ?? r.tool,
        content: JSON.stringify(r.output).slice(0, 10000),
      })),
    ],
  };
}

// ---------------------------------------------------------------------------
// Main execution function
// ---------------------------------------------------------------------------

/**
 * Execute an agent with a given prompt, routing to the best available LLM
 * provider and executing any requested tool calls.
 *
 * @param agent - The agent configuration
 * @param prompt - The user's prompt / query
 * @param context - Optional additional context to prepend to the system prompt
 * @param maxToolRounds - Maximum number of tool-use rounds (default 3)
 */
export async function executeAgent(
  agent: AgentConfig,
  prompt: string,
  context?: string,
  maxToolRounds: number = 3,
): Promise<AgentResponse> {
  // Select provider
  const provider = selectProvider(agent.preferredProvider, agent.preferredModel);

  // No API key available: return error (no silent simulation)
  if (!provider) {
    return generateLLMUnavailableResponse(agent, 'No LLM API keys configured');
  }

  // Recall relevant memories for this query (fire-and-forget on failure)
  let memoryContext = '';
  try {
    memoryContext = await buildContextFromMemory(agent.id, prompt);
  } catch {
    // Memory recall failed — proceed without it
  }

  // Build system prompt
  const systemParts: string[] = [
    `You are ${agent.name}, an AI agent on the BoredBrain platform.`,
  ];
  if (agent.description) {
    systemParts.push(agent.description);
  }
  if (agent.systemPrompt) {
    systemParts.push(agent.systemPrompt);
  }
  if (memoryContext) {
    systemParts.push(memoryContext);
  }
  if (agent.tools && agent.tools.length > 0) {
    systemParts.push(
      `You have access to these tools: ${agent.tools.join(', ')}. Use them when they would help answer the user's query.`,
    );
  }
  systemParts.push(
    'Provide clear, actionable, and well-structured responses. Use data and evidence when available.',
  );
  if (context) {
    systemParts.push(`\nAdditional context:\n${context}`);
  }
  const systemPrompt = systemParts.join('\n\n');

  // Build tool definitions if agent has tools
  const toolDefs =
    agent.tools && agent.tools.length > 0 ? buildToolDefs(agent.tools) : undefined;

  // Call the LLM
  let totalTokens = 0;
  let allToolCalls: ToolCallResult[] = [];
  let finalContent = '';

  try {
    let result: LLMResult;

    // Initial call
    if (provider.provider === 'anthropic') {
      result = await callAnthropic(provider, systemPrompt, prompt, toolDefs);
    } else if (provider.provider === 'google') {
      result = await callGoogle(provider, systemPrompt, prompt, toolDefs);
    } else {
      // openai or xai
      result = await callOpenAICompatible(provider, systemPrompt, prompt, toolDefs);
    }

    totalTokens += result.tokensUsed;
    finalContent = result.content;

    // Tool execution loop
    let round = 0;
    while (
      result.toolCallRequests &&
      result.toolCallRequests.length > 0 &&
      round < maxToolRounds &&
      agent.tools &&
      agent.tools.length > 0
    ) {
      round++;

      // Execute the requested tools
      const toolResults = await executeToolCalls(result.toolCallRequests, agent.tools);
      allToolCalls.push(...toolResults);

      // Send tool results back to the LLM for synthesis
      const followUp = buildToolResultMessages(
        systemPrompt,
        prompt,
        result.content,
        result.toolCallRequests,
        toolResults,
        provider.provider,
      );

      if (provider.provider === 'anthropic') {
        const body: Record<string, unknown> = {
          model: provider.model,
          max_tokens: 4096,
          system: followUp.system,
          messages: followUp.messages,
        };
        if (toolDefs && toolDefs.length > 0) {
          body.tools = toolDefs.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          }));
        }
        const resp = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Anthropic follow-up error ${resp.status}: ${errText}`);
        }
        const data = await resp.json();
        result = {
          content: '',
          model: data.model ?? provider.model,
          tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        };
        if (Array.isArray(data.content)) {
          const newToolCalls: LLMResult['toolCallRequests'] = [];
          for (const block of data.content) {
            if (block.type === 'text') result.content += block.text;
            else if (block.type === 'tool_use') {
              newToolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
            }
          }
          if (newToolCalls.length > 0) result.toolCallRequests = newToolCalls;
        }
      } else if (provider.provider === 'google') {
        // For Google, re-call with appended conversation
        const body: Record<string, unknown> = {
          contents: [
            { role: 'user', parts: [{ text: prompt }] },
            {
              role: 'model',
              parts: result.toolCallRequests.map((req) => ({
                functionCall: { name: req.name, args: req.arguments },
              })),
            },
            {
              role: 'user',
              parts: toolResults.map((r) => ({
                functionResponse: {
                  name: r.tool,
                  response: typeof r.output === 'object' ? r.output : { result: r.output },
                },
              })),
            },
          ],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        };
        if (toolDefs && toolDefs.length > 0) {
          body.tools = [
            {
              functionDeclarations: toolDefs.map((t) => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters,
              })),
            },
          ];
        }
        const endpoint = `${getGoogleEndpoint(provider.model)}?key=${provider.apiKey}`;
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Google follow-up error ${resp.status}: ${errText}`);
        }
        const data = await resp.json();
        const candidate = data.candidates?.[0];
        result = {
          content: '',
          model: provider.model,
          tokensUsed:
            (data.usageMetadata?.promptTokenCount ?? 0) +
            (data.usageMetadata?.candidatesTokenCount ?? 0),
        };
        if (candidate?.content?.parts) {
          const newToolCalls: LLMResult['toolCallRequests'] = [];
          for (const part of candidate.content.parts) {
            if (part.text) result.content += part.text;
            else if (part.functionCall) {
              newToolCalls.push({
                id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args ?? {},
              });
            }
          }
          if (newToolCalls.length > 0) result.toolCallRequests = newToolCalls;
        }
      } else {
        // OpenAI / xAI follow-up
        const body: Record<string, unknown> = {
          model: provider.model,
          messages: followUp.messages,
          max_tokens: 4096,
          temperature: 0.7,
        };
        if (toolDefs && toolDefs.length > 0) {
          body.tools = toolDefs;
          body.tool_choice = 'auto';
        }
        const resp = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`${provider.provider} follow-up error ${resp.status}: ${errText}`);
        }
        const data = await resp.json();
        const choice = data.choices?.[0];
        const msg = choice?.message;
        result = {
          content: msg?.content ?? '',
          model: data.model ?? provider.model,
          tokensUsed:
            (data.usage?.total_tokens) ??
            (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
        };
        if (msg?.tool_calls && Array.isArray(msg.tool_calls)) {
          result.toolCallRequests = msg.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments:
              typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : tc.function.arguments,
          }));
        }
      }

      totalTokens += result.tokensUsed;
      finalContent = result.content;
    }

    // Record this interaction as episodic memory (fire-and-forget)
    const memorySummary = `Q: ${prompt.slice(0, 200)} | A: ${finalContent.slice(0, 300)}`;
    recordMemory({
      agentId: agent.id,
      type: 'episodic',
      content: memorySummary,
      importance: allToolCalls.length > 0 ? 7 : 5,
      tags: agent.tools?.slice(0, 5) ?? [],
    }).catch(() => {});

    return {
      content: finalContent,
      model: provider.model,
      tokensUsed: totalTokens,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      simulated: false,
    };
  } catch (error) {
    console.error(`[agent-executor] LLM call failed for ${agent.name}:`, error);

    // Return error — no silent simulation
    return generateLLMUnavailableResponse(
      agent,
      error instanceof Error ? error.message : 'LLM call failed',
    );
  }
}

// ---------------------------------------------------------------------------
// Streaming support (async generator)
// ---------------------------------------------------------------------------

export interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_result' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCallResult;
  model?: string;
  tokensUsed?: number;
}

/**
 * Stream an agent execution, yielding chunks as they arrive.
 * Currently streams the final response text character-by-character.
 * For providers that support native streaming, this can be extended.
 */
export async function* executeAgentStream(
  agent: AgentConfig,
  prompt: string,
  context?: string,
): AsyncGenerator<StreamChunk> {
  try {
    const response = await executeAgent(agent, prompt, context);

    // Yield tool calls first
    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        yield { type: 'tool_start', content: `Executing tool: ${tc.tool}` };
        yield { type: 'tool_result', toolCall: tc };
      }
    }

    // Stream the content in chunks (simulate streaming from non-streamed response)
    const chunkSize = 20;
    for (let i = 0; i < response.content.length; i += chunkSize) {
      yield {
        type: 'text',
        content: response.content.slice(i, i + chunkSize),
      };
    }

    yield {
      type: 'done',
      model: response.model,
      tokensUsed: response.tokensUsed,
    };
  } catch (error) {
    yield {
      type: 'error',
      content: error instanceof Error ? error.message : 'Stream execution failed',
    };
  }
}
