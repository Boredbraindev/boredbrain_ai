import { db } from '@/lib/db';
import { agentWallet } from '@/lib/db/schema';
import { sql, lte } from 'drizzle-orm';
import { topUpWallet, createAgentWallet, getAgentWallet } from '@/lib/agent-wallet';

/**
 * Get agent wallets with balance below the given threshold.
 */
export async function getRebalanceCandidates(threshold = 50) {
  return db
    .select()
    .from(agentWallet)
    .where(lte(agentWallet.balance, threshold));
}

/**
 * Top up low-balance wallets to the target amount.
 * Processes at most `maxPerRun` wallets per invocation.
 */
export async function rebalanceWallets(target = 200, maxPerRun = 10) {
  const candidates = await getRebalanceCandidates();
  const toProcess = candidates.slice(0, maxPerRun);

  let totalInjected = 0;
  const agents: string[] = [];

  for (const wallet of toProcess) {
    const diff = target - wallet.balance;
    if (diff <= 0) continue;

    await topUpWallet(wallet.agentId, diff);
    totalInjected += diff;
    agents.push(wallet.agentId);
  }

  return { rebalanced: agents.length, totalInjected, agents };
}

/**
 * Ensure every agent in the list has a wallet; create one if missing.
 */
export async function ensureWalletsExist(agentIds: string[]) {
  for (const agentId of agentIds) {
    const existing = await getAgentWallet(agentId);
    if (!existing) {
      await createAgentWallet(agentId);
    }
  }
}
