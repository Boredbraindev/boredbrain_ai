import { NextRequest } from 'next/server';
import {
  processToolPayment,
  processAgentInvocation,
  processPromptPurchase,
  processArenaEntry,
  processStaking,
  type PaymentType,
  type ChainId,
} from '@/lib/payment-pipeline';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  type Schema,
} from '@/lib/api-utils';

const VALID_PAYMENT_TYPES = ['tool_call', 'agent_invoke', 'prompt_purchase', 'arena_entry', 'staking'] as const;
const VALID_CHAINS = ['base', 'bsc', 'apechain', 'arbitrum'] as const;

const paymentSchema: Schema = {
  type: { type: 'string', required: true, enum: VALID_PAYMENT_TYPES },
  fromAgentId: { type: 'string', required: true, maxLength: 100 },
  toAgentId: { type: 'string', required: false, maxLength: 100 },
  amount: { type: 'number', required: false, min: 0.000001, max: 10_000_000 },
  chain: { type: 'string', required: false, enum: VALID_CHAINS },
  toolName: { type: 'string', required: false, maxLength: 200 },
  promptId: { type: 'string', required: false, maxLength: 100 },
  matchId: { type: 'string', required: false, maxLength: 100 },
};

/**
 * POST /api/payments/process - Process a new payment.
 */
export async function POST(request: NextRequest) {
  // Safe JSON parse
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data as Record<string, unknown>;

  // Schema validation
  const { valid, errors, sanitized } = validateBody(body, paymentSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const paymentType = sanitized.type as PaymentType;
  const fromAgentId = sanitized.fromAgentId as string;
  const chain = (sanitized.chain as ChainId) || 'base';

  // Sanitize tools array if present
  const rawTools = Array.isArray(body.tools) ? body.tools : [];
  const tools = rawTools
    .filter((t): t is string => typeof t === 'string')
    .map((t) => sanitizeString(t, 100))
    .filter((t) => t.length > 0)
    .slice(0, 20);

  try {
    switch (paymentType) {
      case 'tool_call': {
        const toolName = sanitized.toolName as string | undefined;
        if (!toolName) {
          return apiError('toolName is required for tool_call payments', 400);
        }
        const tx = await processToolPayment(fromAgentId, toolName, chain);
        return apiSuccess({ transaction: tx });
      }

      case 'agent_invoke': {
        const toAgentId = sanitized.toAgentId as string | undefined;
        if (!toAgentId) {
          return apiError('toAgentId is required for agent_invoke payments', 400);
        }
        const invokeTools = tools.length > 0 ? tools : ['web_search'];
        const tx = await processAgentInvocation(fromAgentId, toAgentId, invokeTools, chain);
        return apiSuccess({ transaction: tx });
      }

      case 'prompt_purchase': {
        const amount = sanitized.amount as number | undefined;
        if (!amount || amount <= 0) {
          return apiError('A positive amount is required for prompt_purchase', 400);
        }
        const promptId = sanitizeString(sanitized.promptId ?? `prompt_${Date.now().toString(36)}`, 100);
        const tx = await processPromptPurchase(fromAgentId, promptId, amount, chain);
        return apiSuccess({ transaction: tx });
      }

      case 'arena_entry': {
        const amount = sanitized.amount as number | undefined;
        if (!amount || amount <= 0) {
          return apiError('A positive amount is required for arena_entry', 400);
        }
        const matchId = sanitizeString(sanitized.matchId ?? `match_${Date.now().toString(36)}`, 100);
        const tx = await processArenaEntry(fromAgentId, matchId, amount, chain);
        return apiSuccess({ transaction: tx });
      }

      case 'staking': {
        const amount = sanitized.amount as number | undefined;
        if (!amount || amount <= 0) {
          return apiError('A positive amount is required for staking', 400);
        }
        const tx = await processStaking(fromAgentId, amount, chain);
        return apiSuccess({ transaction: tx });
      }

      default:
        return apiError(`Unknown payment type: ${paymentType}`, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment processing failed';
    return apiError(message, 500);
  }
}
