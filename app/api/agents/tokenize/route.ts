import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agent, agentToken, paymentTransaction } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from 'ai';
import { generateTxHash, generateBlockNumber } from '@/lib/payment-pipeline';
import {
  generateTokenSymbol,
  DEFAULT_BASE_PRICE,
  DEFAULT_SLOPE,
  DEFAULT_MAX_SUPPLY,
  getCurrentPrice,
} from '@/lib/bonding-curve';

const TOKENIZATION_FEE = 500; // 500 BBAI to tokenize an agent

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      tokenSymbol: customSymbol,
      tokenName: customName,
      chain = 'base',
      basePrice,
      slope,
      maxSupply,
    } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const [agentRecord] = await db
      .select()
      .from(agent)
      .where(eq(agent.id, agentId));

    if (!agentRecord) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check if already tokenized
    const [existing] = await db
      .select()
      .from(agentToken)
      .where(eq(agentToken.agentId, agentId));

    if (existing) {
      return NextResponse.json(
        { error: 'Agent is already tokenized' },
        { status: 409 }
      );
    }

    // Generate or validate token symbol
    const tokenSymbol = (customSymbol || generateTokenSymbol(agentRecord.name)).toUpperCase();
    const tokenName = customName || `${agentRecord.name} Token`;

    // Check symbol uniqueness
    const [symbolExists] = await db
      .select()
      .from(agentToken)
      .where(eq(agentToken.tokenSymbol, tokenSymbol));

    if (symbolExists) {
      return NextResponse.json(
        { error: `Token symbol "${tokenSymbol}" is already taken` },
        { status: 409 }
      );
    }

    // Bonding curve parameters (use defaults if not provided)
    const curveBasePrice = basePrice ?? DEFAULT_BASE_PRICE;
    const curveSlope = slope ?? DEFAULT_SLOPE;
    const curveMaxSupply = maxSupply ?? DEFAULT_MAX_SUPPLY;
    const initialPrice = getCurrentPrice(0, {
      basePrice: curveBasePrice,
      slope: curveSlope,
      maxSupply: curveMaxSupply,
    });

    // Create the agent token record
    const [token] = await db
      .insert(agentToken)
      .values({
        id: generateId(),
        agentId,
        tokenSymbol,
        tokenName,
        totalSupply: curveMaxSupply,
        circulatingSupply: 0,
        price: initialPrice,
        marketCap: 0,
        totalVolume: 0,
        holders: 0,
        buybackPool: 0,
        tokenizationFee: TOKENIZATION_FEE,
        chain,
        txHash: generateTxHash(`tokenize-${agentId}`),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Record the tokenization fee payment
    await db.insert(paymentTransaction).values({
      id: generateId(),
      type: 'staking',
      fromAgentId: agentId,
      toAgentId: 'platform',
      amount: TOKENIZATION_FEE,
      platformFee: TOKENIZATION_FEE,
      providerShare: 0,
      chain,
      txHash: generateTxHash(`tokenize-fee-${agentId}`),
      status: 'confirmed',
      timestamp: new Date(),
      blockNumber: generateBlockNumber(),
    });

    return NextResponse.json(
      {
        token,
        bondingCurve: {
          basePrice: curveBasePrice,
          slope: curveSlope,
          maxSupply: curveMaxSupply,
          initialPrice,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Tokenization failed' },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const tokens = await db
      .select()
      .from(agentToken)
      .where(eq(agentToken.status, 'active'));

    // Enrich each token with bonding curve data
    const enriched = tokens.map((t) => ({
      ...t,
      bondingCurve: {
        basePrice: DEFAULT_BASE_PRICE,
        slope: DEFAULT_SLOPE,
        currentPrice: getCurrentPrice(t.circulatingSupply, {
          basePrice: DEFAULT_BASE_PRICE,
          slope: DEFAULT_SLOPE,
          maxSupply: t.totalSupply,
        }),
      },
    }));

    return NextResponse.json(
      { tokens: enriched },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { tokens: [], error: error.message },
      { status: 200 }
    );
  }
}
