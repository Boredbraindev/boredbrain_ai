import { NextRequest } from 'next/server';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { daoProposal } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const executeSchema: Schema = {
  proposalId: { type: 'string', required: true, maxLength: 100 },
};

/**
 * POST /api/dao/execute - Execute a passed proposal
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      executeSchema,
    );
    if (!valid) return apiError(errors.join(', '));

    const proposalId = sanitized.proposalId as string;

    // Try DB first
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const [proposal] = await Promise.race([
        db.select().from(daoProposal).where(eq(daoProposal.id, proposalId)).limit(1),
        timeout,
      ]);

      if (!proposal) return apiError('Proposal not found', 404);
      if (proposal.status !== 'passed') return apiError('Proposal must be passed to execute');

      await Promise.race([
        db
          .update(daoProposal)
          .set({
            status: 'executed',
            executedAt: new Date(),
          })
          .where(eq(daoProposal.id, proposalId)),
        timeout,
      ]);

      return apiSuccess({ executed: true, proposalId });
    } catch {
      // DB failed, fall through
    }

    // Fallback to mock
    const result = agentDAO.executeProposal(proposalId);
    if (!result.success) return apiError(result.error || 'Execute failed');

    return apiSuccess({ executed: true, proposalId });
  } catch (err) {
    console.error('[POST /api/dao/execute] Error:', err);
    return apiError('Failed to execute proposal', 500);
  }
}
