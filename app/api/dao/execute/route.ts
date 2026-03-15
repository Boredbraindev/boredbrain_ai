export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';

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
      const sql = neon(process.env.DATABASE_URL!);

      const proposalRows = await Promise.race([
        sql`SELECT * FROM dao_proposal WHERE id = ${proposalId} LIMIT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
      ]);

      if (proposalRows.length === 0) return apiError('Proposal not found', 404);
      const proposal = proposalRows[0];

      if (proposal.status !== 'passed') return apiError('Proposal must be passed to execute');

      const now = new Date().toISOString();
      await Promise.race([
        sql`
          UPDATE dao_proposal SET
            status = 'executed',
            executed_at = ${now}
          WHERE id = ${proposalId}
        `,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
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
