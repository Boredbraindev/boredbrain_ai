import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { bettingOrder } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { cancelOrder } from '@/lib/betting/matching-engine';

// ─── GET /api/markets/[marketId]/orders ─────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  try {
    const { marketId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // open, partial, filled, cancelled, or null for all
    const wallet = searchParams.get('wallet');
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    try {
      const conditions = [eq(bettingOrder.marketId, marketId)];

      if (status) {
        conditions.push(eq(bettingOrder.status, status));
      }
      if (wallet) {
        conditions.push(eq(bettingOrder.userAddress, wallet));
      }

      const dbPromise = db
        .select()
        .from(bettingOrder)
        .where(and(...conditions))
        .orderBy(desc(bettingOrder.createdAt))
        .limit(limit);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      const orders = await Promise.race([dbPromise, timeout]);

      return apiSuccess({
        orders,
        total: orders.length,
      });
    } catch {
      // Fallback mock
      return apiSuccess({
        orders: [],
        total: 0,
        _source: 'mock',
      });
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch orders', 500);
  }
}

// ─── DELETE /api/markets/[marketId]/orders — Cancel an order ────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  try {
    await params; // consume params even if not needed for cancel
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const body = parsed.data as { orderId: string; userAddress: string };

    if (!body.orderId) return apiError('orderId is required');
    if (!body.userAddress) return apiError('userAddress is required');

    try {
      const cancelled = await cancelOrder(body.orderId, body.userAddress);

      return apiSuccess({
        cancelled,
        orderId: body.orderId,
      });
    } catch (err: any) {
      return apiError(err.message, 400);
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to cancel order', 500);
  }
}
