export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

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
      const sql = neon(process.env.DATABASE_URL!);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      let ordersPromise;
      if (status && wallet) {
        ordersPromise = sql`
          SELECT * FROM betting_order
          WHERE market_id = ${marketId} AND status = ${status} AND user_address = ${wallet}
          ORDER BY created_at DESC LIMIT ${limit}
        `;
      } else if (status) {
        ordersPromise = sql`
          SELECT * FROM betting_order
          WHERE market_id = ${marketId} AND status = ${status}
          ORDER BY created_at DESC LIMIT ${limit}
        `;
      } else if (wallet) {
        ordersPromise = sql`
          SELECT * FROM betting_order
          WHERE market_id = ${marketId} AND user_address = ${wallet}
          ORDER BY created_at DESC LIMIT ${limit}
        `;
      } else {
        ordersPromise = sql`
          SELECT * FROM betting_order
          WHERE market_id = ${marketId}
          ORDER BY created_at DESC LIMIT ${limit}
        `;
      }

      const orders = await Promise.race([ordersPromise, timeout]);

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
      const sql = neon(process.env.DATABASE_URL!);

      // Inline cancelOrder logic (was from matching-engine which uses Drizzle)
      const orderRows = await sql`
        SELECT * FROM betting_order WHERE id = ${body.orderId} LIMIT 1
      `;

      if (!orderRows.length) {
        return apiError('Order not found', 400);
      }

      const order = orderRows[0];
      if (order.user_address !== body.userAddress) {
        return apiError('Not authorized', 400);
      }
      if (order.status !== 'open' && order.status !== 'partial') {
        return apiError('Order cannot be cancelled', 400);
      }

      await sql`
        UPDATE betting_order SET status = 'cancelled', updated_at = now() WHERE id = ${body.orderId}
      `;

      return apiSuccess({
        cancelled: true,
        orderId: body.orderId,
      });
    } catch (err: any) {
      return apiError(err.message, 400);
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to cancel order', 500);
  }
}
