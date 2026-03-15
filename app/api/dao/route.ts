export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { agentDAO, type ProposalStatus, type ProposalType } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dao - List proposals + governance stats
 * DB-first with mock fallback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ProposalStatus | null;

    // Try DB first
    try {
      const sql = neon(process.env.DATABASE_URL!);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const rowsPromise = status
        ? sql`SELECT * FROM dao_proposal WHERE status = ${status} ORDER BY created_at DESC`
        : sql`SELECT * FROM dao_proposal ORDER BY created_at DESC`;

      const statsPromise = sql`
        SELECT
          count(*) as total_proposals,
          count(*) filter (where status = 'active') as active_proposals,
          count(*) filter (where status = 'passed') as passed_proposals,
          count(*) filter (where status = 'rejected') as rejected_proposals,
          count(*) filter (where status = 'executed') as executed_proposals
        FROM dao_proposal
      `;

      const [rows, statsResult] = await Promise.race([
        Promise.all([rowsPromise, statsPromise]),
        timeout,
      ]);

      if (rows.length > 0) {
        // Fetch voter counts for participation rate
        const voterCount = await Promise.race([
          sql`SELECT count(distinct voter) as count FROM dao_vote`,
          timeout,
        ]);

        const totalVoters = Number(voterCount[0]?.count ?? 0);
        const s = statsResult[0];

        // Build proposals with voters map from dao_vote table
        const proposalIds = rows.map((r: any) => r.id);
        const allVotes = await Promise.race([
          sql`SELECT * FROM dao_vote WHERE proposal_id = ANY(${proposalIds})`,
          timeout,
        ]);

        // Group votes by proposalId
        const votesByProposal = new Map<string, Array<any>>();
        for (const v of allVotes) {
          const arr = votesByProposal.get(v.proposal_id) ?? [];
          arr.push(v);
          votesByProposal.set(v.proposal_id, arr);
        }

        const proposals = rows.map((row: any) => {
          const votes = votesByProposal.get(row.id) ?? [];
          const voters: Record<string, { optionIndex: number; weight: number }> = {};
          for (const v of votes) {
            voters[v.voter] = { optionIndex: v.option_index, weight: v.weight };
          }

          return {
            id: row.id,
            title: row.title,
            description: row.description,
            proposer: row.proposer,
            type: row.type,
            options: row.options as Array<{ label: string; votes: number }>,
            status: row.status,
            createdAt: new Date(row.created_at).toISOString(),
            endsAt: new Date(row.ends_at).toISOString(),
            totalVotes: row.total_votes,
            quorum: row.quorum,
            voters,
          };
        });

        const stats = {
          totalProposals: Number(s.total_proposals),
          activeProposals: Number(s.active_proposals),
          passedProposals: Number(s.passed_proposals),
          rejectedProposals: Number(s.rejected_proposals),
          executedProposals: Number(s.executed_proposals),
          participationRate: Math.round((totalVoters / Math.max(totalVoters, 15)) * 100),
          averageQuorumAchievement: 0,
          treasury: {
            total: 2_450_000,
            allocated: 385_000,
            available: 2_065_000,
          },
        };

        return apiSuccess({ proposals, stats });
      }
    } catch {
      // DB failed, fall through to mock
    }

    // Fallback to mock data
    const proposals = agentDAO.getProposals(status ?? undefined);
    const stats = agentDAO.getGovernanceStats();

    return apiSuccess({ proposals, stats });
  } catch (err) {
    console.error('[GET /api/dao] Error:', err);
    return apiError('Failed to fetch DAO data', 500);
  }
}

/**
 * POST /api/dao - Create new proposal
 * Writes to DB, falls back to in-memory mock
 */
const createProposalSchema: Schema = {
  title: { type: 'string', required: true, maxLength: 200 },
  description: { type: 'string', required: true, maxLength: 2000 },
  proposer: { type: 'string', required: true, maxLength: 100 },
  type: {
    type: 'string',
    required: true,
    enum: [
      'parameter_change',
      'treasury_spend',
      'skill_approval',
      'agent_ban',
      'protocol_upgrade',
      'fee_adjustment',
    ] as const,
  },
  options: { type: 'array', required: true },
};

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      createProposalSchema,
    );
    if (!valid) return apiError(errors.join(', '));

    const optionsArr = sanitized.options as string[];
    if (!Array.isArray(optionsArr) || optionsArr.length < 2) {
      return apiError('At least 2 options are required');
    }

    const title = sanitized.title as string;
    const description = sanitized.description as string;
    const proposer = sanitized.proposer as string;
    const type = sanitized.type as ProposalType;

    // Try DB first
    try {
      const sql = neon(process.env.DATABASE_URL!);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const now = new Date();
      const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const optionsJson = JSON.stringify(optionsArr.map((label) => ({ label, votes: 0 })));

      const [row] = await Promise.race([
        sql`
          INSERT INTO dao_proposal (title, description, proposer, type, options, status, total_votes, quorum, ends_at)
          VALUES (${title}, ${description}, ${proposer}, ${type}, ${optionsJson}::jsonb, 'active', 0, 1000, ${endsAt.toISOString()})
          RETURNING *
        `,
        timeout,
      ]);

      const proposal = {
        id: row.id,
        title: row.title,
        description: row.description,
        proposer: row.proposer,
        type: row.type,
        options: row.options as Array<{ label: string; votes: number }>,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        totalVotes: row.total_votes,
        quorum: row.quorum,
        voters: {},
      };

      return apiSuccess({ proposal }, 201);
    } catch {
      // DB failed, fall through to in-memory
    }

    // Fallback to mock
    const proposal = agentDAO.createProposal(title, description, proposer, type, optionsArr);

    return apiSuccess({ proposal }, 201);
  } catch (err) {
    console.error('[POST /api/dao] Error:', err);
    return apiError('Failed to create proposal', 500);
  }
}
