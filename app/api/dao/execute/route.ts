import { NextRequest } from 'next/server';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { daoProposal, daoVote } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dao/execute - Execute a passed proposal
 * DB-first with mock fallback
 */
const executeSchema: Schema = {
  proposalId: { type: 'string', required: true, maxLength: 100 },
};

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

      const rows = await Promise.race([
        db.select().from(daoProposal).where(eq(daoProposal.id, proposalId)),
        timeout,
      ]);

      if (rows.length > 0) {
        const row = rows[0];

        if (row.status !== 'passed') {
          return apiError('Proposal must be passed to execute', 400);
        }

        // Update status to executed
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

        // Re-fetch updated proposal
        const [updated] = await Promise.race([
          db.select().from(daoProposal).where(eq(daoProposal.id, proposalId)),
          timeout,
        ]);

        // Fetch votes for response
        const votes = await Promise.race([
          db.select().from(daoVote).where(eq(daoVote.proposalId, proposalId)),
          timeout,
        ]);

        const voters: Record<string, { optionIndex: number; weight: number }> = {};
        for (const v of votes) {
          voters[v.voter] = { optionIndex: v.optionIndex, weight: v.weight };
        }

        const proposal = {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          proposer: updated.proposer,
          type: updated.type,
          options: updated.options as Array<{ label: string; votes: number }>,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
          endsAt: updated.endsAt.toISOString(),
          totalVotes: updated.totalVotes,
          quorum: updated.quorum,
          executedAt: updated.executedAt?.toISOString() ?? null,
          voters,
        };

        return apiSuccess({ proposal, message: 'Proposal executed successfully' });
      }
    } catch {
      // DB failed, fall through to mock
    }

    // Fallback to mock
    const result = agentDAO.executeProposal(proposalId);

    if (!result.success) return apiError(result.error!, 400);

    const proposal = agentDAO.getProposal(proposalId);
    return apiSuccess({ proposal, message: 'Proposal executed successfully' });
  } catch (err) {
    console.error('[POST /api/dao/execute] Error:', err);
    return apiError('Failed to execute proposal', 500);
  }
}
