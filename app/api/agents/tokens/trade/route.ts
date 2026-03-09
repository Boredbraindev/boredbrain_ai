import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentToken, agentTokenTrade, paymentTransaction } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { generateId } from 'ai';
import { generateTxHash, generateBlockNumber } from '@/lib/payment-pipeline';
import {
  calculateBuyPrice,
  calculateSellPrice,
  getCurrentPrice,
  DEFAULT_BASE_PRICE,
  DEFAULT_SLOPE,
  type BondingCurveParams,
} from '@/lib/bonding-curve';

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

    // Fetch the token
    const [token] = await db
      .select()
      .from(agentToken)
      .where(eq(agentToken.id, tokenId));

    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    if (token.status !== 'active') {
      return NextResponse.json(
        { error: 'Token trading is paused' },
        { status: 403 }
      );
    }

    // Build bonding curve params for this token
    const params: BondingCurveParams = {
      basePrice: DEFAULT_BASE_PRICE,
      slope: DEFAULT_SLOPE,
      maxSupply: token.totalSupply,
    };

    let quote;
    let newCirculating: number;

    if (type === 'buy') {
      // Validate supply cap
      if (token.circulatingSupply + tradeAmount > token.totalSupply) {
        return NextResponse.json(
          { error: 'Purchase would exceed max supply' },
          { status: 400 }
        );
      }

      quote = calculateBuyPrice(token.circulatingSupply, tradeAmount, params);
      newCirculating = quote.newSupply;
    } else {
      // Validate sufficient supply to sell
      if (tradeAmount > token.circulatingSupply) {
        return NextResponse.json(
          { error: 'Insufficient circulating supply to sell' },
          { status: 400 }
        );
      }

      quote = calculateSellPrice(token.circulatingSupply, tradeAmount, params);
      newCirculating = quote.newSupply;
    }

    const newPrice = quote.newPrice;
    const newMarketCap = newPrice * newCirculating;

    // Record the trade
    const [trade] = await db
      .insert(agentTokenTrade)
      .values({
        id: generateId(),
        tokenId,
        traderId,
        type,
        amount: tradeAmount,
        price: quote.averagePrice,
        totalCost: quote.total,
        platformFee: quote.platformFee,
        txHash: generateTxHash(`trade-${tokenId}-${traderId}-${Date.now()}`),
        timestamp: new Date(),
      })
      .returning();

    // Update the token state
    await db
      .update(agentToken)
      .set({
        circulatingSupply: newCirculating,
        price: newPrice,
        marketCap: newMarketCap,
        totalVolume: sql`${agentToken.totalVolume} + ${quote.total}`,
        holders:
          type === 'buy'
            ? sql`${agentToken.holders} + 1`
            : sql`greatest(${agentToken.holders} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(agentToken.id, tokenId));

    // Record platform fee as a payment transaction
    if (quote.platformFee > 0) {
      await db.insert(paymentTransaction).values({
        id: generateId(),
        type: 'tool_call',
        fromAgentId: traderId,
        toAgentId: 'platform',
        amount: quote.platformFee,
        platformFee: quote.platformFee,
        providerShare: 0,
        chain: token.chain,
        txHash: generateTxHash(`trade-fee-${trade.id}`),
        status: 'confirmed',
        timestamp: new Date(),
        blockNumber: generateBlockNumber(),
      });
    }

    // Record creator fee as a separate payment transaction
    if (quote.creatorFee > 0) {
      await db.insert(paymentTransaction).values({
        id: generateId(),
        type: 'agent_invoke',
        fromAgentId: traderId,
        toAgentId: token.agentId,
        amount: quote.creatorFee,
        platformFee: 0,
        providerShare: quote.creatorFee,
        chain: token.chain,
        txHash: generateTxHash(`creator-fee-${trade.id}`),
        status: 'confirmed',
        timestamp: new Date(),
        blockNumber: generateBlockNumber(),
      });
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
    const trades = await db
      .select()
      .from(agentTokenTrade)
      .where(eq(agentTokenTrade.tokenId, tokenId))
      .orderBy(desc(agentTokenTrade.timestamp));

    // Also return current token state
    const [token] = await db
      .select()
      .from(agentToken)
      .where(eq(agentToken.id, tokenId));

    const params: BondingCurveParams = {
      basePrice: DEFAULT_BASE_PRICE,
      slope: DEFAULT_SLOPE,
      maxSupply: token?.totalSupply ?? 1_000_000_000,
    };

    return NextResponse.json({
      trades,
      token: token
        ? {
            ...token,
            bondingCurve: {
              basePrice: params.basePrice,
              slope: params.slope,
              currentPrice: getCurrentPrice(token.circulatingSupply, params),
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
