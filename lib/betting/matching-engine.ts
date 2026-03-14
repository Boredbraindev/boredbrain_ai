import { db } from '@/lib/db';
import {
  bettingMarket,
  bettingOrder,
  bettingTrade,
  bettingPosition,
} from '@/lib/db/schema';
import { eq, and, lte, gte, desc, asc, sql, ne } from 'drizzle-orm';
import { addToFeed } from '@/lib/betting/feed-store';

// ─── Constants ──────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = 2.5; // 2.5% on winning payout
const PAYOUT_PER_SHARE = 100; // each winning share pays 100 BBAI

// ─── Types ──────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  marketId: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerAddress: string;
  sellerAddress: string;
  outcome: string;
  price: number;
  shares: number;
  bbaiAmount: number;
}

export interface OrderBookLevel {
  price: number;
  totalShares: number;
  orders: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastPrice: number;
  volume24h: number;
}

export interface PlaceOrderResult {
  orderId: string;
  filled: number;
  trades: Trade[];
}

export interface ResolveResult {
  totalPayout: number;
  platformFee: number;
  winners: number;
  losers: number;
}

export interface Position {
  id: string;
  marketId: string;
  userAddress: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  realizedPnl: number;
}

export interface MarketStats {
  totalVolume: number;
  currentPrices: Record<string, number>;
  orderCount: number;
}

// ─── Matching Engine ────────────────────────────────────────────────

/**
 * Get the complementary side for a binary market outcome.
 * YES at price P is equivalent to NO at price (100 - P).
 */
function getComplementarySide(side: string): string {
  if (side === 'Yes' || side === 'YES') return 'No';
  if (side === 'No' || side === 'NO') return 'Yes';
  return side;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function normalizeSide(side: string): string {
  if (side.toUpperCase() === 'YES') return 'Yes';
  if (side.toUpperCase() === 'NO') return 'No';
  return side;
}

/**
 * Place a limit order and attempt to match against the order book.
 *
 * Matching logic:
 * - A BUY order for YES at price P matches with:
 *   - Existing SELL-side YES orders at price <= P (direct match)
 *   - Equivalently, BUY orders for NO at price >= (100 - P)
 * - We match best price first (price-time priority)
 */
export async function placeOrder(input: {
  marketId: string;
  userAddress: string;
  userType: 'user' | 'agent';
  side: string;
  price: number;
  amount: number;
}): Promise<PlaceOrderResult> {
  const side = normalizeSide(input.side);
  const complementarySide = getComplementarySide(side);
  const complementaryPrice = PAYOUT_PER_SHARE - input.price; // e.g. YES@60 matches NO@40

  // Validate price
  if (input.price < 1 || input.price > 99) {
    throw new Error('Price must be between 1 and 99');
  }
  if (input.amount < 1) {
    throw new Error('Amount must be at least 1');
  }

  // Verify market is open
  const [market] = await db
    .select()
    .from(bettingMarket)
    .where(eq(bettingMarket.id, input.marketId))
    .limit(1);

  if (!market) throw new Error('Market not found');
  if (market.status !== 'open') throw new Error('Market is not open for trading');

  // Insert the new order
  const [newOrder] = await db
    .insert(bettingOrder)
    .values({
      marketId: input.marketId,
      userAddress: input.userAddress,
      userType: input.userType,
      side,
      price: input.price,
      amount: input.amount,
      filled: 0,
      status: 'open',
    })
    .returning();

  // Find matching counter-orders:
  // Counter-orders are on the complementary side with price <= complementaryPrice
  // Sorted by price ASC (cheapest first = best match), then createdAt ASC (FIFO)
  const counterOrders = await db
    .select()
    .from(bettingOrder)
    .where(
      and(
        eq(bettingOrder.marketId, input.marketId),
        eq(bettingOrder.side, complementarySide),
        lte(bettingOrder.price, complementaryPrice),
        ne(bettingOrder.userAddress, input.userAddress), // can't self-match
        sql`${bettingOrder.status} IN ('open', 'partial')`,
      ),
    )
    .orderBy(asc(bettingOrder.price), asc(bettingOrder.createdAt));

  const trades: Trade[] = [];
  let remainingAmount = input.amount;
  let totalFilled = 0;

  for (const counter of counterOrders) {
    if (remainingAmount <= 0) break;

    const counterRemaining = counter.amount - counter.filled;
    if (counterRemaining <= 0) continue;

    const matchShares = Math.min(remainingAmount, counterRemaining);
    // Trade price is the resting order's price perspective
    // The execution price from the buyer's side: buyer pays `input.price` per share
    // The counter (complementary) side pays `counter.price` per share
    // Together they cover 100 BBAI per share (input.price + counter.price >= 100)
    const tradePrice = input.price;
    const bbaiAmount = matchShares * tradePrice;

    // Create trade record
    const [trade] = await db
      .insert(bettingTrade)
      .values({
        marketId: input.marketId,
        buyOrderId: newOrder.id,
        sellOrderId: counter.id,
        buyerAddress: input.userAddress,
        sellerAddress: counter.userAddress,
        outcome: side,
        price: tradePrice,
        shares: matchShares,
        bbaiAmount,
      })
      .returning();

    trades.push(trade);

    // Push to in-memory activity feed
    addToFeed({
      id: trade.id,
      marketId: trade.marketId,
      marketTitle: market.title,
      user: truncateAddr(input.userAddress),
      userType: input.userType,
      side: trade.outcome,
      amount: trade.bbaiAmount,
      price: trade.price,
      shares: trade.shares,
      timestamp: trade.createdAt?.toISOString() ?? new Date().toISOString(),
    });

    // Update counter order
    const counterNewFilled = counter.filled + matchShares;
    const counterStatus = counterNewFilled >= counter.amount ? 'filled' : 'partial';
    await db
      .update(bettingOrder)
      .set({
        filled: counterNewFilled,
        status: counterStatus,
        updatedAt: new Date(),
      })
      .where(eq(bettingOrder.id, counter.id));

    // Update positions for both parties
    await updatePosition(input.marketId, input.userAddress, side, matchShares, tradePrice);
    await updatePosition(input.marketId, counter.userAddress, complementarySide, matchShares, counter.price);

    totalFilled += matchShares;
    remainingAmount -= matchShares;
  }

  // Update the placed order's filled count and status
  const orderStatus =
    totalFilled >= input.amount ? 'filled' : totalFilled > 0 ? 'partial' : 'open';

  await db
    .update(bettingOrder)
    .set({
      filled: totalFilled,
      status: orderStatus,
      updatedAt: new Date(),
    })
    .where(eq(bettingOrder.id, newOrder.id));

  // Update market volume and order count
  if (trades.length > 0) {
    const tradeVolume = trades.reduce((sum, t) => sum + t.bbaiAmount, 0);
    await db
      .update(bettingMarket)
      .set({
        totalVolume: sql`${bettingMarket.totalVolume} + ${tradeVolume}`,
        totalOrders: sql`${bettingMarket.totalOrders} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(bettingMarket.id, input.marketId));
  } else {
    await db
      .update(bettingMarket)
      .set({
        totalOrders: sql`${bettingMarket.totalOrders} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(bettingMarket.id, input.marketId));
  }

  return {
    orderId: newOrder.id,
    filled: totalFilled,
    trades,
  };
}

/**
 * Update (or create) a user's position for a given market + outcome.
 */
async function updatePosition(
  marketId: string,
  userAddress: string,
  outcome: string,
  newShares: number,
  price: number,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(bettingPosition)
    .where(
      and(
        eq(bettingPosition.marketId, marketId),
        eq(bettingPosition.userAddress, userAddress),
        eq(bettingPosition.outcome, outcome),
      ),
    )
    .limit(1);

  if (existing) {
    // Calculate new weighted average price
    const totalShares = existing.shares + newShares;
    const newAvgPrice =
      totalShares > 0
        ? Math.round(
            (existing.avgPrice * existing.shares + price * newShares) / totalShares,
          )
        : 0;

    await db
      .update(bettingPosition)
      .set({
        shares: totalShares,
        avgPrice: newAvgPrice,
        updatedAt: new Date(),
      })
      .where(eq(bettingPosition.id, existing.id));
  } else {
    await db.insert(bettingPosition).values({
      marketId,
      userAddress,
      outcome,
      shares: newShares,
      avgPrice: price,
    });
  }
}

/**
 * Cancel an open/partial order. Only the owner can cancel.
 */
export async function cancelOrder(
  orderId: string,
  userAddress: string,
): Promise<boolean> {
  const [order] = await db
    .select()
    .from(bettingOrder)
    .where(eq(bettingOrder.id, orderId))
    .limit(1);

  if (!order) throw new Error('Order not found');
  if (order.userAddress !== userAddress) throw new Error('Not authorized');
  if (order.status !== 'open' && order.status !== 'partial') {
    throw new Error('Order cannot be cancelled');
  }

  await db
    .update(bettingOrder)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(bettingOrder.id, orderId));

  return true;
}

/**
 * Get the order book for a market, aggregated by price level.
 */
export async function getOrderBook(marketId: string): Promise<OrderBook> {
  // Get all open/partial orders
  const orders = await db
    .select()
    .from(bettingOrder)
    .where(
      and(
        eq(bettingOrder.marketId, marketId),
        sql`${bettingOrder.status} IN ('open', 'partial')`,
      ),
    )
    .orderBy(asc(bettingOrder.price));

  // Aggregate bids (YES side) and asks (NO side)
  const bidMap = new Map<number, { totalShares: number; orders: number }>();
  const askMap = new Map<number, { totalShares: number; orders: number }>();

  for (const order of orders) {
    const remaining = order.amount - order.filled;
    if (remaining <= 0) continue;

    const isYes = order.side === 'Yes' || order.side === 'YES';
    const map = isYes ? bidMap : askMap;
    const price = order.price;

    const existing = map.get(price) || { totalShares: 0, orders: 0 };
    existing.totalShares += remaining;
    existing.orders += 1;
    map.set(price, existing);
  }

  const bids: OrderBookLevel[] = Array.from(bidMap.entries())
    .map(([price, data]) => ({ price, ...data }))
    .sort((a, b) => b.price - a.price); // highest bid first

  const asks: OrderBookLevel[] = Array.from(askMap.entries())
    .map(([price, data]) => ({ price, ...data }))
    .sort((a, b) => a.price - b.price); // lowest ask first

  // Get last trade price
  const [lastTrade] = await db
    .select()
    .from(bettingTrade)
    .where(eq(bettingTrade.marketId, marketId))
    .orderBy(desc(bettingTrade.createdAt))
    .limit(1);

  // Get 24h volume
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const volumeResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${bettingTrade.bbaiAmount}), 0)` })
    .from(bettingTrade)
    .where(
      and(
        eq(bettingTrade.marketId, marketId),
        gte(bettingTrade.createdAt, twentyFourHoursAgo),
      ),
    );

  return {
    bids,
    asks,
    lastPrice: lastTrade?.price ?? 50,
    volume24h: Number(volumeResult[0]?.total ?? 0),
  };
}

/**
 * Resolve a market and settle all positions.
 * Winning shares pay out 100 BBAI minus 2.5% platform fee = 97.5 BBAI each.
 * Losing shares pay out 0.
 */
export async function resolveMarket(
  marketId: string,
  winningOutcome: string,
): Promise<ResolveResult> {
  const [market] = await db
    .select()
    .from(bettingMarket)
    .where(eq(bettingMarket.id, marketId))
    .limit(1);

  if (!market) throw new Error('Market not found');
  if (market.status === 'resolved') throw new Error('Market already resolved');
  if (market.status === 'cancelled') throw new Error('Market is cancelled');

  // Cancel all open/partial orders
  await db
    .update(bettingOrder)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(bettingOrder.marketId, marketId),
        sql`${bettingOrder.status} IN ('open', 'partial')`,
      ),
    );

  // Get all positions
  const positions = await db
    .select()
    .from(bettingPosition)
    .where(eq(bettingPosition.marketId, marketId));

  let totalPayout = 0;
  let platformFee = 0;
  let winners = 0;
  let losers = 0;

  for (const pos of positions) {
    if (pos.shares <= 0) continue;

    if (pos.outcome === winningOutcome) {
      // Winning position
      const grossPayout = pos.shares * PAYOUT_PER_SHARE;
      const fee = Math.round(grossPayout * (PLATFORM_FEE_PERCENT / 100));
      const netPayout = grossPayout - fee;

      await db
        .update(bettingPosition)
        .set({
          realizedPnl: netPayout - pos.shares * pos.avgPrice,
          updatedAt: new Date(),
        })
        .where(eq(bettingPosition.id, pos.id));

      totalPayout += netPayout;
      platformFee += fee;
      winners++;
    } else {
      // Losing position — shares are worthless
      await db
        .update(bettingPosition)
        .set({
          realizedPnl: -(pos.shares * pos.avgPrice),
          updatedAt: new Date(),
        })
        .where(eq(bettingPosition.id, pos.id));

      losers++;
    }
  }

  // Mark market as resolved
  await db
    .update(bettingMarket)
    .set({
      status: 'resolved',
      resolvedOutcome: winningOutcome,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bettingMarket.id, marketId));

  return { totalPayout, platformFee, winners, losers };
}

/**
 * Get all positions for a user across all markets.
 */
export async function getUserPositions(userAddress: string): Promise<Position[]> {
  const positions = await db
    .select()
    .from(bettingPosition)
    .where(eq(bettingPosition.userAddress, userAddress))
    .orderBy(desc(bettingPosition.updatedAt));

  return positions.map((p) => ({
    id: p.id,
    marketId: p.marketId,
    userAddress: p.userAddress,
    outcome: p.outcome,
    shares: p.shares,
    avgPrice: p.avgPrice,
    realizedPnl: p.realizedPnl,
  }));
}

/**
 * Get statistics for a market.
 */
export async function getMarketStats(marketId: string): Promise<MarketStats> {
  const [market] = await db
    .select()
    .from(bettingMarket)
    .where(eq(bettingMarket.id, marketId))
    .limit(1);

  if (!market) throw new Error('Market not found');

  // Get latest trade price per outcome
  const trades = await db
    .select()
    .from(bettingTrade)
    .where(eq(bettingTrade.marketId, marketId))
    .orderBy(desc(bettingTrade.createdAt));

  const currentPrices: Record<string, number> = {};
  for (const outcome of market.outcomes) {
    const latestTrade = trades.find((t) => t.outcome === outcome);
    currentPrices[outcome] = latestTrade?.price ?? 50;
  }

  return {
    totalVolume: market.totalVolume,
    currentPrices,
    orderCount: market.totalOrders,
  };
}
