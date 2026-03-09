import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { agentEconomy } from '@/lib/agent-economy';
import { db } from '@/lib/db';
import { billingRecord, walletTransaction, agentWallet } from '@/lib/db/schema';
import { eq, or, desc } from 'drizzle-orm';

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
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      let query = db.select().from(billingRecord).$dynamic();
      if (agentId) {
        query = query.where(
          or(
            eq(billingRecord.callerAgentId, agentId),
            eq(billingRecord.providerAgentId, agentId),
          ),
        );
      }
      query = query.orderBy(desc(billingRecord.timestamp)).limit(50);

      const rows = await Promise.race([query, timeout]);

      if (rows.length > 0) {
        const contracts = rows.map((b: any) => ({
          id: b.id,
          hiringAgentId: b.callerAgentId,
          hiredAgentId: b.providerAgentId,
          task: `Billing: ${(b.toolsUsed as string[]).join(', ') || 'agent call'}`,
          budget: b.totalCost,
          status: b.status,
          result: b.status === 'completed' ? 'Completed' : null,
          cost: b.totalCost,
          createdAt: b.timestamp.toISOString(),
          completedAt: b.status === 'completed' ? b.timestamp.toISOString() : null,
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
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const platformFee = +(budget * 0.2).toFixed(2);
      const providerEarning = +(budget - platformFee).toFixed(2);

      const [record] = await Promise.race([
        db
          .insert(billingRecord)
          .values({
            callerAgentId: hiringAgentId,
            providerAgentId: hiredAgentId,
            toolsUsed: [task],
            totalCost: budget,
            platformFee,
            providerEarning,
            status: 'completed',
          })
          .returning(),
        timeout,
      ]);

      // Also record wallet transactions for both parties
      try {
        // Debit hiring agent
        const hiringWalletRows = await db
          .select()
          .from(agentWallet)
          .where(eq(agentWallet.agentId, hiringAgentId));

        const hiringBalance = hiringWalletRows.length > 0
          ? hiringWalletRows[0].balance - budget
          : -budget;

        await db.insert(walletTransaction).values({
          agentId: hiringAgentId,
          amount: budget,
          type: 'debit',
          reason: `A2A hire: ${task}`,
          balanceAfter: hiringBalance,
        });

        // Credit hired agent
        const hiredWalletRows = await db
          .select()
          .from(agentWallet)
          .where(eq(agentWallet.agentId, hiredAgentId));

        const hiredBalance = hiredWalletRows.length > 0
          ? hiredWalletRows[0].balance + providerEarning
          : providerEarning;

        await db.insert(walletTransaction).values({
          agentId: hiredAgentId,
          amount: providerEarning,
          type: 'credit',
          reason: `A2A payment for: ${task}`,
          balanceAfter: hiredBalance,
        });
      } catch {
        // Wallet tx logging failed, billing record was still created
      }

      const contract = {
        id: record.id,
        hiringAgentId: record.callerAgentId,
        hiredAgentId: record.providerAgentId,
        task,
        budget: record.totalCost,
        status: record.status,
        result: 'Completed',
        cost: record.totalCost,
        createdAt: record.timestamp.toISOString(),
        completedAt: record.timestamp.toISOString(),
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
