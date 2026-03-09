import { NextRequest } from 'next/server';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { daoProposal, daoVote } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dao/[proposalId] - Get proposal details
 * DB-first with mock fallback
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;

  try {
    // Try DB first
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const [rows, votes] = await Promise.race([
        Promise.all([
          db.select().from(daoProposal).where(eq(daoProposal.id, proposalId)),
          db.select().from(daoVote).where(eq(daoVote.proposalId, proposalId)),
        ]),
        timeout,
      ]);

      if (rows.length > 0) {
        const row = rows[0];
        const voters: Record<string, { optionIndex: number; weight: number }> = {};
        for (const v of votes) {
          voters[v.voter] = { optionIndex: v.optionIndex, weight: v.weight };
        }

        const proposal = {
          id: row.id,
          title: row.title,
          description: row.description,
          proposer: row.proposer,
          type: row.type,
          options: row.options as Array<{ label: string; votes: number }>,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          totalVotes: row.totalVotes,
          quorum: row.quorum,
          voters,
        };

        return apiSuccess({ proposal });
      }
    } catch {
      // DB failed, fall through
    }

    // Fallback to mock
    const proposal = agentDAO.getProposal(proposalId);
    if (!proposal) return apiError('Proposal not found', 404);

    return apiSuccess({ proposal });
  } catch (err) {
    console.error(`[GET /api/dao/${proposalId}] Error:`, err);
    return apiError('Failed to fetch proposal', 500);
  }
}

/**
 * POST /api/dao/[proposalId] - Vote on proposal
 * DB-first with mock fallback
 */
const voteSchema: Schema = {
  voter: { type: 'string', required: true, maxLength: 100 },
  optionIndex: { type: 'number', required: true, min: 0, max: 10 },
  weight: { type: 'number', required: true, min: 1, max: 10_000_000 },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;

  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      voteSchema,
    );
    if (!valid) return apiError(errors.join(', '));

    const voter = sanitized.voter as string;
    const optionIndex = sanitized.optionIndex as number;
    const weight = sanitized.weight as number;

    // Try DB first
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      // Fetch proposal from DB
      const rows = await Promise.race([
        db.select().from(daoProposal).where(eq(daoProposal.id, proposalId)),
        timeout,
      ]);

      if (rows.length > 0) {
        const row = rows[0];

        if (row.status !== 'active') {
          return apiError('Proposal is not active', 400);
        }

        const options = row.options as Array<{ label: string; votes: number }>;
        if (optionIndex < 0 || optionIndex >= options.length) {
          return apiError('Invalid option index', 400);
        }

        // Check for duplicate vote
        const existingVotes = await Promise.race([
          db
            .select()
            .from(daoVote)
            .where(and(eq(daoVote.proposalId, proposalId), eq(daoVote.voter, voter))),
          timeout,
        ]);

        if (existingVotes.length > 0) {
          return apiError('Already voted on this proposal', 400);
        }

        // Record the vote
        await Promise.race([
          db.insert(daoVote).values({
            proposalId,
            voter,
            optionIndex,
            weight,
          }),
          timeout,
        ]);

        // Update proposal tallies
        options[optionIndex].votes += weight;
        const newTotalVotes = row.totalVotes + weight;

        await Promise.race([
          db
            .update(daoProposal)
            .set({
              options,
              totalVotes: newTotalVotes,
            })
            .where(eq(daoProposal.id, proposalId)),
          timeout,
        ]);

        // Re-fetch all votes for the response
        const allVotes = await Promise.race([
          db.select().from(daoVote).where(eq(daoVote.proposalId, proposalId)),
          timeout,
        ]);

        const voters: Record<string, { optionIndex: number; weight: number }> = {};
        for (const v of allVotes) {
          voters[v.voter] = { optionIndex: v.optionIndex, weight: v.weight };
        }

        const proposal = {
          id: row.id,
          title: row.title,
          description: row.description,
          proposer: row.proposer,
          type: row.type,
          options,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          totalVotes: newTotalVotes,
          quorum: row.quorum,
          voters,
        };

        return apiSuccess({ proposal });
      }
    } catch {
      // DB failed, fall through to mock
    }

    // Fallback to mock
    const result = agentDAO.vote(proposalId, voter, optionIndex, weight);

    if (!result.success) return apiError(result.error!, 400);

    return apiSuccess({ proposal: result.proposal });
  } catch (err) {
    console.error(`[POST /api/dao/${proposalId}] Error:`, err);
    return apiError('Failed to cast vote', 500);
  }
}
