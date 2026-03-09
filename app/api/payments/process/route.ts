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
  processToolPayment as onChainToolPayment,
  stakeForRegistration as onChainStake,
  verifyTransaction,
  getTokenBalance,
} from '@/lib/blockchain/payment-service';
import { isOnChainEnabled } from '@/lib/blockchain/config';
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
const VALID_MODES = ['onchain', 'offchain', 'auto'] as const;

const paymentSchema: Schema = {
  type: { type: 'string', required: true, enum: VALID_PAYMENT_TYPES },
  fromAgentId: { type: 'string', required: true, maxLength: 100 },
  toAgentId: { type: 'string', required: false, maxLength: 100 },
  amount: { type: 'number', required: false, min: 0.000001, max: 10_000_000 },
  chain: { type: 'string', required: false, enum: VALID_CHAINS },
  toolName: { type: 'string', required: false, maxLength: 200 },
  promptId: { type: 'string', required: false, maxLength: 100 },
  matchId: { type: 'string', required: false, maxLength: 100 },
  mode: { type: 'string', required: false, enum: VALID_MODES },
  txHash: { type: 'string', required: false, maxLength: 66 },
  walletAddress: { type: 'string', required: false, maxLength: 42 },
};

/**
 * Determine whether this request should use the on-chain path.
 * "auto" (default) uses on-chain when a contract is deployed, otherwise off-chain.
 */
function shouldUseOnChain(mode: string): boolean {
  if (mode === 'onchain') return true;
  if (mode === 'offchain') return false;
  // "auto" -- use on-chain when a contract address is configured
  return isOnChainEnabled();
}

/**
 * POST /api/payments/process - Process a new payment.
 *
 * Supports both on-chain (USDT token contract on Base) and off-chain
 * (simulated wallet) payment modes.
 *
 * Additional fields for on-chain payments:
 *   mode: "onchain" | "offchain" | "auto"  (default: "auto")
 *   txHash: string  -- for payment verification of a previously broadcast tx
 *   walletAddress: string  -- the on-chain wallet address of the payer
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
  const mode = (sanitized.mode as string) || 'auto';
  const txHash = sanitized.txHash as string | undefined;
  const walletAddress = sanitized.walletAddress as string | undefined;

  // Sanitize tools array if present
  const rawTools = Array.isArray(body.tools) ? body.tools : [];
  const tools = rawTools
    .filter((t): t is string => typeof t === 'string')
    .map((t) => sanitizeString(t, 100))
    .filter((t) => t.length > 0)
    .slice(0, 20);

  // -----------------------------------------------------------------------
  // If a txHash is provided, verify the transaction on-chain
  // -----------------------------------------------------------------------
  if (txHash) {
    try {
      const verification = await verifyTransaction(txHash);
      return apiSuccess({
        verification,
        txHash,
        message: verification.confirmed
          ? 'Transaction confirmed on-chain'
          : `Transaction status: ${verification.status}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      return apiError(message, 500);
    }
  }

  // -----------------------------------------------------------------------
  // On-chain payment path
  // -----------------------------------------------------------------------
  if (shouldUseOnChain(mode)) {
    const payerAddress = walletAddress || fromAgentId;

    try {
      switch (paymentType) {
        case 'tool_call': {
          const toolName = sanitized.toolName as string | undefined;
          if (!toolName) {
            return apiError('toolName is required for tool_call payments', 400);
          }

          // Check on-chain balance first
          const balance = await getTokenBalance(payerAddress);

          const result = await onChainToolPayment(
            payerAddress,
            sanitized.toAgentId as string || '0x0000000000000000000000000000000000000000',
            balance.balance, // amount is determined by tool pricing in the pipeline
            toolName,
          );

          if (!result.success) {
            return apiError(result.error || 'On-chain tool payment failed', 400);
          }

          // Also record in the off-chain ledger for consistency
          const offChainTx = await processToolPayment(fromAgentId, toolName, chain);

          return apiSuccess({
            transaction: offChainTx,
            onChain: {
              txHash: result.txHash,
              blockNumber: result.blockNumber,
              platformFee: result.platformFee,
              providerAmount: result.providerAmount,
              isSimulated: result.isSimulated,
              chain: result.chain,
            },
          });
        }

        case 'staking': {
          const amount = sanitized.amount as number | undefined;
          if (!amount || amount <= 0) {
            return apiError('A positive amount is required for staking', 400);
          }

          const result = await onChainStake(payerAddress, amount);

          if (!result.success) {
            return apiError(result.error || 'On-chain staking failed', 400);
          }

          // Also record in the off-chain ledger
          const offChainTx = await processStaking(fromAgentId, amount, chain);

          return apiSuccess({
            transaction: offChainTx,
            onChain: {
              txHash: result.txHash,
              blockNumber: result.blockNumber,
              lockUntil: result.lockUntil,
              isSimulated: result.isSimulated,
              chain: result.chain,
            },
          });
        }

        // For other payment types, fall through to off-chain with on-chain
        // balance check
        case 'agent_invoke':
        case 'prompt_purchase':
        case 'arena_entry': {
          // Verify on-chain balance before processing off-chain
          const balanceCheck = await getTokenBalance(payerAddress);

          const requiredAmount = sanitized.amount as number | undefined;
          if (requiredAmount && balanceCheck.balance < requiredAmount) {
            return apiError(
              `Insufficient on-chain USDT balance: ${balanceCheck.balance} < ${requiredAmount}`,
              400,
            );
          }

          // Process through off-chain pipeline (on-chain settlement for these
          // types will be added when the PaymentRouter contract supports them)
          break; // fall through to off-chain processing below
        }

        default:
          return apiError(`Unknown payment type: ${paymentType}`, 400);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'On-chain payment failed';
      return apiError(message, 500);
    }
  }

  // -----------------------------------------------------------------------
  // Off-chain / simulated payment path (existing logic)
  // -----------------------------------------------------------------------
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
