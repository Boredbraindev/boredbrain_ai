import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/agent-api/auth';
import { getTool, hasTool, getToolNames } from '@/lib/agent-api/tool-registry';
import { v4 as uuidv4 } from 'uuid';

/**
 * A2A (Agent-to-Agent) Protocol Endpoint
 * JSON-RPC 2.0 compatible
 *
 * Supports methods:
 * - tasks/send: Execute a tool (create a task)
 * - tasks/get: Get task status/result
 * - agent/capabilities: List available capabilities
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (authResult.error) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32001, message: authResult.body.error }, id: null },
      { status: authResult.status }
    );
  }

  let rpcRequest: {
    jsonrpc: string;
    method: string;
    params: any;
    id: string | number;
  };

  try {
    rpcRequest = await request.json();
  } catch {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null,
    });
  }

  if (rpcRequest.jsonrpc !== '2.0') {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
      id: rpcRequest.id,
    });
  }

  switch (rpcRequest.method) {
    case 'tasks/send': {
      const { skill, input } = rpcRequest.params || {};

      if (!skill || !hasTool(skill)) {
        return NextResponse.json({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Unknown skill: ${skill}. Available: ${getToolNames().join(', ')}`,
          },
          id: rpcRequest.id,
        });
      }

      const toolMeta = getTool(skill)!;
      const taskId = uuidv4();

      try {
        const result = await toolMeta.tool.execute(input || {});

        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            id: taskId,
            status: {
              state: 'completed',
            },
            artifacts: [
              {
                name: `${skill}_result`,
                parts: [
                  {
                    type: 'data',
                    data: result,
                  },
                ],
              },
            ],
            metadata: {
              cost: toolMeta.pricePerCall,
              costUnit: 'BBAI',
            },
          },
          id: rpcRequest.id,
        });
      } catch (error) {
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            id: taskId,
            status: {
              state: 'failed',
              message: error instanceof Error ? error.message : 'Execution failed',
            },
          },
          id: rpcRequest.id,
        });
      }
    }

    case 'agent/capabilities': {
      return NextResponse.json({
        jsonrpc: '2.0',
        result: {
          skills: getToolNames(),
          streaming: true,
          batchExecution: true,
          payment: {
            token: 'BBAI',
            chains: [8453, 56],
          },
        },
        id: rpcRequest.id,
      });
    }

    default:
      return NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${rpcRequest.method}` },
        id: rpcRequest.id,
      });
  }
}
