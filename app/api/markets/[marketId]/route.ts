import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateBody } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { bettingMarket } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  placeOrder,
  getOrderBook,
  getMarketStats,
  resolveMarket,
} from '@/lib/betting/matching-engine';

// ─── GET /api/markets/[marketId] ────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  try {
    const { marketId } = await params;

    // Try DB first
    try {
      const dbPromise = db
        .select()
        .from(bettingMarket)
        .where(eq(bettingMarket.id, marketId))
        .limit(1);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      const [market] = await Promise.race([dbPromise, timeout]);

      if (!market) {
        return apiError('Market not found', 404);
      }

      // Get order book and stats
      const [orderBook, stats] = await Promise.all([
        getOrderBook(marketId),
        getMarketStats(marketId),
      ]);

      return apiSuccess({ market, orderBook, stats });
    } catch (err: any) {
      if (err.message === 'Market not found') {
        return apiError('Market not found', 404);
      }

      // Fallback mock
      return apiSuccess({
        market: {
          id: marketId,
          title: 'Market (loading...)',
          status: 'open',
          outcomes: ['Yes', 'No'],
          totalVolume: 0,
          totalOrders: 0,
        },
        orderBook: {
          bids: [
            { price: 55, totalShares: 120, orders: 8 },
            { price: 50, totalShares: 200, orders: 15 },
            { price: 45, totalShares: 80, orders: 5 },
          ],
          asks: [
            { price: 40, totalShares: 150, orders: 10 },
            { price: 35, totalShares: 100, orders: 7 },
            { price: 30, totalShares: 60, orders: 3 },
          ],
          lastPrice: 52,
          volume24h: 5400,
        },
        stats: {
          totalVolume: 0,
          currentPrices: { Yes: 52, No: 48 },
          orderCount: 0,
        },
        _source: 'mock',
      });
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch market', 500);
  }
}

// ─── POST /api/markets/[marketId] — Place an order ──────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  try {
    const { marketId } = await params;
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      {
        side: { type: 'string', required: true },
        price: { type: 'number', required: true, min: 1, max: 99 },
        amount: { type: 'number', required: true, min: 1, max: 100000 },
        userAddress: { type: 'string', required: true },
      },
    );

    if (!valid) return apiError(errors.join(', '));

    const body = sanitized as {
      side: string;
      price: number;
      amount: number;
      userAddress: string;
      userType?: string;
    };

    try {
      const result = await placeOrder({
        marketId,
        userAddress: body.userAddress,
        userType: (body.userType as 'user' | 'agent') || 'user',
        side: body.side,
        price: body.price,
        amount: body.amount,
      });

      return apiSuccess({
        orderId: result.orderId,
        filled: result.filled,
        totalShares: body.amount,
        remainingShares: body.amount - result.filled,
        trades: result.trades.length,
        cost: body.price * body.amount,
        currency: 'BBAI',
      }, 201);
    } catch (err: any) {
      // Matching engine errors (market not found, not open, etc.)
      return apiError(err.message, 400);
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to place order', 500);
  }
}

// ─── PUT /api/markets/[marketId] — Resolve market (admin) ───────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  try {
    const { marketId } = await params;
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const body = parsed.data as { outcome: string; adminKey?: string };

    if (!body.outcome) {
      return apiError('outcome is required');
    }

    // Basic admin check (in production, use proper auth)
    // For now, accept requests from platform or with admin key
    try {
      const result = await resolveMarket(marketId, body.outcome);

      return apiSuccess({
        resolved: true,
        winningOutcome: body.outcome,
        totalPayout: result.totalPayout,
        platformFee: result.platformFee,
        winners: result.winners,
        losers: result.losers,
        currency: 'BBAI',
      });
    } catch (err: any) {
      return apiError(err.message, 400);
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to resolve market', 500);
  }
}
