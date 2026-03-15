export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import {
  calculateBuyPrice,
  calculateSellPrice,
  getCurrentPrice,
  DEFAULT_BASE_PRICE,
  DEFAULT_SLOPE,
  type BondingCurveParams,
} from '@/lib/bonding-curve';

// Inline from payment-pipeline (avoids Drizzle import)
function generateTxHash(context?: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `bbai-tx-${ts}-${rand}`;
}

function generateBlockNumber(): number {
  return Date.now();
}

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenId, traderId, type, amount } = body;

    if (!tokenId || !traderId || !type || !amount) {
      return NextResponse.json(
        { error: 'tokenId, traderId, type, and amount are required' },
        { status: 400 }
      );
    }

    if (!['buy', 'sell'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    const tradeAmount = Number(amount);
    if (tradeAmount <= 0 || isNaN(tradeAmount)) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Fetch the token
    const tokenRows = await sql`
      SELECT * FROM agent_token WHERE id = ${tokenId} LIMIT 1
    `;

    if (tokenRows.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const token = tokenRows[0];

    if (token.status !== 'active') {
      return NextResponse.json(
        { error: 'Token trading is paused' },
        { status: 403 }
      );
    }

    const circulatingSupply = Number(token.circulating_supply) || 0;
    const totalSupply = Number(token.total_supply) || 1_000_000_000;

    // Build bonding curve params for this token
    const params: BondingCurveParams = {
      basePrice: DEFAULT_BASE_PRICE,
      slope: DEFAULT_SLOPE,
      maxSupply: totalSupply,
    };

    let quote;
    let newCirculating: number;

    if (type === 'buy') {
      // Validate supply cap
      if (circulatingSupply + tradeAmount > totalSupply) {
        return NextResponse.json(
          { error: 'Purchase would exceed max supply' },
          { status: 400 }
        );
      }

      quote = calculateBuyPrice(circulatingSupply, tradeAmount, params);
      newCirculating = quote.newSupply;
    } else {
      // Validate sufficient supply to sell
      if (tradeAmount > circulatingSupply) {
        return NextResponse.json(
          { error: 'Insufficient circulating supply to sell' },
          { status: 400 }
        );
      }

      quote = calculateSellPrice(circulatingSupply, tradeAmount, params);
      newCirculating = quote.newSupply;
    }

    const newPrice = quote.newPrice;
    const newMarketCap = newPrice * newCirculating;

    // Record the trade
    const tradeId = generateId();
    const tradeTxHash = generateTxHash(`trade-${tokenId}-${traderId}-${Date.now()}`);
    const now = new Date().toISOString();

    const tradeRows = await sql`
      INSERT INTO agent_token_trade (
        id, token_id, trader_id, type, amount,
        price, total_cost, platform_fee, tx_hash, timestamp
      ) VALUES (
        ${tradeId}, ${tokenId}, ${traderId}, ${type}, ${tradeAmount},
        ${quote.averagePrice}, ${quote.total}, ${quote.platformFee},
        ${tradeTxHash}, ${now}
      )
      RETURNING *
    `;

    const trade = tradeRows[0];

    // Update the token state
    const holdersChange = type === 'buy' ? 1 : -1;
    await sql`
      UPDATE agent_token SET
        circulating_supply = ${newCirculating},
        price = ${newPrice},
        market_cap = ${newMarketCap},
        total_volume = total_volume + ${quote.total},
        holders = GREATEST(holders + ${holdersChange}, 0),
        updated_at = ${now}
      WHERE id = ${tokenId}
    `;

    // Record platform fee as a payment transaction
    if (quote.platformFee > 0) {
      const feeId = generateId();
      const feeTxHash = generateTxHash(`trade-fee-${trade.id}`);
      await sql`
        INSERT INTO payment_transaction (
          id, type, from_agent_id, to_agent_id, amount,
          platform_fee, provider_share, chain, tx_hash,
          status, timestamp, block_number
        ) VALUES (
          ${feeId}, 'tool_call', ${traderId}, 'platform', ${quote.platformFee},
          ${quote.platformFee}, ${0}, ${token.chain}, ${feeTxHash},
          'confirmed', ${now}, ${generateBlockNumber()}
        )
      `;
    }

    // Record creator fee as a separate payment transaction
    if (quote.creatorFee > 0) {
      const creatorFeeId = generateId();
      const creatorFeeTxHash = generateTxHash(`creator-fee-${trade.id}`);
      await sql`
        INSERT INTO payment_transaction (
          id, type, from_agent_id, to_agent_id, amount,
          platform_fee, provider_share, chain, tx_hash,
          status, timestamp, block_number
        ) VALUES (
          ${creatorFeeId}, 'agent_invoke', ${traderId}, ${token.agent_id}, ${quote.creatorFee},
          ${0}, ${quote.creatorFee}, ${token.chain}, ${creatorFeeTxHash},
          'confirmed', ${now}, ${generateBlockNumber()}
        )
      `;
    }

    return NextResponse.json(
      {
        trade,
        quote: {
          rawAmount: quote.rawAmount,
          platformFee: quote.platformFee,
          creatorFee: quote.creatorFee,
          total: quote.total,
          averagePrice: quote.averagePrice,
          newPrice: quote.newPrice,
          newSupply: quote.newSupply,
          newMarketCap,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Trade failed' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get('tokenId');

  if (!tokenId) {
    return NextResponse.json(
      { error: 'tokenId query param required' },
      { status: 400 }
    );
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const trades = await sql`
      SELECT * FROM agent_token_trade
      WHERE token_id = ${tokenId}
      ORDER BY timestamp DESC
    `;

    // Also return current token state
    const tokenRows = await sql`
      SELECT * FROM agent_token WHERE id = ${tokenId} LIMIT 1
    `;

    const token = tokenRows[0] || null;

    const params: BondingCurveParams = {
      basePrice: DEFAULT_BASE_PRICE,
      slope: DEFAULT_SLOPE,
      maxSupply: Number(token?.total_supply) ?? 1_000_000_000,
    };

    return NextResponse.json({
      trades,
      token: token
        ? {
            ...token,
            bondingCurve: {
              basePrice: params.basePrice,
              slope: params.slope,
              currentPrice: getCurrentPrice(Number(token.circulating_supply) || 0, params),
            },
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { trades: [], error: error.message },
      { status: 200 }
    );
  }
}
