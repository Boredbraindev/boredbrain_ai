import { NextRequest } from 'next/server';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { daoProposal, daoVote } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const voteSchema: Schema = {
  voter: { type: 'string', required: true, maxLength: 100 },
  optionIndex: { type: 'number', required: true },
  weight: { type: 'number', required: true },
};

/**
 * POST /api/dao/[proposalId] - Vote on a proposal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  try {
    const { proposalId } = await params;

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

    if (weight <= 0) return apiError('Weight must be positive');

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
      if (proposal.status !== 'active') return apiError('Proposal is not active');

      const options = proposal.options as Array<{ label: string; votes: number }>;
      if (optionIndex < 0 || optionIndex >= options.length) {
        return apiError('Invalid option index');
      }

      // Check duplicate vote
      const [existingVote] = await Promise.race([
        db
          .select()
          .from(daoVote)
          .where(and(eq(daoVote.proposalId, proposalId), eq(daoVote.voter, voter)))
          .limit(1),
        timeout,
      ]);

      if (existingVote) return apiError('Already voted on this proposal');

      // Insert vote
      await Promise.race([
        db.insert(daoVote).values({
          proposalId,
          voter,
          optionIndex,
          weight,
        }),
        timeout,
      ]);

      // Update proposal vote counts
      options[optionIndex].votes += weight;
      const newTotalVotes = proposal.totalVotes + weight;

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

      return apiSuccess({ voted: true, proposalId, optionIndex, weight });
    } catch {
      // DB failed, fall through to in-memory
    }

    // Fallback to mock
    const result = agentDAO.vote(proposalId, voter, optionIndex, weight);
    if (!result.success) return apiError(result.error || 'Vote failed');

    return apiSuccess({ voted: true, proposalId, optionIndex, weight });
  } catch (err) {
    console.error('[POST /api/dao/[proposalId]] Error:', err);
    return apiError('Failed to vote', 500);
  }
}

/**
 * GET /api/dao/[proposalId] - Get single proposal details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  try {
    const { proposalId } = await params;

    // Try DB first
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const [row] = await Promise.race([
        db.select().from(daoProposal).where(eq(daoProposal.id, proposalId)).limit(1),
        timeout,
      ]);

      if (row) {
        const votes = await Promise.race([
          db.select().from(daoVote).where(eq(daoVote.proposalId, proposalId)),
          timeout,
        ]);

        const voters: Record<string, { optionIndex: number; weight: number }> = {};
        for (const v of votes) {
          voters[v.voter] = { optionIndex: v.optionIndex, weight: v.weight };
        }

        return apiSuccess({
          proposal: {
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
          },
        });
      }
    } catch {
      // fall through
    }

    // Fallback
    const proposal = agentDAO.getProposal(proposalId);
    if (!proposal) return apiError('Proposal not found', 404);

    return apiSuccess({ proposal });
  } catch (err) {
    console.error('[GET /api/dao/[proposalId]] Error:', err);
    return apiError('Failed to fetch proposal', 500);
  }
}
