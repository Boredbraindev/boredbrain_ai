import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  bettingTrade,
  bettingMarket,
  bettingPosition,
} from '@/lib/db/schema';
import { eq, desc, gt, and, sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── Helpers ──────────────────────────────────────────────────────────

function sseEvent(eventType: string, data: unknown): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseComment(text: string): string {
  return `: ${text}\n\n`;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── GET /api/markets/[marketId]/stream ──────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> },
) {
  const { marketId } = await params;
  const encoder = new TextEncoder();
  let isActive = true;
  let lastTradeTimestamp: Date | null = null;
  let lastMarketStatus: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (text: string) => {
        if (isActive) controller.enqueue(encoder.encode(text));
      };

      // ── 1. Send initial market state ──────────────────────────────
      try {
        const [market] = await db
          .select()
          .from(bettingMarket)
          .where(eq(bettingMarket.id, marketId))
          .limit(1);

        if (!market) {
          enqueue(
            sseEvent('error', { message: 'Market not found', code: 'NOT_FOUND' }),
          );
          controller.close();
          return;
        }

        lastMarketStatus = market.status;

        // Count unique participants (distinct addresses with positions)
        const participantResult = await db
          .select({
            count: sql<number>`COUNT(DISTINCT ${bettingPosition.userAddress})`,
          })
          .from(bettingPosition)
          .where(eq(bettingPosition.marketId, marketId));

        const participants = Number(participantResult[0]?.count ?? 0);

        enqueue(
          sseEvent('market_state', {
            id: market.id,
            title: market.title,
            description: market.description,
            category: market.category,
            outcomes: market.outcomes,
            status: market.status,
            totalVolume: market.totalVolume,
            totalOrders: market.totalOrders,
            resolvedOutcome: market.resolvedOutcome,
            resolvesAt: market.resolvesAt?.toISOString() ?? null,
            participants,
          }),
        );

        // If already resolved, send final state and close
        if (market.status === 'resolved' || market.status === 'cancelled') {
          enqueue(
            sseEvent('market_resolved', {
              status: market.status,
              resolvedOutcome: market.resolvedOutcome,
              resolvedAt: market.resolvedAt?.toISOString() ?? null,
            }),
          );
          controller.close();
          return;
        }

        // Send initial probability from last trade
        const [lastTrade] = await db
          .select()
          .from(bettingTrade)
          .where(eq(bettingTrade.marketId, marketId))
          .orderBy(desc(bettingTrade.createdAt))
          .limit(1);

        if (lastTrade) {
          lastTradeTimestamp = lastTrade.createdAt;
          const yesProb =
            lastTrade.outcome === 'Yes' || lastTrade.outcome === 'YES'
              ? lastTrade.price
              : 100 - lastTrade.price;
          enqueue(
            sseEvent('probability_update', {
              YES: yesProb,
              NO: 100 - yesProb,
              participants,
              lastTradePrice: lastTrade.price,
              lastTradeSide: lastTrade.outcome,
            }),
          );
        }
      } catch (err) {
        enqueue(
          sseEvent('error', {
            message: 'Failed to load market',
            code: 'INIT_ERROR',
          }),
        );
        controller.close();
        return;
      }

      // ── 2. Poll loop every 3 seconds ─────────────────────────────
      const interval = setInterval(async () => {
        if (!isActive) {
          clearInterval(interval);
          return;
        }

        try {
          // Check market status changes (e.g. resolved while streaming)
          const [market] = await db
            .select()
            .from(bettingMarket)
            .where(eq(bettingMarket.id, marketId))
            .limit(1);

          if (!market) {
            enqueue(
              sseEvent('error', { message: 'Market deleted', code: 'DELETED' }),
            );
            isActive = false;
            clearInterval(interval);
            controller.close();
            return;
          }

          // Detect status change
          if (market.status !== lastMarketStatus) {
            lastMarketStatus = market.status;

            if (
              market.status === 'resolved' ||
              market.status === 'cancelled'
            ) {
              enqueue(
                sseEvent('market_resolved', {
                  status: market.status,
                  resolvedOutcome: market.resolvedOutcome,
                  resolvedAt: market.resolvedAt?.toISOString() ?? null,
                }),
              );
              isActive = false;
              clearInterval(interval);
              controller.close();
              return;
            }

            if (market.status === 'locked') {
              enqueue(
                sseEvent('market_locked', {
                  status: 'locked',
                  message: 'Market is locked — no more orders accepted',
                }),
              );
            }
          }

          // Fetch new trades since last check
          const tradeQuery = db
            .select()
            .from(bettingTrade)
            .where(
              lastTradeTimestamp
                ? and(
                    eq(bettingTrade.marketId, marketId),
                    gt(bettingTrade.createdAt, lastTradeTimestamp),
                  )
                : eq(bettingTrade.marketId, marketId),
            )
            .orderBy(desc(bettingTrade.createdAt))
            .limit(10);

          const newTrades = await tradeQuery;

          if (newTrades.length > 0) {
            // Update watermark to the newest trade
            lastTradeTimestamp = newTrades[0].createdAt;

            // Send trades oldest-first so the client receives them in order
            for (const trade of newTrades.reverse()) {
              enqueue(
                sseEvent('new_trade', {
                  id: trade.id,
                  side: trade.outcome,
                  price: trade.price,
                  shares: trade.shares,
                  amount: trade.bbaiAmount,
                  buyer: truncateAddress(trade.buyerAddress),
                  seller: truncateAddress(trade.sellerAddress),
                  timestamp: trade.createdAt?.toISOString(),
                }),
              );
            }

            // Recalculate probability from latest trade
            const latest = newTrades[0]; // newest
            const yesProb =
              latest.outcome === 'Yes' || latest.outcome === 'YES'
                ? latest.price
                : 100 - latest.price;

            // Participant count
            const participantResult = await db
              .select({
                count: sql<number>`COUNT(DISTINCT ${bettingPosition.userAddress})`,
              })
              .from(bettingPosition)
              .where(eq(bettingPosition.marketId, marketId));

            const participants = Number(participantResult[0]?.count ?? 0);

            enqueue(
              sseEvent('probability_update', {
                YES: yesProb,
                NO: 100 - yesProb,
                participants,
                lastTradePrice: latest.price,
                lastTradeSide: latest.outcome,
              }),
            );
          }

          // Heartbeat to keep the connection alive
          enqueue(sseComment('heartbeat'));
        } catch {
          // Don't crash the stream on transient DB errors
          enqueue(sseComment('poll-error'));
        }
      }, 3000);

      // ── 3. Clean up on client disconnect ──────────────────────────
      request.signal.addEventListener('abort', () => {
        isActive = false;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // controller may already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
