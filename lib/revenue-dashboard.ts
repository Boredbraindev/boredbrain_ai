/**
 * Revenue Dashboard - Unified revenue aggregation across all streams.
 */

import { db } from '@/lib/db';
import { paymentTransaction, arenaEscrow, agentToken, agentTokenTrade, playbook, billingRecord } from '@/lib/db/schema';
import { sql, eq, desc, gte } from 'drizzle-orm';

export interface RevenueKPIs {
  totalRevenue: number;
  totalVolume: number;
  totalTransactions: number;
  dailyRevenue: number;
}

export interface RevenueStream {
  name: string;
  revenue: number;
  volume: number;
  transactions: number;
  percentage: number;
}

export interface RevenueDashboardData {
  kpis: RevenueKPIs;
  streams: RevenueStream[];
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    fee: number;
    timestamp: string;
    status: string;
  }>;
}

export async function getRevenueDashboard(): Promise<RevenueDashboardData> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Payment transactions
  const [paymentStats] = await db.select({
    totalVolume: sql<number>`coalesce(sum(${paymentTransaction.amount}), 0)`,
    totalFees: sql<number>`coalesce(sum(${paymentTransaction.platformFee}), 0)`,
    totalCount: sql<number>`count(*)`,
  }).from(paymentTransaction).where(eq(paymentTransaction.status, 'confirmed'));

  const [dailyStats] = await db.select({
    dailyRevenue: sql<number>`coalesce(sum(${paymentTransaction.platformFee}), 0)`,
  }).from(paymentTransaction).where(gte(paymentTransaction.timestamp, todayStart));

  // 2. Arena wagering
  const [arenaStats] = await db.select({
    totalRake: sql<number>`coalesce(sum(${arenaEscrow.platformRake}), 0)`,
    totalPool: sql<number>`coalesce(sum(${arenaEscrow.totalPool}), 0)`,
    matchCount: sql<number>`count(*)`,
  }).from(arenaEscrow).where(eq(arenaEscrow.status, 'settled'));

  // 3. Agent tokenization
  const [tokenStats] = await db.select({
    totalFees: sql<number>`coalesce(sum(${agentTokenTrade.platformFee}), 0)`,
    totalVolume: sql<number>`coalesce(sum(${agentTokenTrade.totalCost}), 0)`,
  }).from(agentTokenTrade);

  const tokenCount = await db.select({ count: sql<number>`count(*)` }).from(agentToken);
  const tokenizationFees = Number(tokenCount[0]?.count || 0) * 500;

  // 4. Playbook marketplace
  const [playbookStats] = await db.select({
    totalRevenue: sql<number>`coalesce(sum(${playbook.totalRevenue}), 0)`,
    totalSales: sql<number>`coalesce(sum(${playbook.totalSales}), 0)`,
  }).from(playbook);

  // 5. Inter-agent billing
  const [billingStats] = await db.select({
    totalFees: sql<number>`coalesce(sum(${billingRecord.platformFee}), 0)`,
    totalCost: sql<number>`coalesce(sum(${billingRecord.totalCost}), 0)`,
    totalCount: sql<number>`count(*)`,
  }).from(billingRecord);

  // Build streams
  const paymentRevenue = Number(paymentStats.totalFees);
  const arenaRevenue = Number(arenaStats.totalRake);
  const tokenRevenue = tokenizationFees + Number(tokenStats.totalFees);
  const playbookRevenue = Number(playbookStats.totalRevenue) * 0.15;
  const billingRevenue = Number(billingStats.totalFees);
  const totalRevenue = paymentRevenue + arenaRevenue + tokenRevenue + playbookRevenue + billingRevenue;

  const streams: RevenueStream[] = [
    { name: 'Tool Payments', revenue: paymentRevenue, volume: Number(paymentStats.totalVolume), transactions: Number(paymentStats.totalCount), percentage: totalRevenue > 0 ? (paymentRevenue / totalRevenue) * 100 : 0 },
    { name: 'Arena Wagering', revenue: arenaRevenue, volume: Number(arenaStats.totalPool), transactions: Number(arenaStats.matchCount), percentage: totalRevenue > 0 ? (arenaRevenue / totalRevenue) * 100 : 0 },
    { name: 'Agent Tokenization', revenue: tokenRevenue, volume: Number(tokenStats.totalVolume), transactions: Number(tokenCount[0]?.count || 0), percentage: totalRevenue > 0 ? (tokenRevenue / totalRevenue) * 100 : 0 },
    { name: 'Playbook Marketplace', revenue: playbookRevenue, volume: Number(playbookStats.totalRevenue), transactions: Number(playbookStats.totalSales), percentage: totalRevenue > 0 ? (playbookRevenue / totalRevenue) * 100 : 0 },
    { name: 'Inter-Agent Billing', revenue: billingRevenue, volume: Number(billingStats.totalCost), transactions: Number(billingStats.totalCount), percentage: totalRevenue > 0 ? (billingRevenue / totalRevenue) * 100 : 0 },
  ];

  // Recent transactions
  const recentRows = await db.select().from(paymentTransaction).orderBy(desc(paymentTransaction.timestamp)).limit(20);
  const recentTransactions = recentRows.map((r) => ({
    id: r.id, type: r.type, amount: r.amount, fee: r.platformFee, timestamp: r.timestamp.toISOString(), status: r.status,
  }));

  return {
    kpis: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalVolume: Math.round((Number(paymentStats.totalVolume) + Number(arenaStats.totalPool) + Number(tokenStats.totalVolume) + Number(playbookStats.totalRevenue) + Number(billingStats.totalCost)) * 100) / 100,
      totalTransactions: Number(paymentStats.totalCount) + Number(arenaStats.matchCount) + Number(playbookStats.totalSales) + Number(billingStats.totalCount),
      dailyRevenue: Math.round(Number(dailyStats.dailyRevenue) * 100) / 100,
    },
    streams,
    recentTransactions,
  };
}
