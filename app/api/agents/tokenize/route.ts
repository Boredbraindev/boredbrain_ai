export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import {
  generateTokenSymbol,
  DEFAULT_BASE_PRICE,
  DEFAULT_SLOPE,
  DEFAULT_MAX_SUPPLY,
  getCurrentPrice,
} from '@/lib/bonding-curve';

const TOKENIZATION_FEE = 500; // 500 BBAI to tokenize an agent

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

    const sql = neon(process.env.DATABASE_URL!);

    // Verify agent exists (check agent table)
    const agentRows = await sql`
      SELECT id, name FROM agent WHERE id = ${agentId} LIMIT 1
    `;

    if (agentRows.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const agentRecord = agentRows[0];

    // Check if already tokenized
    const existingRows = await sql`
      SELECT id FROM agent_token WHERE agent_id = ${agentId} LIMIT 1
    `;

    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: 'Agent is already tokenized' },
        { status: 409 }
      );
    }

    // Generate or validate token symbol
    const tokenSymbol = (customSymbol || generateTokenSymbol(agentRecord.name as string)).toUpperCase();
    const tokenName = customName || `${agentRecord.name} Token`;

    // Check symbol uniqueness
    const symbolRows = await sql`
      SELECT id FROM agent_token WHERE token_symbol = ${tokenSymbol} LIMIT 1
    `;

    if (symbolRows.length > 0) {
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

    const tokenId = generateId();
    const now = new Date().toISOString();
    const txHash = generateTxHash(`tokenize-${agentId}`);

    // Create the agent token record
    const tokenRows = await sql`
      INSERT INTO agent_token (
        id, agent_id, token_symbol, token_name, total_supply,
        circulating_supply, price, market_cap, total_volume,
        holders, buyback_pool, tokenization_fee, chain,
        tx_hash, status, created_at, updated_at
      ) VALUES (
        ${tokenId}, ${agentId}, ${tokenSymbol}, ${tokenName}, ${curveMaxSupply},
        ${0}, ${initialPrice}, ${0}, ${0},
        ${0}, ${0}, ${TOKENIZATION_FEE}, ${chain},
        ${txHash}, 'active', ${now}, ${now}
      )
      RETURNING *
    `;

    // Record the tokenization fee payment
    const feeTxHash = generateTxHash(`tokenize-fee-${agentId}`);
    const feeId = generateId();
    const blockNumber = generateBlockNumber();

    await sql`
      INSERT INTO payment_transaction (
        id, type, from_agent_id, to_agent_id, amount,
        platform_fee, provider_share, chain, tx_hash,
        status, timestamp, block_number
      ) VALUES (
        ${feeId}, 'staking', ${agentId}, 'platform', ${TOKENIZATION_FEE},
        ${TOKENIZATION_FEE}, ${0}, ${chain}, ${feeTxHash},
        'confirmed', ${now}, ${blockNumber}
      )
    `;

    return NextResponse.json(
      {
        token: tokenRows[0],
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
    const sql = neon(process.env.DATABASE_URL!);

    const tokens = await sql`
      SELECT * FROM agent_token WHERE status = 'active'
    `;

    // Enrich each token with bonding curve data
    const enriched = tokens.map((t) => ({
      ...t,
      bondingCurve: {
        basePrice: DEFAULT_BASE_PRICE,
        slope: DEFAULT_SLOPE,
        currentPrice: getCurrentPrice(Number(t.circulating_supply) || 0, {
          basePrice: DEFAULT_BASE_PRICE,
          slope: DEFAULT_SLOPE,
          maxSupply: Number(t.total_supply) || DEFAULT_MAX_SUPPLY,
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
