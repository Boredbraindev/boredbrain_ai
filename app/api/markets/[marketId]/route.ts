export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateBody } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

// ─── GET /api/markets/[marketId] ────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  try {
    const { marketId } = await params;
    const sql = neon(process.env.DATABASE_URL!);

    // Try DB first
    try {
      const dbPromise = sql`
        SELECT * FROM betting_market WHERE id = ${marketId} LIMIT 1
      `;

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      const markets = await Promise.race([dbPromise, timeout]);
      const market = markets[0];

      if (!market) {
        return apiError('Market not found', 404);
      }

      // Get order book
      const orders = await sql`
        SELECT * FROM betting_order
        WHERE market_id = ${marketId} AND status IN ('open', 'partial')
        ORDER BY price ASC
      `;

      const bidMap = new Map<number, { totalShares: number; orders: number }>();
      const askMap = new Map<number, { totalShares: number; orders: number }>();

      for (const order of orders) {
        const remaining = order.amount - order.filled;
        if (remaining <= 0) continue;
        const isYes = order.side === 'Yes' || order.side === 'YES';
        const map = isYes ? bidMap : askMap;
        const existing = map.get(order.price) || { totalShares: 0, orders: 0 };
        existing.totalShares += remaining;
        existing.orders += 1;
        map.set(order.price, existing);
      }

      const bids = Array.from(bidMap.entries())
        .map(([price, data]) => ({ price, ...data }))
        .sort((a, b) => b.price - a.price);

      const asks = Array.from(askMap.entries())
        .map(([price, data]) => ({ price, ...data }))
        .sort((a, b) => a.price - b.price);

      const lastTradeRows = await sql`
        SELECT * FROM betting_trade
        WHERE market_id = ${marketId}
        ORDER BY created_at DESC LIMIT 1
      `;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const volumeResult = await sql`
        SELECT COALESCE(SUM(bbai_amount), 0) as total FROM betting_trade
        WHERE market_id = ${marketId} AND created_at >= ${twentyFourHoursAgo}::timestamptz
      `;

      const orderBook = {
        bids,
        asks,
        lastPrice: lastTradeRows[0]?.price ?? 50,
        volume24h: Number(volumeResult[0]?.total ?? 0),
      };

      // Get market stats
      const trades = await sql`
        SELECT * FROM betting_trade
        WHERE market_id = ${marketId}
        ORDER BY created_at DESC
      `;

      const currentPrices: Record<string, number> = {};
      const outcomes = market.outcomes as string[];
      for (const outcome of outcomes) {
        const latestTrade = trades.find((t: any) => t.outcome === outcome);
        currentPrices[outcome] = latestTrade?.price ?? 50;
      }

      const stats = {
        totalVolume: market.total_volume,
        currentPrices,
        orderCount: market.total_orders,
      };

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
      const sql = neon(process.env.DATABASE_URL!);

      const normSide = body.side.toUpperCase() === 'YES' ? 'Yes' : body.side.toUpperCase() === 'NO' ? 'No' : body.side;
      const complementarySide = (normSide === 'Yes' || normSide === 'YES') ? 'No' : 'Yes';
      const complementaryPrice = 100 - body.price;

      // Verify market is open
      const [market] = await sql`
        SELECT * FROM betting_market WHERE id = ${marketId} LIMIT 1
      `;
      if (!market) throw new Error('Market not found');
      if (market.status !== 'open') throw new Error('Market is not open for trading');

      // Insert the new order
      const [newOrder] = await sql`
        INSERT INTO betting_order (market_id, user_address, user_type, side, price, amount, filled, status)
        VALUES (${marketId}, ${body.userAddress}, ${(body.userType as string) || 'user'}, ${normSide}, ${body.price}, ${body.amount}, 0, 'open')
        RETURNING *
      `;

      // Find matching counter-orders
      const counterOrders = await sql`
        SELECT * FROM betting_order
        WHERE market_id = ${marketId}
          AND side = ${complementarySide}
          AND price <= ${complementaryPrice}
          AND user_address != ${body.userAddress}
          AND status IN ('open', 'partial')
        ORDER BY price ASC, created_at ASC
      `;

      const trades: any[] = [];
      let remainingAmount = body.amount;
      let totalFilled = 0;

      for (const counter of counterOrders) {
        if (remainingAmount <= 0) break;
        const counterRemaining = counter.amount - counter.filled;
        if (counterRemaining <= 0) continue;

        const matchShares = Math.min(remainingAmount, counterRemaining);
        const tradePrice = body.price;
        const bbaiAmount = matchShares * tradePrice;

        // Create trade record
        const [trade] = await sql`
          INSERT INTO betting_trade (market_id, buy_order_id, sell_order_id, buyer_address, seller_address, outcome, price, shares, bbai_amount)
          VALUES (${marketId}, ${newOrder.id}, ${counter.id}, ${body.userAddress}, ${counter.user_address}, ${normSide}, ${tradePrice}, ${matchShares}, ${bbaiAmount})
          RETURNING *
        `;
        trades.push(trade);

        // Update counter order
        const counterNewFilled = counter.filled + matchShares;
        const counterStatus = counterNewFilled >= counter.amount ? 'filled' : 'partial';
        await sql`
          UPDATE betting_order SET filled = ${counterNewFilled}, status = ${counterStatus}, updated_at = NOW()
          WHERE id = ${counter.id}
        `;

        // Update positions for both parties (upsert)
        await upsertPosition(sql, marketId, body.userAddress, normSide, matchShares, tradePrice);
        await upsertPosition(sql, marketId, counter.user_address, complementarySide, matchShares, counter.price);

        totalFilled += matchShares;
        remainingAmount -= matchShares;
      }

      // Update placed order
      const orderStatus = totalFilled >= body.amount ? 'filled' : totalFilled > 0 ? 'partial' : 'open';
      await sql`
        UPDATE betting_order SET filled = ${totalFilled}, status = ${orderStatus}, updated_at = NOW()
        WHERE id = ${newOrder.id}
      `;

      // Update market volume and order count
      if (trades.length > 0) {
        const tradeVolume = trades.reduce((sum: number, t: any) => sum + t.bbai_amount, 0);
        await sql`
          UPDATE betting_market SET total_volume = total_volume + ${tradeVolume}, total_orders = total_orders + 1, updated_at = NOW()
          WHERE id = ${marketId}
        `;
      } else {
        await sql`
          UPDATE betting_market SET total_orders = total_orders + 1, updated_at = NOW()
          WHERE id = ${marketId}
        `;
      }

      return apiSuccess({
        orderId: newOrder.id,
        filled: totalFilled,
        totalShares: body.amount,
        remainingShares: body.amount - totalFilled,
        trades: trades.length,
        cost: body.price * body.amount,
        currency: 'BBAI',
      }, 201);
    } catch (err: any) {
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

    try {
      const sql = neon(process.env.DATABASE_URL!);
      const PLATFORM_FEE_PERCENT = 2.5;
      const PAYOUT_PER_SHARE = 100;

      const [market] = await sql`
        SELECT * FROM betting_market WHERE id = ${marketId} LIMIT 1
      `;
      if (!market) throw new Error('Market not found');
      if (market.status === 'resolved') throw new Error('Market already resolved');
      if (market.status === 'cancelled') throw new Error('Market is cancelled');

      // Cancel all open/partial orders
      await sql`
        UPDATE betting_order SET status = 'cancelled', updated_at = NOW()
        WHERE market_id = ${marketId} AND status IN ('open', 'partial')
      `;

      // Get all positions
      const positions = await sql`
        SELECT * FROM betting_position WHERE market_id = ${marketId}
      `;

      let totalPayout = 0;
      let platformFee = 0;
      let winners = 0;
      let losers = 0;

      for (const pos of positions) {
        if (pos.shares <= 0) continue;

        if (pos.outcome === body.outcome) {
          const grossPayout = pos.shares * PAYOUT_PER_SHARE;
          const fee = Math.round(grossPayout * (PLATFORM_FEE_PERCENT / 100));
          const netPayout = grossPayout - fee;

          await sql`
            UPDATE betting_position SET realized_pnl = ${netPayout - pos.shares * pos.avg_price}, updated_at = NOW()
            WHERE id = ${pos.id}
          `;

          totalPayout += netPayout;
          platformFee += fee;
          winners++;
        } else {
          await sql`
            UPDATE betting_position SET realized_pnl = ${-(pos.shares * pos.avg_price)}, updated_at = NOW()
            WHERE id = ${pos.id}
          `;
          losers++;
        }
      }

      // Mark market as resolved
      await sql`
        UPDATE betting_market SET status = 'resolved', resolved_outcome = ${body.outcome}, resolved_at = NOW(), updated_at = NOW()
        WHERE id = ${marketId}
      `;

      return apiSuccess({
        resolved: true,
        winningOutcome: body.outcome,
        totalPayout,
        platformFee,
        winners,
        losers,
        currency: 'BBAI',
      });
    } catch (err: any) {
      return apiError(err.message, 400);
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to resolve market', 500);
  }
}

// ─── Helper: Upsert position ────────────────────────────────────────

async function upsertPosition(
  sql: ReturnType<typeof neon>,
  marketId: string,
  userAddress: string,
  outcome: string,
  newShares: number,
  price: number,
) {
  const existing = await sql`
    SELECT * FROM betting_position
    WHERE market_id = ${marketId} AND user_address = ${userAddress} AND outcome = ${outcome}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const pos = existing[0];
    const totalShares = pos.shares + newShares;
    const newAvgPrice = totalShares > 0
      ? Math.round((pos.avg_price * pos.shares + price * newShares) / totalShares)
      : 0;

    await sql`
      UPDATE betting_position SET shares = ${totalShares}, avg_price = ${newAvgPrice}, updated_at = NOW()
      WHERE id = ${pos.id}
    `;
  } else {
    await sql`
      INSERT INTO betting_position (market_id, user_address, outcome, shares, avg_price)
      VALUES (${marketId}, ${userAddress}, ${outcome}, ${newShares}, ${price})
    `;
  }
}
