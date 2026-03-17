import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/agents/spending-limit?agentId=xxx
// Returns the autonomous spending limit config for an agent
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    if (!agentId) return apiError('agentId is required', 400);

    const sql = neon(process.env.DATABASE_URL!);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const rows = await Promise.race([
      sql`
        SELECT
          agent_id,
          spending_limit_daily,
          spent_today,
          auto_spend_enabled,
          last_reset_date,
          balance
        FROM agent_wallet
        WHERE agent_id = ${agentId}
        LIMIT 1
      `,
      timeout,
    ]);

    if (!rows || rows.length === 0) {
      return apiError('Agent wallet not found', 404);
    }

    const row = rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const spentToday = row.last_reset_date === today ? Number(row.spent_today ?? 0) : 0;

    return apiSuccess({
      agentId: row.agent_id,
      spendingLimitDaily: Number(row.spending_limit_daily ?? 0),
      spentToday,
      autoSpendEnabled: row.auto_spend_enabled === true,
      lastResetDate: row.last_reset_date,
      balance: Number(row.balance ?? 0),
    });
  } catch (err) {
    console.error('[spending-limit GET]', err);
    return apiError('Failed to fetch spending limit', 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/agents/spending-limit
// Set the autonomous spending limit for an agent
// Body: { agentId, dailyLimit, enabled, walletAddress }
// Validates that walletAddress owns the agent
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody<{
      agentId: string;
      dailyLimit: number;
      enabled: boolean;
      walletAddress: string;
    }>(request);

    if ('error' in parsed) return parsed.error;

    const { agentId, dailyLimit, enabled, walletAddress } = parsed.data;

    if (!agentId || typeof agentId !== 'string') {
      return apiError('agentId is required', 400);
    }
    if (!walletAddress || typeof walletAddress !== 'string') {
      return apiError('walletAddress is required for ownership verification', 400);
    }
    if (typeof dailyLimit !== 'number' || !Number.isFinite(dailyLimit) || dailyLimit < 0) {
      return apiError('dailyLimit must be a non-negative number', 400);
    }
    if (dailyLimit > 10000) {
      return apiError('dailyLimit cannot exceed 10,000 BBAI', 400);
    }
    if (typeof enabled !== 'boolean') {
      return apiError('enabled must be a boolean', 400);
    }

    const sql = neon(process.env.DATABASE_URL!);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    // Verify ownership: the walletAddress must be the ownerAddress of the agent
    const agentRows = await Promise.race([
      sql`
        SELECT id, owner_address
        FROM external_agent
        WHERE id = ${agentId}
        LIMIT 1
      `,
      timeout,
    ]);

    if (!agentRows || agentRows.length === 0) {
      return apiError('Agent not found', 404);
    }

    const agent = agentRows[0];
    const ownerMatch =
      agent.owner_address?.toLowerCase() === walletAddress.toLowerCase() ||
      agent.owner_address === 'platform-fleet'; // platform-fleet agents can be configured by anyone for now

    if (!ownerMatch) {
      return apiError('You do not own this agent', 403);
    }

    // Update the spending limit — use ALTER TABLE ADD COLUMN IF NOT EXISTS pattern
    // to handle the case where columns don't exist yet in the DB
    try {
      await Promise.race([
        sql`
          ALTER TABLE agent_wallet
          ADD COLUMN IF NOT EXISTS spending_limit_daily REAL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS spent_today REAL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS auto_spend_enabled BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS last_reset_date TEXT
        `,
        timeout,
      ]);
    } catch {
      // Columns may already exist, that's fine
    }

    // Update the wallet
    const updated = await Promise.race([
      sql`
        UPDATE agent_wallet
        SET
          spending_limit_daily = ${dailyLimit},
          auto_spend_enabled = ${enabled}
        WHERE agent_id = ${agentId}
        RETURNING agent_id, spending_limit_daily, spent_today, auto_spend_enabled, last_reset_date, balance
      `,
      timeout,
    ]);

    if (!updated || updated.length === 0) {
      return apiError('Agent wallet not found. Create a wallet first.', 404);
    }

    const row = updated[0];
    return apiSuccess({
      agentId: row.agent_id,
      spendingLimitDaily: Number(row.spending_limit_daily ?? 0),
      spentToday: Number(row.spent_today ?? 0),
      autoSpendEnabled: row.auto_spend_enabled === true,
      balance: Number(row.balance ?? 0),
      message: `Spending limit ${enabled ? 'enabled' : 'disabled'}: ${dailyLimit} BBAI/day`,
    });
  } catch (err) {
    console.error('[spending-limit POST]', err);
    return apiError('Failed to update spending limit', 500);
  }
}
