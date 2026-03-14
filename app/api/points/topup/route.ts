export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * /api/points/topup
 *
 * GET  — Deposit info + BP rates
 * POST — Submit USDT tx hash for on-chain verification → BP credit
 *
 * Flow:
 * 1. User sends USDT (BEP-20) to platform wallet on BSC
 * 2. User submits tx hash here
 * 3. Backend verifies the tx on BSC RPC
 * 4. BP credited based on deposit amount ($1 = 100 BP, with bonus tiers)
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { BP_RATES, calculateBpFromUsdt, PLATFORM_DEPOSIT_ADDRESS } from '@/lib/bp-packages';
import { db } from '@/lib/db';
import { bpPurchase } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { awardPoints } from '@/lib/points';

// ---------------------------------------------------------------------------
// GET /api/points/topup — Deposit info + BP rates
// ---------------------------------------------------------------------------

export async function GET() {
  return apiSuccess({
    depositAddress: PLATFORM_DEPOSIT_ADDRESS,
    network: 'BNB Smart Chain (BEP-20)',
    token: 'USDT',
    minimumDeposit: '1 USDT',
    rates: BP_RATES.map((r) => ({
      range: r.maxUsdt ? `$${r.minUsdt} – $${r.maxUsdt}` : `$${r.minUsdt}+`,
      bpPerUsdt: r.bpPerUsdt,
      bonusPercent: r.bonusPercent,
    })),
    note: 'Send USDT (BEP-20) to the deposit address, then submit the tx hash to receive BP.',
  });
}

// ---------------------------------------------------------------------------
// POST /api/points/topup — Submit tx hash for verification
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Auth: require logged-in user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return apiError('Authentication required', 401);
    }

    const parsed = await parseJsonBody<{
      txHash: string;
      walletAddress: string;
    }>(request);
    if ('error' in parsed) return parsed.error;

    const { txHash, walletAddress } = parsed.data;

    if (!txHash || !walletAddress) {
      return apiError('txHash and walletAddress are required');
    }

    // Validate tx hash format (0x + 64 hex chars)
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return apiError('Invalid transaction hash format');
    }

    // Check if this tx hash was already processed
    const [existing] = await db
      .select()
      .from(bpPurchase)
      .where(eq(bpPurchase.polarOrderId, txHash));

    if (existing) {
      if (existing.status === 'completed') {
        return apiError('This transaction has already been processed');
      }
      return apiSuccess({
        status: 'pending',
        message: 'This transaction is already being verified',
        purchaseId: existing.id,
      });
    }

    // Verify the transaction on BSC
    const verification = await verifyBscUsdtTransfer(txHash);

    if (!verification.valid) {
      return apiError(verification.error || 'Transaction verification failed');
    }

    // Check the tx was sent to our deposit address
    if (verification.to?.toLowerCase() !== PLATFORM_DEPOSIT_ADDRESS.toLowerCase()) {
      return apiError('Transaction was not sent to the platform deposit address');
    }

    // Calculate BP from USDT amount
    const usdtAmount = verification.usdtAmount;
    const { bp, bonusPercent, tier } = calculateBpFromUsdt(usdtAmount);

    // Create purchase record and mark as completed
    const [purchase] = await db
      .insert(bpPurchase)
      .values({
        userId: session.user.id,
        walletAddress,
        packageId: tier,
        bpAmount: bp,
        usdAmount: Math.round(usdtAmount * 100),
        polarOrderId: txHash, // stores BSC tx hash
        status: 'completed',
        completedAt: new Date(),
      })
      .returning();

    // Credit BP to user
    await awardPoints(walletAddress, 'bp_topup', purchase.id, bp);

    return apiSuccess({
      status: 'completed',
      purchaseId: purchase.id,
      usdtDeposited: usdtAmount,
      bpCredited: bp,
      bonusPercent,
      tier,
      message: `${bp.toLocaleString()} BP credited to your account!`,
    });
  } catch (err) {
    console.error('[api/points/topup] POST error:', err);
    return apiError('Failed to process deposit', 500);
  }
}

// ---------------------------------------------------------------------------
// BSC USDT Transfer Verification
// ---------------------------------------------------------------------------

interface TxVerification {
  valid: boolean;
  error?: string;
  to?: string;
  from?: string;
  usdtAmount: number;
}

// BSC USDT (BEP-20) contract address
const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';
// ERC-20 Transfer event topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function verifyBscUsdtTransfer(txHash: string): Promise<TxVerification> {
  const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';

  try {
    // Fetch transaction receipt from BSC
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    const receipt = data.result;

    if (!receipt) {
      return { valid: false, error: 'Transaction not found or still pending. Try again in a few minutes.', usdtAmount: 0 };
    }

    // Check tx succeeded
    if (receipt.status !== '0x1') {
      return { valid: false, error: 'Transaction failed on-chain', usdtAmount: 0 };
    }

    // Find USDT Transfer event in logs
    const usdtLog = receipt.logs?.find(
      (log: any) =>
        log.address?.toLowerCase() === BSC_USDT.toLowerCase() &&
        log.topics?.[0] === TRANSFER_TOPIC,
    );

    if (!usdtLog) {
      return { valid: false, error: 'No USDT transfer found in this transaction', usdtAmount: 0 };
    }

    // Decode: topics[1]=from, topics[2]=to, data=amount
    const from = '0x' + usdtLog.topics[1].slice(26);
    const to = '0x' + usdtLog.topics[2].slice(26);
    const rawAmount = BigInt(usdtLog.data);
    // BSC USDT has 18 decimals
    const usdtAmount = Number(rawAmount) / 1e18;

    if (usdtAmount < 1) {
      return { valid: false, error: 'Minimum deposit is 1 USDT', usdtAmount };
    }

    return { valid: true, to, from, usdtAmount };
  } catch (err) {
    console.error('[verifyBscUsdtTransfer]', err);
    return { valid: false, error: 'Failed to verify transaction. Please try again.', usdtAmount: 0 };
  }
}
