// ---------------------------------------------------------------------------
// MCP Client - JSON-RPC 2.0 communication with MCP servers
// Supports HTTP/SSE and stdio transports. No external SDK dependencies.
// ---------------------------------------------------------------------------

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type MCPTransport = 'stdio' | 'http' | 'sse';

export interface MCPConnectionConfig {
  /** Unique provider ID matching ExternalIntegration.id */
  providerId: string;
  /** Transport type to use */
  transport: MCPTransport;
  /** For http/sse: the server URL */
  url?: string;
  /** For stdio: the command to spawn */
  command?: string;
  /** For stdio: arguments to the command */
  args?: string[];
  /** For stdio: environment variables to set */
  env?: Record<string, string>;
  /** Required env vars that must be set for this provider to be usable */
  requiredEnvVars?: string[];
  /** Custom HTTP headers for http/sse transport */
  headers?: Record<string, string>;
  /** Connection timeout in ms (default 30000) */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Stdio Transport
// ---------------------------------------------------------------------------

class StdioTransport extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  private readonly config: MCPConnectionConfig;

  constructor(config: MCPConnectionConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new Error(`Stdio transport requires a command for provider "${this.config.providerId}"`);
    }

    const mergedEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...(this.config.env ?? {}),
    };

    // Resolve required env vars from process.env
    for (const key of this.config.requiredEnvVars ?? []) {
      if (!mergedEnv[key]) {
        throw new Error(
          `Missing required environment variable "${key}" for provider "${this.config.providerId}"`,
        );
      }
    }

    this.process = spawn(this.config.command, this.config.args ?? [], {
      env: mergedEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.drainBuffer();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[mcp:stdio:${this.config.providerId}] stderr:`, chunk.toString());
    });

    this.process.on('exit', (code) => {
      this.emit('close', code);
    });

    // Wait briefly for the process to start
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 500);
      this.process!.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn MCP server: ${err.message}`));
      });
    });
  }

  private drainBuffer() {
    // JSON-RPC messages are newline-delimited
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as JsonRpcResponse;
        this.emit('message', parsed);
      } catch {
        // Not valid JSON - skip
      }
    }
  }

  send(message: JsonRpcRequest): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('Stdio transport is not connected');
    }
    this.process.stdin.write(JSON.stringify(message) + '\n');
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  get connected(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

// ---------------------------------------------------------------------------
// HTTP Transport
// ---------------------------------------------------------------------------

class HttpTransport {
  private readonly config: MCPConnectionConfig;

  constructor(config: MCPConnectionConfig) {
    this.config = config;
  }

  async send(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.config.url) {
      throw new Error(`HTTP transport requires a url for provider "${this.config.providerId}"`);
    }

    const timeout = this.config.timeout ?? 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.headers ?? {}),
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `MCP HTTP request failed (${response.status}): ${text.slice(0, 500)}`,
        );
      }

      return (await response.json()) as JsonRpcResponse;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// SSE Transport - Server-Sent Events for streaming MCP servers
// ---------------------------------------------------------------------------

class SSETransport {
  private readonly config: MCPConnectionConfig;
  private messageEndpoint: string | null = null;

  constructor(config: MCPConnectionConfig) {
    this.config = config;
  }

  /**
   * Connects to the SSE endpoint, discovers the message POST endpoint,
   * then falls back to HTTP-style request/response via that endpoint.
   */
  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error(`SSE transport requires a url for provider "${this.config.providerId}"`);
    }

    const timeout = this.config.timeout ?? 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      // Open the SSE stream to discover the message endpoint
      const response = await fetch(this.config.url, {
        headers: {
          Accept: 'text/event-stream',
          ...(this.config.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed (${response.status})`);
      }

      // Read enough of the stream to find the endpoint event
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (accumulated.length < 8192) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Look for an "endpoint" event in SSE format
        const endpointMatch = accumulated.match(/event:\s*endpoint\ndata:\s*(.+)\n/);
        if (endpointMatch) {
          this.messageEndpoint = endpointMatch[1].trim();
          break;
        }
      }

      reader.cancel().catch(() => {});
    } finally {
      clearTimeout(timer);
    }

    if (!this.messageEndpoint) {
      // Fall back to posting to the same URL
      const baseUrl = new URL(this.config.url);
      baseUrl.pathname = baseUrl.pathname.replace(/\/sse\/?$/, '/message');
      this.messageEndpoint = baseUrl.toString();
    }
  }

  async send(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    const endpoint = this.messageEndpoint ?? this.config.url;
    if (!endpoint) {
      throw new Error('SSE transport not connected and no URL configured');
    }

    const timeout = this.config.timeout ?? 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.headers ?? {}),
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`MCP SSE POST failed (${response.status}): ${text.slice(0, 500)}`);
      }

      return (await response.json()) as JsonRpcResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  async close(): Promise<void> {
    this.messageEndpoint = null;
  }
}

// ---------------------------------------------------------------------------
// MCPClient - Main class
// ---------------------------------------------------------------------------

export class MCPClient {
  private readonly config: MCPConnectionConfig;
  private stdioTransport: StdioTransport | null = null;
  private httpTransport: HttpTransport | null = null;
  private sseTransport: SSETransport | null = null;
  private _connected = false;
  private _tools: MCPToolDefinition[] | null = null;
  private requestId = 0;

  constructor(config: MCPConnectionConfig) {
    this.config = config;
  }

  get providerId(): string {
    return this.config.providerId;
  }

  get connected(): boolean {
    return this._connected;
  }

  // -------------------------------------------------------------------------
  // connect() - Establish connection based on transport
  // -------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Validate required env vars before attempting connection
    for (const key of this.config.requiredEnvVars ?? []) {
      if (!process.env[key]) {
        throw new Error(
          `Missing required environment variable "${key}" for provider "${this.config.providerId}". ` +
          `Set it in your .env file or environment.`,
        );
      }
    }

    switch (this.config.transport) {
      case 'stdio': {
        this.stdioTransport = new StdioTransport(this.config);
        await this.stdioTransport.connect();
        break;
      }
      case 'http': {
        this.httpTransport = new HttpTransport(this.config);
        break;
      }
      case 'sse': {
        this.sseTransport = new SSETransport(this.config);
        await this.sseTransport.connect();
        break;
      }
      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }

    this._connected = true;

    // Send initialize handshake
    try {
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'boredbrain-mcp-client',
          version: '1.0.0',
        },
      });
    } catch {
      // Some servers don't require initialization - that's OK
    }
  }

  // -------------------------------------------------------------------------
  // disconnect()
  // -------------------------------------------------------------------------

  async disconnect(): Promise<void> {
    this._connected = false;
    this._tools = null;
    if (this.stdioTransport) {
      await this.stdioTransport.close();
      this.stdioTransport = null;
    }
    if (this.sseTransport) {
      await this.sseTransport.close();
      this.sseTransport = null;
    }
    this.httpTransport = null;
  }

  // -------------------------------------------------------------------------
  // listTools() - Get tools from the server (cached after first call)
  // -------------------------------------------------------------------------

  async listTools(): Promise<MCPToolDefinition[]> {
    if (this._tools) return this._tools;

    const response = await this.sendRequest('tools/list', {});
    const result = response.result as { tools?: MCPToolDefinition[] } | undefined;

    this._tools = result?.tools ?? [];
    return this._tools;
  }

  // -------------------------------------------------------------------------
  // executeTool() - Call a tool on the MCP server
  // -------------------------------------------------------------------------

  async executeTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<MCPToolResult> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    if (response.error) {
      return {
        content: [
          {
            type: 'text',
            text: `MCP Error (${response.error.code}): ${response.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const result = response.result as MCPToolResult | undefined;
    return (
      result ?? {
        content: [{ type: 'text', text: 'No result returned from MCP server' }],
        isError: true,
      }
    );
  }

  // -------------------------------------------------------------------------
  // sendRequest() - Send a JSON-RPC 2.0 request
  // -------------------------------------------------------------------------

  private async sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    if (this.httpTransport) {
      return this.httpTransport.send(request);
    }

    if (this.sseTransport) {
      return this.sseTransport.send(request);
    }

    if (this.stdioTransport) {
      return this.sendViaStdio(request);
    }

    throw new Error(`No transport available for provider "${this.config.providerId}"`);
  }

  private sendViaStdio(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = this.config.timeout ?? 30_000;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`MCP stdio request timed out after ${timeout}ms`));
      }, timeout);

      const onMessage = (msg: JsonRpcResponse) => {
        if (msg.id === request.id) {
          cleanup();
          resolve(msg);
        }
      };

      const onClose = () => {
        cleanup();
        reject(new Error('MCP stdio process exited before responding'));
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.stdioTransport?.removeListener('message', onMessage);
        this.stdioTransport?.removeListener('close', onClose);
      };

      this.stdioTransport!.on('message', onMessage);
      this.stdioTransport!.on('close', onClose);
      this.stdioTransport!.send(request);
    });
  }
}

// ---------------------------------------------------------------------------
// Connection Pool - Reuse MCP client instances
// ---------------------------------------------------------------------------

const pool = new Map<string, { client: MCPClient; lastUsed: number }>();

const POOL_TTL_MS = 5 * 60 * 1000; // 5 minutes idle timeout

/**
 * Get or create an MCP client from the connection pool.
 * Automatically connects if not already connected.
 */
export async function getPooledClient(config: MCPConnectionConfig): Promise<MCPClient> {
  const existing = pool.get(config.providerId);

  if (existing && existing.client.connected) {
    existing.lastUsed = Date.now();
    return existing.client;
  }

  // Clean up stale entry if any
  if (existing) {
    await existing.client.disconnect().catch(() => {});
    pool.delete(config.providerId);
  }

  const client = new MCPClient(config);
  await client.connect();

  pool.set(config.providerId, { client, lastUsed: Date.now() });
  return client;
}

/**
 * Disconnect and remove a specific client from the pool.
 */
export async function releasePooledClient(providerId: string): Promise<void> {
  const entry = pool.get(providerId);
  if (entry) {
    await entry.client.disconnect().catch(() => {});
    pool.delete(providerId);
  }
}

/**
 * Clean up idle connections in the pool.
 * Called periodically or on-demand.
 */
export function cleanPool(): void {
  const now = Date.now();
  pool.forEach((entry, id) => {
    if (now - entry.lastUsed > POOL_TTL_MS) {
      entry.client.disconnect().catch(() => {});
      pool.delete(id);
    }
  });
}

// Run pool cleanup every 2 minutes
if (typeof globalThis !== 'undefined') {
  const interval = setInterval(cleanPool, 2 * 60 * 1000);
  if (interval.unref) interval.unref(); // Don't keep process alive for cleanup
}
