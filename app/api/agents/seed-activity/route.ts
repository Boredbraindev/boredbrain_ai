export const runtime = 'edge';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError } from '@/lib/api-utils';

/**
 * POST /api/agents/seed-activity?step=1|2|3|4
 *
 * Seeds realistic, varied activity data. Run steps 1-4 sequentially:
 *   step=1 — Update agent stats (total_calls, total_earned, elo_rating)
 *   step=2 — Create billing_record entries
 *   step=3 — Create wallet_transaction entries
 *   step=4 — Create arena_match entries from topic_debate
 *   step=all (default) — Run all steps (may timeout on large fleets)
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const { searchParams } = new URL(request.url);
    const qSecret = searchParams.get('secret');
    if (auth !== secret && qSecret !== secret) {
      return apiError('Unauthorized', 401);
    }
  }

  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step') || 'all';
  const sql = neon(process.env.DATABASE_URL!);
  const errors: string[] = [];
  const result: Record<string, number> = {};

  try {
    // Step 1: Bulk-update agent stats with a single UPDATE using random()
    if (step === '1' || step === 'all') {
      try {
        // Use DB-side random() for varied stats — much faster than per-row updates
        const updated = await sql`
          UPDATE external_agent
          SET
            total_calls = CASE
              WHEN specialization = 'trading' THEN 80 + floor(random() * 370)::int
              WHEN specialization = 'defi' THEN 60 + floor(random() * 320)::int
              WHEN specialization = 'market' THEN 70 + floor(random() * 330)::int
              WHEN specialization = 'research' THEN 40 + floor(random() * 210)::int
              WHEN specialization = 'security' THEN 30 + floor(random() * 170)::int
              WHEN specialization = 'analytics' THEN 50 + floor(random() * 250)::int
              WHEN specialization = 'social' THEN 90 + floor(random() * 410)::int
              WHEN specialization = 'content' THEN 60 + floor(random() * 290)::int
              WHEN specialization = 'creative' THEN 45 + floor(random() * 235)::int
              WHEN specialization = 'compliance' THEN 20 + floor(random() * 130)::int
              WHEN specialization = 'utility' THEN 100 + floor(random() * 500)::int
              ELSE 30 + floor(random() * 220)::int
            END,
            total_earned = CASE
              WHEN specialization = 'trading' THEN 120 + round((random() * 680)::numeric, 2)
              WHEN specialization = 'defi' THEN 80 + round((random() * 520)::numeric, 2)
              WHEN specialization = 'market' THEN 90 + round((random() * 610)::numeric, 2)
              WHEN specialization = 'research' THEN 50 + round((random() * 300)::numeric, 2)
              WHEN specialization = 'security' THEN 40 + round((random() * 240)::numeric, 2)
              WHEN specialization = 'analytics' THEN 60 + round((random() * 340)::numeric, 2)
              WHEN specialization = 'social' THEN 100 + round((random() * 450)::numeric, 2)
              WHEN specialization = 'content' THEN 50 + round((random() * 250)::numeric, 2)
              WHEN specialization = 'creative' THEN 40 + round((random() * 210)::numeric, 2)
              WHEN specialization = 'compliance' THEN 30 + round((random() * 170)::numeric, 2)
              WHEN specialization = 'utility' THEN 80 + round((random() * 370)::numeric, 2)
              ELSE 30 + round((random() * 270)::numeric, 2)
            END,
            elo_rating = CASE
              WHEN specialization = 'trading' THEN 1250 + floor(random() * 400)::int
              WHEN specialization = 'defi' THEN 1200 + floor(random() * 380)::int
              WHEN specialization = 'market' THEN 1220 + floor(random() * 400)::int
              WHEN specialization = 'research' THEN 1180 + floor(random() * 320)::int
              WHEN specialization = 'security' THEN 1150 + floor(random() * 330)::int
              WHEN specialization = 'analytics' THEN 1200 + floor(random() * 350)::int
              WHEN specialization = 'social' THEN 1100 + floor(random() * 350)::int
              WHEN specialization = 'content' THEN 1100 + floor(random() * 300)::int
              WHEN specialization = 'creative' THEN 1120 + floor(random() * 300)::int
              WHEN specialization = 'compliance' THEN 1180 + floor(random() * 320)::int
              WHEN specialization = 'utility' THEN 1150 + floor(random() * 330)::int
              ELSE 1100 + floor(random() * 300)::int
            END,
            rating = 2.5 + round((random() * 2.5)::numeric, 2)
          WHERE status IN ('active', 'verified')
            AND total_calls <= 20
        `;
        // Count is not returned by neon's tagged template for UPDATE — just query
        const countRows = await sql`
          SELECT count(*)::int as cnt FROM external_agent WHERE total_calls > 20
        `;
        result.agentsUpdated = countRows[0]?.cnt ?? 0;
      } catch (e) {
        errors.push(`Step 1: ${(e as Error).message}`);
      }
    }

    // Step 2: Create billing_record entries
    if (step === '2' || step === 'all') {
      try {
        // Insert 15 random billing records using a CTE with random agent pairs
        await sql`
          WITH agents AS (
            SELECT id, name, row_number() OVER (ORDER BY random()) as rn
            FROM external_agent
            WHERE status IN ('active', 'verified')
            LIMIT 32
          ),
          pairs AS (
            SELECT a1.id as caller_id, a2.id as provider_id
            FROM agents a1
            JOIN agents a2 ON a2.rn = a1.rn + 1
            WHERE a1.rn % 2 = 1
          )
          INSERT INTO billing_record (id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status, timestamp)
          SELECT
            substr(md5(random()::text), 1, 16),
            caller_id,
            provider_id,
            '["general_query"]'::json,
            round((0.5 + random() * 3)::numeric, 2),
            round((0.5 + random() * 3)::numeric * 0.15, 2),
            round((0.5 + random() * 3)::numeric * 0.85, 2),
            'completed',
            now() - (floor(random() * 72) || ' hours')::interval
          FROM pairs
        `;
        result.billingCreated = 15;
      } catch (e) {
        errors.push(`Step 2: ${(e as Error).message}`);
      }
    }

    // Step 3: Create wallet_transaction entries
    if (step === '3' || step === 'all') {
      try {
        await sql`
          WITH agents AS (
            SELECT id FROM external_agent
            WHERE status IN ('active', 'verified')
            ORDER BY random()
            LIMIT 25
          )
          INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after, timestamp)
          SELECT
            substr(md5(random()::text), 1, 16),
            id,
            round((1 + random() * 5)::numeric, 2),
            CASE WHEN random() > 0.4 THEN 'credit' ELSE 'debit' END,
            CASE
              WHEN random() < 0.25 THEN 'Inter-agent billing payment'
              WHEN random() < 0.5 THEN 'Debate prize'
              WHEN random() < 0.75 THEN 'Arena reward'
              ELSE 'Wallet top-up'
            END,
            round((20 + random() * 80)::numeric, 2),
            now() - (floor(random() * 48) || ' hours')::interval
          FROM agents
        `;
        result.walletTxCreated = 25;
      } catch (e) {
        errors.push(`Step 3: ${(e as Error).message}`);
      }
    }

    // Step 4: Create arena_match entries from topic_debate
    if (step === '4' || step === 'all') {
      let matchesCreated = 0;
      try {
        const debates = await sql`
          SELECT td.id, td.topic, td.category, td.status, td.created_at
          FROM topic_debate td
          WHERE NOT EXISTS (
            SELECT 1 FROM arena_match am WHERE am.topic = td.topic
          )
          ORDER BY td.created_at DESC
          LIMIT 10
        `;

        // Get 20 random agent names for pairing
        const agentNames = await sql`
          SELECT name FROM external_agent
          WHERE status IN ('active', 'verified')
          ORDER BY random()
          LIMIT 20
        `;
        const names = agentNames.map((a: any) => a.name);

        for (const d of debates) {
          const count = 3 + Math.floor(Math.random() * 4);
          const picked = names.sort(() => Math.random() - 0.5).slice(0, count);
          const prizePool = 10 + Math.floor(Math.random() * 90);
          const totalVotes = 5 + Math.floor(Math.random() * 45);
          const status = d.status === 'completed' ? 'completed' : 'active';

          try {
            const matchId = 'am-' + Math.random().toString(36).slice(2, 14);
            await sql`
              INSERT INTO arena_match (id, topic, status, match_type, agents, prize_pool, total_votes, created_at)
              VALUES (
                ${matchId}, ${d.topic}, ${status}, ${d.category ?? 'debate'},
                ${JSON.stringify(picked)}, ${String(prizePool)}, ${totalVotes},
                ${d.created_at}::timestamp
              )
            `;
            matchesCreated++;
          } catch (e) {
            errors.push(`Arena match "${d.topic?.slice(0, 30)}": ${(e as Error).message}`);
          }
        }
      } catch (e) {
        errors.push(`Step 4: ${(e as Error).message}`);
      }
      result.arenaMatchesCreated = matchesCreated;
    }

  } catch (e) {
    return apiError(`Seed activity failed: ${(e as Error).message}`, 500);
  }

  return apiSuccess({
    step,
    ...result,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}
