export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';

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
  let lastTradeTimestamp: string | null = null;
  let lastMarketStatus: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (text: string) => {
        if (isActive) controller.enqueue(encoder.encode(text));
      };

      const sql = neon(process.env.DATABASE_URL!);

      // ── 1. Send initial market state ──────────────────────────────
      try {
        const marketRows = await sql`
          SELECT * FROM betting_market WHERE id = ${marketId} LIMIT 1
        `;
        const market = marketRows[0];

        if (!market) {
          enqueue(
            sseEvent('error', { message: 'Market not found', code: 'NOT_FOUND' }),
          );
          controller.close();
          return;
        }

        lastMarketStatus = market.status;

        // Count unique participants
        const participantResult = await sql`
          SELECT COUNT(DISTINCT user_address) as count FROM betting_position
          WHERE market_id = ${marketId}
        `;
        const participants = Number(participantResult[0]?.count ?? 0);

        enqueue(
          sseEvent('market_state', {
            id: market.id,
            title: market.title,
            description: market.description,
            category: market.category,
            outcomes: market.outcomes,
            status: market.status,
            totalVolume: market.total_volume,
            totalOrders: market.total_orders,
            resolvedOutcome: market.resolved_outcome,
            resolvesAt: market.resolves_at ? new Date(market.resolves_at).toISOString() : null,
            participants,
          }),
        );

        // If already resolved, send final state and close
        if (market.status === 'resolved' || market.status === 'cancelled') {
          enqueue(
            sseEvent('market_resolved', {
              status: market.status,
              resolvedOutcome: market.resolved_outcome,
              resolvedAt: market.resolved_at ? new Date(market.resolved_at).toISOString() : null,
            }),
          );
          controller.close();
          return;
        }

        // Send initial probability from last trade
        const lastTradeRows = await sql`
          SELECT * FROM betting_trade WHERE market_id = ${marketId}
          ORDER BY created_at DESC LIMIT 1
        `;

        if (lastTradeRows.length > 0) {
          const lastTrade = lastTradeRows[0];
          lastTradeTimestamp = lastTrade.created_at;
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
          const pollSql = neon(process.env.DATABASE_URL!);

          // Check market status changes
          const marketRows = await pollSql`
            SELECT * FROM betting_market WHERE id = ${marketId} LIMIT 1
          `;
          const market = marketRows[0];

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

            if (market.status === 'resolved' || market.status === 'cancelled') {
              enqueue(
                sseEvent('market_resolved', {
                  status: market.status,
                  resolvedOutcome: market.resolved_outcome,
                  resolvedAt: market.resolved_at ? new Date(market.resolved_at).toISOString() : null,
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
          let newTrades;
          if (lastTradeTimestamp) {
            newTrades = await pollSql`
              SELECT * FROM betting_trade
              WHERE market_id = ${marketId} AND created_at > ${lastTradeTimestamp}::timestamptz
              ORDER BY created_at DESC LIMIT 10
            `;
          } else {
            newTrades = await pollSql`
              SELECT * FROM betting_trade
              WHERE market_id = ${marketId}
              ORDER BY created_at DESC LIMIT 10
            `;
          }

          if (newTrades.length > 0) {
            // Update watermark
            lastTradeTimestamp = newTrades[0].created_at;

            // Send trades oldest-first
            for (const trade of [...newTrades].reverse()) {
              enqueue(
                sseEvent('new_trade', {
                  id: trade.id,
                  side: trade.outcome,
                  price: trade.price,
                  shares: trade.shares,
                  amount: trade.bbai_amount,
                  buyer: truncateAddress(trade.buyer_address),
                  seller: truncateAddress(trade.seller_address),
                  timestamp: trade.created_at ? new Date(trade.created_at).toISOString() : undefined,
                }),
              );
            }

            // Recalculate probability from latest trade
            const latest = newTrades[0];
            const yesProb =
              latest.outcome === 'Yes' || latest.outcome === 'YES'
                ? latest.price
                : 100 - latest.price;

            // Participant count
            const participantResult = await pollSql`
              SELECT COUNT(DISTINCT user_address) as count FROM betting_position
              WHERE market_id = ${marketId}
            `;
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

          // Heartbeat
          enqueue(sseComment('heartbeat'));
        } catch {
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
