export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { agentDAO } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';

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
      const sql = neon(process.env.DATABASE_URL!);

      const proposalRows = await Promise.race([
        sql`SELECT * FROM dao_proposal WHERE id = ${proposalId} LIMIT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
      ]);

      if (proposalRows.length === 0) return apiError('Proposal not found', 404);
      const proposal = proposalRows[0];

      if (proposal.status !== 'active') return apiError('Proposal is not active');

      const options = proposal.options as Array<{ label: string; votes: number }>;
      if (optionIndex < 0 || optionIndex >= options.length) {
        return apiError('Invalid option index');
      }

      // Check duplicate vote
      const existingVoteRows = await Promise.race([
        sql`
          SELECT id FROM dao_vote
          WHERE proposal_id = ${proposalId} AND voter = ${voter}
          LIMIT 1
        `,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
      ]);

      if (existingVoteRows.length > 0) return apiError('Already voted on this proposal');

      // Insert vote
      await Promise.race([
        sql`
          INSERT INTO dao_vote (proposal_id, voter, option_index, weight)
          VALUES (${proposalId}, ${voter}, ${optionIndex}, ${weight})
        `,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
      ]);

      // Update proposal vote counts
      options[optionIndex].votes += weight;
      const newTotalVotes = Number(proposal.total_votes) + weight;

      await Promise.race([
        sql`
          UPDATE dao_proposal SET
            options = ${JSON.stringify(options)}::jsonb,
            total_votes = ${newTotalVotes}
          WHERE id = ${proposalId}
        `,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
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
      const sql = neon(process.env.DATABASE_URL!);

      const proposalRows = await Promise.race([
        sql`SELECT * FROM dao_proposal WHERE id = ${proposalId} LIMIT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 3000),
        ),
      ]);

      if (proposalRows.length > 0) {
        const row = proposalRows[0];

        const votes = await Promise.race([
          sql`SELECT * FROM dao_vote WHERE proposal_id = ${proposalId}`,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB timeout')), 3000),
          ),
        ]);

        const voters: Record<string, { optionIndex: number; weight: number }> = {};
        for (const v of votes) {
          voters[v.voter as string] = {
            optionIndex: Number(v.option_index),
            weight: Number(v.weight),
          };
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
            createdAt: row.created_at,
            endsAt: row.ends_at,
            totalVotes: row.total_votes,
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
