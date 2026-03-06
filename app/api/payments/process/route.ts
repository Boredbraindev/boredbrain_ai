import { NextRequest, NextResponse } from 'next/server';
import {
  processToolPayment,
  processAgentInvocation,
  processPromptPurchase,
  processArenaEntry,
  processStaking,
  type PaymentType,
  type ChainId,
} from '@/lib/payment-pipeline';

/**
 * POST /api/payments/process - Process a new payment.
 *
 * Body:
 *   {
 *     type: 'tool_call' | 'agent_invoke' | 'prompt_purchase' | 'arena_entry' | 'staking',
 *     fromAgentId: string,
 *     toAgentId?: string,       // required for agent_invoke
 *     amount?: number,          // required for prompt_purchase, arena_entry, staking
 *     chain?: 'base' | 'bsc' | 'apechain' | 'arbitrum',
 *     toolName?: string,        // required for tool_call
 *     tools?: string[],         // required for agent_invoke
 *     promptId?: string,        // for prompt_purchase
 *     matchId?: string,         // for arena_entry
 *   }
 */
export async function POST(request: NextRequest) {
  let body: {
    type: PaymentType;
    fromAgentId: string;
    toAgentId?: string;
    amount?: number;
    chain?: ChainId;
    toolName?: string;
    tools?: string[];
    promptId?: string;
    matchId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.type || !body.fromAgentId) {
    return NextResponse.json(
      { error: 'type and fromAgentId are required' },
      { status: 400 },
    );
  }

  const chain = body.chain || 'base';

  try {
    switch (body.type) {
      case 'tool_call': {
        if (!body.toolName) {
          return NextResponse.json(
            { error: 'toolName is required for tool_call payments' },
            { status: 400 },
          );
        }
        const tx = await processToolPayment(body.fromAgentId, body.toolName, chain);
        return NextResponse.json({ transaction: tx });
      }

      case 'agent_invoke': {
        if (!body.toAgentId) {
          return NextResponse.json(
            { error: 'toAgentId is required for agent_invoke payments' },
            { status: 400 },
          );
        }
        const tools = body.tools || ['web_search'];
        const tx = await processAgentInvocation(body.fromAgentId, body.toAgentId, tools, chain);
        return NextResponse.json({ transaction: tx });
      }

      case 'prompt_purchase': {
        if (!body.amount || body.amount <= 0) {
          return NextResponse.json(
            { error: 'A positive amount is required for prompt_purchase' },
            { status: 400 },
          );
        }
        const promptId = body.promptId || `prompt_${Date.now().toString(36)}`;
        const tx = await processPromptPurchase(body.fromAgentId, promptId, body.amount, chain);
        return NextResponse.json({ transaction: tx });
      }

      case 'arena_entry': {
        if (!body.amount || body.amount <= 0) {
          return NextResponse.json(
            { error: 'A positive amount is required for arena_entry' },
            { status: 400 },
          );
        }
        const matchId = body.matchId || `match_${Date.now().toString(36)}`;
        const tx = await processArenaEntry(body.fromAgentId, matchId, body.amount, chain);
        return NextResponse.json({ transaction: tx });
      }

      case 'staking': {
        if (!body.amount || body.amount <= 0) {
          return NextResponse.json(
            { error: 'A positive amount is required for staking' },
            { status: 400 },
          );
        }
        const tx = await processStaking(body.fromAgentId, body.amount, chain);
        return NextResponse.json({ transaction: tx });
      }

      default:
        return NextResponse.json(
          { error: `Unknown payment type: ${body.type}` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
