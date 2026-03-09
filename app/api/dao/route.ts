import { NextRequest } from 'next/server';
import { agentDAO, type ProposalStatus, type ProposalType } from '@/lib/agent-dao';
import { apiError, apiSuccess, parseJsonBody, validateBody, type Schema } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { daoProposal, daoVote } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

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
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      let query = db.select().from(daoProposal).$dynamic();
      if (status) {
        query = query.where(eq(daoProposal.status, status));
      }
      query = query.orderBy(desc(daoProposal.createdAt));

      const [rows, statsResult] = await Promise.race([
        Promise.all([
          query,
          db
            .select({
              totalProposals: sql<number>`count(*)`,
              activeProposals: sql<number>`count(*) filter (where ${daoProposal.status} = 'active')`,
              passedProposals: sql<number>`count(*) filter (where ${daoProposal.status} = 'passed')`,
              rejectedProposals: sql<number>`count(*) filter (where ${daoProposal.status} = 'rejected')`,
              executedProposals: sql<number>`count(*) filter (where ${daoProposal.status} = 'executed')`,
            })
            .from(daoProposal),
        ]),
        timeout,
      ]);

      if (rows.length > 0) {
        // Fetch voter counts for participation rate
        const voterCount = await Promise.race([
          db
            .select({ count: sql<number>`count(distinct ${daoVote.voter})` })
            .from(daoVote),
          timeout,
        ]);

        const totalVoters = Number(voterCount[0]?.count ?? 0);
        const s = statsResult[0];

        // Build proposals with voters map from daoVote table
        const proposalIds = rows.map((r: { id: string }) => r.id);
        const allVotes = await Promise.race([
          db
            .select()
            .from(daoVote)
            .where(sql`${daoVote.proposalId} = any(${proposalIds})`),
          timeout,
        ]);

        // Group votes by proposalId
        const votesByProposal = new Map<string, Array<typeof allVotes[0]>>();
        for (const v of allVotes) {
          const arr = votesByProposal.get(v.proposalId) ?? [];
          arr.push(v);
          votesByProposal.set(v.proposalId, arr);
        }

        const proposals = rows.map((row: any) => {
          const votes = votesByProposal.get(row.id) ?? [];
          const voters: Record<string, { optionIndex: number; weight: number }> = {};
          for (const v of votes) {
            voters[v.voter] = { optionIndex: v.optionIndex, weight: v.weight };
          }

          return {
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
        });

        const stats = {
          totalProposals: Number(s.totalProposals),
          activeProposals: Number(s.activeProposals),
          passedProposals: Number(s.passedProposals),
          rejectedProposals: Number(s.rejectedProposals),
          executedProposals: Number(s.executedProposals),
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
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      const now = new Date();
      const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [row] = await Promise.race([
        db
          .insert(daoProposal)
          .values({
            title,
            description,
            proposer,
            type,
            options: optionsArr.map((label) => ({ label, votes: 0 })),
            status: 'active',
            totalVotes: 0,
            quorum: 1000,
            endsAt,
          })
          .returning(),
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
        createdAt: row.createdAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        totalVotes: row.totalVotes,
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
