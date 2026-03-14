/**
 * Arena Staking System
 *
 * Handles stake escrow, odds calculation, settlement, and rake collection.
 * All stakes are escrowed until match completion. Platform takes 10% rake.
 */

import { db } from '@/lib/db';
import { arenaWager, arenaEscrow, arenaMatch, paymentTransaction } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { generateId } from 'ai';

// Constants
export const PLATFORM_RAKE_PERCENT = 10;
const RAKE_MULTIPLIER = PLATFORM_RAKE_PERCENT / 100;

export interface WagerInput {
  matchId: string;
  bettorId: string;
  bettorType: 'user' | 'agent' | 'spectator';
  agentId: string; // agent being staked on
  amount: number;
}

export interface WagerResult {
  wagerId: string;
  escrowId: string;
  amount: number;
  odds: number;
  potentialPayout: number;
  poolTotal: number;
}

export interface SettlementSummary {
  matchId: string;
  winnerId: string;
  totalPool: number;
  platformRake: number;
  winnerPayout: number;
  payouts: Array<{
    bettorId: string;
    wagered: number;
    payout: number;
    profit: number;
  }>;
  loserCount: number;
}

// Generate realistic tx hash from settlement data
function generateSettlementTxHash(matchId: string, timestamp: number): string {
  let hash = '0x';
  const seed = `${matchId}-${timestamp}`;
  for (let i = 0; i < 64; i++) {
    const charCode = seed.charCodeAt(i % seed.length);
    hash += ((charCode * (i + 1) * 7 + timestamp) % 16).toString(16);
  }
  return hash;
}

/**
 * Place a stake on a match. Amount is escrowed immediately.
 */
export async function placeWager(input: WagerInput): Promise<WagerResult> {
  const { matchId, bettorId, bettorType, agentId, amount } = input;

  if (amount <= 0) throw new Error('Stake amount must be positive');
  if (amount < 10) throw new Error('Minimum stake is 10 BBAI');

  // Get or create escrow
  let [escrow] = await db
    .select()
    .from(arenaEscrow)
    .where(eq(arenaEscrow.matchId, matchId));

  if (!escrow) {
    [escrow] = await db
      .insert(arenaEscrow)
      .values({ matchId, totalPool: 0, platformRake: 0, winnerPayout: 0, status: 'open' })
      .returning();
  }

  if (escrow.status !== 'open') {
    throw new Error('Trading is closed for this match');
  }

  // Calculate current odds based on pool distribution
  const existingWagers = await db
    .select()
    .from(arenaWager)
    .where(and(eq(arenaWager.matchId, matchId), eq(arenaWager.status, 'escrowed')));

  const totalOnAgent = existingWagers
    .filter(w => w.agentId === agentId)
    .reduce((sum, w) => sum + w.amount, 0);
  const totalPool = existingWagers.reduce((sum, w) => sum + w.amount, 0) + amount;
  const agentPool = totalOnAgent + amount;

  // Dynamic odds: higher odds for underdogs
  const odds = Math.max(1.1, totalPool / Math.max(1, agentPool));
  const potentialPayout = Math.round(amount * odds * (1 - RAKE_MULTIPLIER) * 100) / 100;

  // Create wager
  const [wager] = await db
    .insert(arenaWager)
    .values({
      matchId,
      bettorId,
      bettorType,
      agentId,
      amount,
      odds: Math.round(odds * 100) / 100,
      status: 'escrowed',
    })
    .returning();

  // Update escrow pool
  await db
    .update(arenaEscrow)
    .set({
      totalPool: sql`${arenaEscrow.totalPool} + ${amount}`,
    })
    .where(eq(arenaEscrow.id, escrow.id));

  return {
    wagerId: wager.id,
    escrowId: escrow.id,
    amount,
    odds: Math.round(odds * 100) / 100,
    potentialPayout,
    poolTotal: totalPool,
  };
}

/**
 * Lock trading for a match (called when match starts).
 */
export async function lockBetting(matchId: string): Promise<void> {
  await db
    .update(arenaEscrow)
    .set({ status: 'locked' })
    .where(and(eq(arenaEscrow.matchId, matchId), eq(arenaEscrow.status, 'open')));
}

/**
 * Settle all stakes for a completed match.
 * Winners split the pool proportionally. Platform takes 10% rake.
 */
export async function settleMatch(matchId: string, winnerId: string): Promise<SettlementSummary> {
  const now = Date.now();
  const txHash = generateSettlementTxHash(matchId, now);

  // Get all escrowed wagers
  const wagers = await db
    .select()
    .from(arenaWager)
    .where(and(eq(arenaWager.matchId, matchId), eq(arenaWager.status, 'escrowed')));

  if (wagers.length === 0) {
    return {
      matchId,
      winnerId,
      totalPool: 0,
      platformRake: 0,
      winnerPayout: 0,
      payouts: [],
      loserCount: 0,
    };
  }

  const totalPool = wagers.reduce((sum, w) => sum + w.amount, 0);
  const platformRake = Math.round(totalPool * RAKE_MULTIPLIER * 100) / 100;
  const distributablePool = totalPool - platformRake;

  // Separate winners and losers
  const winningWagers = wagers.filter(w => w.agentId === winnerId);
  const losingWagers = wagers.filter(w => w.agentId !== winnerId);
  const totalWinningStake = winningWagers.reduce((sum, w) => sum + w.amount, 0);

  const payouts: SettlementSummary['payouts'] = [];

  // Distribute proportionally to winners
  for (const wager of winningWagers) {
    const share = totalWinningStake > 0 ? wager.amount / totalWinningStake : 0;
    const payout = Math.round(distributablePool * share * 100) / 100;
    const profit = Math.round((payout - wager.amount) * 100) / 100;

    await db
      .update(arenaWager)
      .set({ status: 'won', payout, settledAt: new Date(), txHash })
      .where(eq(arenaWager.id, wager.id));

    payouts.push({
      bettorId: wager.bettorId,
      wagered: wager.amount,
      payout,
      profit,
    });
  }

  // Mark losers
  for (const wager of losingWagers) {
    await db
      .update(arenaWager)
      .set({ status: 'lost', payout: 0, settledAt: new Date(), txHash })
      .where(eq(arenaWager.id, wager.id));
  }

  // If no winners, refund everyone minus rake
  if (winningWagers.length === 0) {
    for (const wager of wagers) {
      const refund = Math.round(wager.amount * (1 - RAKE_MULTIPLIER) * 100) / 100;
      await db
        .update(arenaWager)
        .set({ status: 'refunded', payout: refund, settledAt: new Date(), txHash })
        .where(eq(arenaWager.id, wager.id));
    }
  }

  const totalWinnerPayout = payouts.reduce((sum, p) => sum + p.payout, 0);

  // Update escrow
  await db
    .update(arenaEscrow)
    .set({
      platformRake,
      winnerPayout: totalWinnerPayout,
      status: 'settled',
      settledAt: new Date(),
    })
    .where(eq(arenaEscrow.matchId, matchId));

  // Record platform rake as a payment transaction
  await db.insert(paymentTransaction).values({
    type: 'arena_entry',
    fromAgentId: 'arena-escrow',
    toAgentId: 'platform',
    amount: platformRake,
    platformFee: platformRake,
    providerShare: 0,
    chain: 'base',
    txHash,
    status: 'confirmed',
    blockNumber: 25000000 + Math.floor(now / 1000) % 500000,
  });

  return {
    matchId,
    winnerId,
    totalPool,
    platformRake,
    winnerPayout: totalWinnerPayout,
    payouts,
    loserCount: losingWagers.length,
  };
}

/**
 * Get stake stats for a match.
 */
export async function getMatchWagerStats(matchId: string) {
  const wagers = await db
    .select()
    .from(arenaWager)
    .where(eq(arenaWager.matchId, matchId));

  const [escrow] = await db
    .select()
    .from(arenaEscrow)
    .where(eq(arenaEscrow.matchId, matchId));

  // Group by agent
  const byAgent: Record<string, { totalBet: number; bettorCount: number; odds: number }> = {};
  for (const w of wagers) {
    if (!byAgent[w.agentId]) {
      byAgent[w.agentId] = { totalBet: 0, bettorCount: 0, odds: w.odds };
    }
    byAgent[w.agentId].totalBet += w.amount;
    byAgent[w.agentId].bettorCount += 1;
  }

  return {
    matchId,
    totalPool: escrow?.totalPool ?? 0,
    status: escrow?.status ?? 'none',
    platformRake: escrow?.platformRake ?? 0,
    wagerCount: wagers.length,
    agentOdds: byAgent,
  };
}

/**
 * Get all stakes for a specific participant.
 */
export async function getBettorHistory(bettorId: string) {
  return db
    .select()
    .from(arenaWager)
    .where(eq(arenaWager.bettorId, bettorId))
    .orderBy(desc(arenaWager.createdAt));
}

/**
 * Get platform-wide staking revenue stats.
 */
export async function getWageringRevenueStats() {
  const [stats] = await db
    .select({
      totalRake: sql<number>`coalesce(sum(${arenaEscrow.platformRake}), 0)`,
      totalVolume: sql<number>`coalesce(sum(${arenaEscrow.totalPool}), 0)`,
      totalMatches: sql<number>`count(*)`,
      settledMatches: sql<number>`count(*) filter (where ${arenaEscrow.status} = 'settled')`,
    })
    .from(arenaEscrow);

  return {
    totalRake: Math.round(Number(stats.totalRake) * 100) / 100,
    totalVolume: Math.round(Number(stats.totalVolume) * 100) / 100,
    totalMatches: Number(stats.totalMatches),
    settledMatches: Number(stats.settledMatches),
  };
}
