/**
 * Playbook Marketplace - Winning arena strategies for sale.
 * 85% to creator, 15% platform fee.
 */

import { db } from '@/lib/db';
import { playbook, playbookPurchase, paymentTransaction } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { generateId } from 'ai';
import { generateTxHash, generateBlockNumber } from '@/lib/payment-pipeline';

const PLATFORM_FEE_PERCENT = 0.15;

export async function createPlaybook(params: {
  creatorId: string;
  agentId?: string;
  matchId?: string;
  title: string;
  description?: string;
  systemPrompt: string;
  toolConfig: string[];
  matchType?: string;
  winRate?: number;
  price?: number;
}) {
  const { creatorId, agentId, matchId, title, description, systemPrompt, toolConfig, matchType, winRate = 0, price = 50 } = params;

  const [pb] = await db.insert(playbook).values({
    id: generateId(),
    creatorId,
    agentId: agentId || null,
    matchId: matchId || null,
    title,
    description: description || null,
    systemPrompt,
    toolConfig,
    matchType: matchType || null,
    winRate,
    price,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return pb;
}

export async function purchasePlaybook(params: { playbookId: string; buyerId: string }) {
  const { playbookId, buyerId } = params;

  const [pb] = await db.select().from(playbook).where(eq(playbook.id, playbookId));
  if (!pb) throw new Error('Playbook not found');

  const price = pb.price;
  const platformFee = price * PLATFORM_FEE_PERCENT;
  const creatorShare = price - platformFee;

  const [purchase] = await db.insert(playbookPurchase).values({
    id: generateId(),
    playbookId,
    buyerId,
    price,
    txHash: generateTxHash(`playbook-${playbookId}-${buyerId}`),
    createdAt: new Date(),
  }).returning();

  await db.update(playbook).set({
    totalSales: sql`${playbook.totalSales} + 1`,
    totalRevenue: sql`${playbook.totalRevenue} + ${price}`,
    updatedAt: new Date(),
  }).where(eq(playbook.id, playbookId));

  await db.insert(paymentTransaction).values({
    id: generateId(),
    type: 'prompt_purchase',
    fromAgentId: buyerId,
    toAgentId: pb.creatorId,
    amount: price,
    platformFee,
    providerShare: creatorShare,
    chain: 'base',
    txHash: generateTxHash(`playbook-fee-${purchase.id}`),
    status: 'confirmed',
    timestamp: new Date(),
    blockNumber: generateBlockNumber(),
  });

  return purchase;
}

export async function getPlaybooks(filters?: { matchType?: string; featured?: boolean; limit?: number }) {
  const results = await db.select().from(playbook).where(eq(playbook.status, 'active')).orderBy(desc(playbook.totalSales));

  let filtered = results;
  if (filters?.matchType) filtered = filtered.filter((p) => p.matchType === filters.matchType);
  if (filters?.featured) filtered = filtered.filter((p) => p.featured);
  if (filters?.limit) filtered = filtered.slice(0, filters.limit);

  return filtered;
}

export async function getPlaybookRevenueStats() {
  const pbs = await db.select().from(playbook);
  const totalSales = pbs.reduce((sum, p) => sum + p.totalSales, 0);
  const totalRevenue = pbs.reduce((sum, p) => sum + p.totalRevenue, 0);

  return {
    totalPlaybooks: pbs.length,
    totalSales,
    totalVolume: totalRevenue,
    platformRevenue: totalRevenue * PLATFORM_FEE_PERCENT,
    avgPrice: pbs.length > 0 ? totalRevenue / Math.max(totalSales, 1) : 0,
  };
}
