/**
 * Agent Autonomous Spending System (Web 4.0)
 *
 * Allows agents to spend BBAI autonomously within user-configured daily limits.
 * Uses raw neon() SQL for edge-runtime compatibility.
 */

import { neon } from '@neondatabase/serverless';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToday(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), ms),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpendingStatus {
  agentId: string;
  autoSpendEnabled: boolean;
  spendingLimitDaily: number;
  spentToday: number;
  remainingToday: number;
  balance: number;
}

// ---------------------------------------------------------------------------
// canAgentAutoSpend
// ---------------------------------------------------------------------------

/**
 * Check if an agent can autonomously spend a given amount.
 *
 * 1. Verifies auto_spend_enabled is true
 * 2. Resets spent_today if last_reset_date != today
 * 3. Checks spent_today + amount <= spending_limit_daily
 * 4. Checks balance >= amount
 */
export async function canAgentAutoSpend(
  agentId: string,
  amount: number,
): Promise<boolean> {
  try {
    const sql = getSql();
    const today = getToday();

    const rows = await withTimeout(
      sql`
        SELECT
          auto_spend_enabled,
          spending_limit_daily,
          spent_today,
          last_reset_date,
          balance
        FROM agent_wallet
        WHERE agent_id = ${agentId}
        LIMIT 1
      `,
    );

    if (!rows || rows.length === 0) return false;

    const wallet = rows[0];

    // Must be enabled
    if (!wallet.auto_spend_enabled) return false;

    const limit = Number(wallet.spending_limit_daily ?? 0);
    if (limit <= 0) return false;

    // Reset spent_today if new day
    let spentToday = Number(wallet.spent_today ?? 0);
    if (wallet.last_reset_date !== today) {
      spentToday = 0;
      // Reset in DB
      await withTimeout(
        sql`
          UPDATE agent_wallet
          SET spent_today = 0, last_reset_date = ${today}
          WHERE agent_id = ${agentId}
        `,
      );
    }

    // Check daily limit
    if (spentToday + amount > limit) return false;

    // Check balance
    const balance = Number(wallet.balance ?? 0);
    if (balance < amount) return false;

    return true;
  } catch (err) {
    console.error('[agent-spending] canAgentAutoSpend error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// getSpendingStatus
// ---------------------------------------------------------------------------

/**
 * Get the current spending status for an agent.
 */
export async function getSpendingStatus(
  agentId: string,
): Promise<SpendingStatus | null> {
  try {
    const sql = getSql();
    const today = getToday();

    const rows = await withTimeout(
      sql`
        SELECT
          agent_id,
          auto_spend_enabled,
          spending_limit_daily,
          spent_today,
          last_reset_date,
          balance
        FROM agent_wallet
        WHERE agent_id = ${agentId}
        LIMIT 1
      `,
    );

    if (!rows || rows.length === 0) return null;

    const w = rows[0];
    const limit = Number(w.spending_limit_daily ?? 0);
    const spentToday = w.last_reset_date === today ? Number(w.spent_today ?? 0) : 0;

    return {
      agentId: w.agent_id as string,
      autoSpendEnabled: w.auto_spend_enabled === true,
      spendingLimitDaily: limit,
      spentToday,
      remainingToday: Math.max(0, limit - spentToday),
      balance: Number(w.balance ?? 0),
    };
  } catch (err) {
    console.error('[agent-spending] getSpendingStatus error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// recordAgentSpend
// ---------------------------------------------------------------------------

/**
 * Record an autonomous agent spend.
 *
 * 1. Verify canAgentAutoSpend
 * 2. Deduct from agent wallet balance (optimistic concurrency)
 * 3. Increment spent_today
 * 4. Create wallet_transaction record
 * 5. Return success/failure
 */
export async function recordAgentSpend(
  agentId: string,
  amount: number,
  reason: string,
): Promise<{ success: boolean; remaining: number; txId: string }> {
  try {
    if (amount <= 0) {
      return { success: false, remaining: 0, txId: '' };
    }

    const canSpend = await canAgentAutoSpend(agentId, amount);
    if (!canSpend) {
      return { success: false, remaining: 0, txId: '' };
    }

    const sql = getSql();
    const today = getToday();

    // Deduct balance and increment spent_today atomically
    // Uses balance >= amount guard for optimistic concurrency
    const updated = await withTimeout(
      sql`
        UPDATE agent_wallet
        SET
          balance = balance - ${amount},
          total_spent = total_spent + ${amount},
          spent_today = CASE
            WHEN last_reset_date = ${today} THEN spent_today + ${amount}
            ELSE ${amount}
          END,
          last_reset_date = ${today}
        WHERE agent_id = ${agentId}
          AND balance >= ${amount}
          AND auto_spend_enabled = true
        RETURNING agent_id, balance
      `,
    );

    if (!updated || updated.length === 0) {
      return { success: false, remaining: 0, txId: '' };
    }

    const newBalance = Number(updated[0].balance ?? 0);

    // Record wallet transaction
    const txId = `tx-auto-${agentId}-${Date.now()}`;
    await withTimeout(
      sql`
        INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
        VALUES (${txId}, ${agentId}, ${amount}, 'debit', ${`[auto-spend] ${reason}`}, ${newBalance})
      `,
    );

    console.log(
      `[agent-spending] Agent ${agentId} auto-spent ${amount} BBAI: ${reason} (remaining: ${newBalance})`,
    );

    return { success: true, remaining: newBalance, txId };
  } catch (err) {
    console.error('[agent-spending] recordAgentSpend error:', err);
    return { success: false, remaining: 0, txId: '' };
  }
}

// ---------------------------------------------------------------------------
// resetDailySpending (for cron use)
// ---------------------------------------------------------------------------

/**
 * Reset spent_today for all agents whose last_reset_date is not today.
 * Intended to be called from a daily cron or at heartbeat time.
 */
export async function resetDailySpending(): Promise<number> {
  try {
    const sql = getSql();
    const today = getToday();

    const result = await withTimeout(
      sql`
        UPDATE agent_wallet
        SET spent_today = 0, last_reset_date = ${today}
        WHERE last_reset_date IS DISTINCT FROM ${today}
          AND auto_spend_enabled = true
        RETURNING agent_id
      `,
    );

    return result?.length ?? 0;
  } catch (err) {
    console.error('[agent-spending] resetDailySpending error:', err);
    return 0;
  }
}
