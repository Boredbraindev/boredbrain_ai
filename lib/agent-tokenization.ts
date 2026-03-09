/**
 * Agent Tokenization - Bonding Curve Model
 *
 * Each agent can be tokenized with 1B supply tokens.
 * Linear bonding curve: price = basePrice + (supply * slope)
 * 1% platform fee + 5% creator fee on all trades.
 * 50% of agent revenue triggers automatic buybacks.
 */

import { db } from '@/lib/db';
import { agentToken, agentTokenTrade, paymentTransaction } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { generateId } from 'ai';
import { generateTxHash, generateBlockNumber } from '@/lib/payment-pipeline';
import {
  getCurrentPrice as bcGetCurrentPrice,
  calculateBuyPrice,
  calculateSellPrice,
  DEFAULT_BASE_PRICE,
  DEFAULT_SLOPE,
  DEFAULT_MAX_SUPPLY,
  PLATFORM_FEE_BPS,
  CREATOR_FEE_BPS,
  BPS_DENOMINATOR,
  type BondingCurveParams,
} from '@/lib/bonding-curve';

const TOKENIZATION_FEE = 500;

function getParams(token?: { totalSupply: number }): BondingCurveParams {
  return {
    basePrice: DEFAULT_BASE_PRICE,
    slope: DEFAULT_SLOPE,
    maxSupply: token?.totalSupply ?? DEFAULT_MAX_SUPPLY,
  };
}

function calculatePrice(circulatingSupply: number): number {
  return bcGetCurrentPrice(circulatingSupply, getParams());
}

export async function tokenizeAgent(params: {
  agentId: string;
  tokenSymbol: string;
  tokenName: string;
  chain?: string;
}) {
  const { agentId, tokenSymbol, tokenName, chain = 'base' } = params;

  const [existing] = await db.select().from(agentToken).where(eq(agentToken.agentId, agentId));
  if (existing) throw new Error('Agent is already tokenized');

  const [symbolExists] = await db.select().from(agentToken).where(eq(agentToken.tokenSymbol, tokenSymbol.toUpperCase()));
  if (symbolExists) throw new Error('Token symbol already taken');

  const [token] = await db.insert(agentToken).values({
    id: generateId(),
    agentId,
    tokenSymbol: tokenSymbol.toUpperCase(),
    tokenName,
    totalSupply: TOTAL_SUPPLY,
    circulatingSupply: 0,
    price: BASE_PRICE,
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
  }).returning();

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

  return token;
}

export async function tradeAgentToken(params: {
  tokenId: string;
  traderId: string;
  type: 'buy' | 'sell';
  amount: number;
}) {
  const { tokenId, traderId, type, amount } = params;
  if (amount <= 0) throw new Error('Trade amount must be positive');

  const [token] = await db.select().from(agentToken).where(eq(agentToken.id, tokenId));
  if (!token) throw new Error('Token not found');

  const params = getParams(token);

  let quote;
  if (type === 'buy') {
    if (token.circulatingSupply + amount > token.totalSupply) throw new Error('Exceeds total supply');
    quote = calculateBuyPrice(token.circulatingSupply, amount, params);
  } else {
    if (amount > token.circulatingSupply) throw new Error('Insufficient supply to sell');
    quote = calculateSellPrice(token.circulatingSupply, amount, params);
  }

  const newCirculating = quote.newSupply;
  const newPrice = quote.newPrice;
  const newMarketCap = newPrice * newCirculating;

  const [trade] = await db.insert(agentTokenTrade).values({
    id: generateId(),
    tokenId,
    traderId,
    type,
    amount,
    price: quote.averagePrice,
    totalCost: quote.total,
    platformFee: quote.platformFee,
    txHash: generateTxHash(`trade-${tokenId}-${traderId}`),
    timestamp: new Date(),
  }).returning();

  await db.update(agentToken).set({
    circulatingSupply: newCirculating,
    price: newPrice,
    marketCap: newMarketCap,
    totalVolume: sql`${agentToken.totalVolume} + ${quote.total}`,
    holders: type === 'buy' ? sql`${agentToken.holders} + 1` : sql`greatest(${agentToken.holders} - 1, 0)`,
    updatedAt: new Date(),
  }).where(eq(agentToken.id, tokenId));

  // Record platform fee (1%)
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

  // Record creator fee (5%)
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

  return trade;
}

export async function triggerBuyback(agentId: string, revenueAmount: number) {
  const [token] = await db.select().from(agentToken).where(eq(agentToken.agentId, agentId));
  if (!token || token.status !== 'active') return;

  const buybackAmount = revenueAmount * 0.5;
  const tokensToBurn = buybackAmount / token.price;
  const newCirculating = Math.max(0, token.circulatingSupply - tokensToBurn);
  const newPrice = calculatePrice(newCirculating);

  await db.update(agentToken).set({
    buybackPool: sql`${agentToken.buybackPool} + ${buybackAmount}`,
    circulatingSupply: newCirculating,
    price: newPrice,
    marketCap: newPrice * newCirculating,
    updatedAt: new Date(),
  }).where(eq(agentToken.id, token.id));

  await db.insert(agentTokenTrade).values({
    id: generateId(),
    tokenId: token.id,
    traderId: 'platform-buyback',
    type: 'buyback',
    amount: tokensToBurn,
    price: token.price,
    totalCost: buybackAmount,
    platformFee: 0,
    txHash: generateTxHash(`buyback-${agentId}`),
    timestamp: new Date(),
  });
}

export async function getAgentTokens() {
  return db.select().from(agentToken).where(eq(agentToken.status, 'active')).orderBy(desc(agentToken.marketCap));
}

export async function getTokenTradeHistory(tokenId: string) {
  return db.select().from(agentTokenTrade).where(eq(agentTokenTrade.tokenId, tokenId)).orderBy(desc(agentTokenTrade.timestamp));
}

export async function getTokenizationRevenueStats() {
  const tokens = await db.select().from(agentToken);
  const totalTokenizationFees = tokens.length * TOKENIZATION_FEE;
  const totalVolume = tokens.reduce((sum, t) => sum + t.totalVolume, 0);
  const totalMarketCap = tokens.reduce((sum, t) => sum + t.marketCap, 0);

  const [tradeFees] = await db.select({
    total: sql<number>`coalesce(sum(${agentTokenTrade.platformFee}), 0)`,
  }).from(agentTokenTrade);

  return {
    totalTokens: tokens.length,
    totalTokenizationFees,
    totalTradeVolume: totalVolume,
    totalTradeFees: Number(tradeFees.total),
    totalMarketCap,
    totalRevenue: totalTokenizationFees + Number(tradeFees.total),
  };
}
