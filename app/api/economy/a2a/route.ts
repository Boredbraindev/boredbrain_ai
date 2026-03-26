export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';
import { neon } from '@neondatabase/serverless';

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/**
 * GET /api/economy/a2a - List all A2A contracts / billing records
 * DB-first with mock fallback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') ?? undefined;

    // Try DB first
    try {
      const sql = neon(process.env.DATABASE_URL!);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const rowsPromise = agentId
        ? sql`SELECT * FROM billing_record WHERE caller_agent_id = ${agentId} OR provider_agent_id = ${agentId} ORDER BY timestamp DESC LIMIT 50`
        : sql`SELECT * FROM billing_record ORDER BY timestamp DESC LIMIT 50`;

      const rows = await Promise.race([rowsPromise, timeout]);

      if (rows.length > 0) {
        const contracts = rows.map((b: any) => ({
          id: b.id,
          hiringAgentId: b.caller_agent_id,
          hiredAgentId: b.provider_agent_id,
          task: `Billing: ${(b.tools_used as string[])?.join(', ') || 'agent call'}`,
          budget: b.total_cost,
          status: b.status,
          result: b.status === 'completed' ? 'Completed' : null,
          cost: b.total_cost,
          createdAt: new Date(b.timestamp).toISOString(),
          completedAt: b.status === 'completed' ? new Date(b.timestamp).toISOString() : null,
        }));

        return apiSuccess({ contracts });
      }
    } catch {
      // DB failed, fall through
    }

    // Fallback to mock
    const contracts = agentEconomy.getContracts(agentId);
    return apiSuccess({ contracts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch A2A contracts';
    return apiError(message, 500);
  }
}

const createContractSchema: Schema = {
  hiringAgentId: { type: 'string', required: true, maxLength: 100 },
  hiredAgentId: { type: 'string', required: true, maxLength: 100 },
  task: { type: 'string', required: true, maxLength: 500 },
  budget: { type: 'number', required: true, min: 0.01, max: 10000 },
};

/**
 * POST /api/economy/a2a - Create new A2A hire contract
 * Writes billing record to DB, falls back to in-memory
 * Body: { hiringAgentId, hiredAgentId, task, budget }
 */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { valid, errors, sanitized } = validateBody(
    parsed.data as Record<string, unknown>,
    createContractSchema,
  );

  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const { hiringAgentId, hiredAgentId, task, budget } = sanitized as {
    hiringAgentId: string;
    hiredAgentId: string;
    task: string;
    budget: number;
  };

  if (hiringAgentId === hiredAgentId) {
    return apiError('An agent cannot hire itself', 400);
  }

  try {
    // Try DB first
    try {
      const sql = neon(process.env.DATABASE_URL!);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const platformFee = +(budget * 0.2).toFixed(2);
      const providerEarning = +(budget - platformFee).toFixed(2);
      const toolsUsed = JSON.stringify([task]);

      const [record] = await Promise.race([
        sql`
          INSERT INTO billing_record (caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
          VALUES (${hiringAgentId}, ${hiredAgentId}, ${toolsUsed}::jsonb, ${budget}, ${platformFee}, ${providerEarning}, 'completed')
          RETURNING *
        `,
        timeout,
      ]);

      // Also record wallet transactions for both parties
      try {
        // Debit hiring agent
        const hiringWalletRows = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${hiringAgentId}`;
        const hiringBalance = hiringWalletRows.length > 0
          ? hiringWalletRows[0].balance - budget
          : -budget;

        await sql`
          INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
          VALUES (${generateId()}, ${hiringAgentId}, ${budget}, 'debit', ${'A2A hire: ' + task}, ${hiringBalance})
        `;

        // Credit hired agent
        const hiredWalletRows = await sql`SELECT * FROM agent_wallet WHERE agent_id = ${hiredAgentId}`;
        const hiredBalance = hiredWalletRows.length > 0
          ? hiredWalletRows[0].balance + providerEarning
          : providerEarning;

        await sql`
          INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
          VALUES (${generateId()}, ${hiredAgentId}, ${providerEarning}, 'credit', ${'A2A payment for: ' + task}, ${hiredBalance})
        `;
      } catch {
        // Wallet tx logging failed, billing record was still created
      }

      const contract = {
        id: record.id,
        hiringAgentId: record.caller_agent_id,
        hiredAgentId: record.provider_agent_id,
        task,
        budget: record.total_cost,
        status: record.status,
        result: 'Completed',
        cost: record.total_cost,
        createdAt: new Date(record.timestamp).toISOString(),
        completedAt: new Date(record.timestamp).toISOString(),
      };

      return apiSuccess({ contract }, 201);
    } catch {
      // DB failed, fall through to in-memory
    }

    // Fallback: in-memory mock
    const contract = agentEconomy.hireAgent(hiringAgentId, hiredAgentId, task, budget);
    return apiSuccess({ contract }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create A2A contract';
    return apiError(message, 500);
  }
}
