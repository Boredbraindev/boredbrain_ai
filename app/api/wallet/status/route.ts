export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/wallet/status?address=0x...
 *
 * Returns wallet status including:
 * - Whether the wallet has a registered (non-fleet) agent
 * - Agent details if one exists
 * - Subscription tier
 * - BBAI/BP balance
 */
export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return apiError('Valid Ethereum address required (address query param)', 400);
    }

    const sql = neon(process.env.DATABASE_URL!);

    const timeout = <T>(promise: Promise<T>) =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
      ]);

    // Run all queries in parallel
    const [agentRows, pointsRows, subscriptionRows] = await timeout(
      Promise.all([
        // 1. Check for non-fleet agent owned by this wallet
        sql`
          SELECT id, name, status, specialization, staking_amount, registered_at
          FROM external_agent
          WHERE owner_address = ${address}
            AND owner_address != 'platform-fleet'
          ORDER BY registered_at DESC
          LIMIT 1
        `,

        // 2. Get BBAI/BP balance from user_points
        sql`
          SELECT total_bp, level, streak_days
          FROM user_points
          WHERE wallet_address = ${address}
          LIMIT 1
        `,

        // 3. Check subscription tier (look for active subscription via user table)
        sql`
          SELECT s.status, s."recurringInterval", s.amount
          FROM subscription s
          JOIN "user" u ON u.id = s."customerId"
          WHERE u.wallet_address = ${address}
            AND s.status = 'active'
          ORDER BY s."currentPeriodEnd" DESC
          LIMIT 1
        `,
      ]),
    );

    const hasAgent = agentRows.length > 0;
    const agent = hasAgent ? agentRows[0] : null;

    const points = pointsRows.length > 0 ? pointsRows[0] : null;
    const bbaiBalance = points ? Number(points.total_bp) : 0;

    // Determine tier from subscription
    const sub = subscriptionRows.length > 0 ? subscriptionRows[0] : null;
    const tier: 'basic' | 'pro' = sub ? 'pro' : 'basic';

    return apiSuccess({
      connected: true,
      hasAgent,
      agentId: agent?.id ?? null,
      agentName: agent?.name ?? null,
      agentStatus: agent?.status ?? null,
      tier,
      canViewOpinions: tier === 'pro' || hasAgent,
      canStake: hasAgent,
      bbaiBalance,
      level: points ? Number(points.level) : 1,
      streakDays: points ? Number(points.streak_days) : 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch wallet status';
    console.error('[wallet/status]', message);
    // Return a graceful fallback instead of 500
    return apiSuccess({
      connected: true,
      hasAgent: false,
      agentId: null,
      agentName: null,
      agentStatus: null,
      tier: 'basic' as const,
      canViewOpinions: false,
      canStake: false,
      bbaiBalance: 0,
      level: 1,
      streakDays: 0,
      _error: message,
    });
  }
}
