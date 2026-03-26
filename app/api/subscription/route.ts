export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, isValidEthAddress } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';
import { verifyUsdtPayment, verifyBnbPayment } from '@/lib/blockchain/verify-payment';
import { PLATFORM_WALLET, PRO_SUBSCRIPTION_PRICE_USD } from '@/lib/blockchain/bsc-mainnet';

const PRO_AGENT_SLOTS = 5;
const PRO_PRICE_USD = PRO_SUBSCRIPTION_PRICE_USD; // 10 USDT

// ---------------------------------------------------------------------------
// GET /api/subscription?wallet=0x...
// Returns subscription status for a wallet address
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet || !isValidEthAddress(wallet)) {
      return apiError('Valid wallet address required', 400);
    }

    const sql = neon(process.env.DATABASE_URL!);
    const walletLower = wallet.toLowerCase();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const rows = await Promise.race([
      sql`
        SELECT id, wallet_address, tier, agent_slots, tx_hash, chain, amount_paid, expires_at, created_at, updated_at
        FROM user_subscription
        WHERE LOWER(wallet_address) = ${walletLower}
        LIMIT 1
      `,
      timeout,
    ]);

    if (!rows || rows.length === 0) {
      return apiSuccess({
        tier: 'basic',
        agentSlots: 1,
        expiresAt: null,
        isActive: false,
      });
    }

    const sub = rows[0];
    const now = new Date();
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    const isActive = sub.tier === 'pro' && (!expiresAt || expiresAt > now);

    return apiSuccess({
      tier: isActive ? 'pro' : 'basic',
      agentSlots: isActive ? sub.agent_slots : 1,
      expiresAt: sub.expires_at,
      isActive,
      txHash: sub.tx_hash,
      chain: sub.chain,
      amountPaid: sub.amount_paid,
      createdAt: sub.created_at,
    });
  } catch (err) {
    console.error('[subscription GET]', err);
    return apiError('Failed to fetch subscription status', 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/subscription
// Body: { walletAddress, txHash, chain?, tier?, amount?, paymentToken?, minBnbWei? }
// Records a new Pro subscription in user_subscription after onchain confirmation.
// This is the single source of truth — frontend calls this after the smart
// contract tx succeeds so that lib/subscription.ts (getSubscriptionTier) and
// GET /api/subscription return consistent data.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, txHash, chain, tier, amount } = body as {
      walletAddress?: string;
      txHash?: string;
      chain?: string;
      tier?: string;
      amount?: number;
    };

    // ── Input validation ──
    if (!walletAddress || !isValidEthAddress(walletAddress)) {
      return apiError('Valid walletAddress required', 400);
    }

    if (!txHash || typeof txHash !== 'string' || txHash.length < 10) {
      return apiError('Valid txHash required', 400);
    }

    const sql = neon(process.env.DATABASE_URL!);
    const walletLower = walletAddress.toLowerCase();
    const paymentChain = (chain && typeof chain === 'string') ? chain.toLowerCase() : 'bsc';
    const subscriptionTier = (tier === 'pro' || tier === 'basic') ? tier : 'pro';
    const agentSlots = subscriptionTier === 'pro' ? PRO_AGENT_SLOTS : 1;
    const amountPaid = typeof amount === 'number' && amount > 0 ? amount : PRO_PRICE_USD;

    // ── Onchain payment verification via BSC RPC ──
    // Skip verification only if platform wallet is not configured (dev mode)
    const skipVerification = PLATFORM_WALLET === '0x0000000000000000000000000000000000000000';

    if (!skipVerification) {
      const paymentToken = (body as { paymentToken?: string }).paymentToken || 'usdt';

      if (paymentToken === 'usdt') {
        const usdtResult = await verifyUsdtPayment(txHash.trim());
        if (!usdtResult.valid) {
          return apiError('Payment verification failed', 400);
        }
        if (usdtResult.from && usdtResult.from.toLowerCase() !== walletLower) {
          return apiError('Payment sender does not match subscription wallet', 400);
        }
      } else if (paymentToken === 'bnb') {
        const minBnbWei = (body as { minBnbWei?: string }).minBnbWei;
        if (!minBnbWei) {
          return apiError('minBnbWei required for BNB payments', 400);
        }
        const bnbResult = await verifyBnbPayment(txHash.trim(), minBnbWei);
        if (!bnbResult.valid) {
          return apiError(`BNB payment verification failed: ${bnbResult.error}`, 400);
        }
        if (bnbResult.from && bnbResult.from.toLowerCase() !== walletLower) {
          return apiError(
            `Payment sender ${bnbResult.from} does not match subscription wallet ${walletLower}`,
            400,
          );
        }
      } else {
        return apiError('Invalid paymentToken. Use "usdt" or "bnb"', 400);
      }
    }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    // ── Duplicate txHash guard ──
    const existingTx = await Promise.race([
      sql`SELECT id FROM user_subscription WHERE tx_hash = ${txHash.trim()} LIMIT 1`,
      timeout,
    ]);

    if (existingTx && existingTx.length > 0) {
      return apiError('This transaction has already been used', 409);
    }

    // ── Calculate expiry: 30 days from now (monthly subscription) ──
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // ── Upsert: update existing row or insert new one ──
    // (Neon HTTP driver doesn't support transactions; use sequential queries)
    const existing = await Promise.race([
      sql`SELECT id, expires_at FROM user_subscription WHERE LOWER(wallet_address) = ${walletLower} LIMIT 1`,
      timeout,
    ]);

    if (existing && existing.length > 0) {
      // If the existing subscription hasn't expired yet, extend from its
      // current expiry date rather than from now (stacking).
      const currentExpiry = existing[0].expires_at ? new Date(existing[0].expires_at) : null;
      const now = new Date();
      if (currentExpiry && currentExpiry > now) {
        expiresAt.setTime(currentExpiry.getTime());
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      await Promise.race([
        sql`
          UPDATE user_subscription
          SET tier = ${subscriptionTier},
              agent_slots = ${agentSlots},
              tx_hash = ${txHash.trim()},
              chain = ${paymentChain},
              amount_paid = ${amountPaid},
              expires_at = ${expiresAt.toISOString()},
              updated_at = NOW()
          WHERE LOWER(wallet_address) = ${walletLower}
        `,
        timeout,
      ]);
    } else {
      await Promise.race([
        sql`
          INSERT INTO user_subscription (id, wallet_address, tier, agent_slots, tx_hash, chain, amount_paid, expires_at, created_at, updated_at)
          VALUES (
            gen_random_uuid()::text,
            ${walletLower},
            ${subscriptionTier},
            ${agentSlots},
            ${txHash.trim()},
            ${paymentChain},
            ${amountPaid},
            ${expiresAt.toISOString()},
            NOW(),
            NOW()
          )
        `,
        timeout,
      ]);
    }

    return apiSuccess({
      tier: subscriptionTier,
      agentSlots,
      expiresAt: expiresAt.toISOString(),
      txHash: txHash.trim(),
      chain: paymentChain,
      status: 'active',
      message: 'Subscription activated! You now have Pro access.',
    });
  } catch (err) {
    console.error('[subscription POST]', err);
    return apiError('Failed to process subscription', 500);
  }
}
