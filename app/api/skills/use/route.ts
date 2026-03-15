export const runtime = 'edge';

import { apiError, apiSuccess, parseJsonBody, validateBody } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';
import { neon } from '@neondatabase/serverless';

// POST /api/skills/use — use a skill (charges BBAI, returns result, logs to toolUsage)
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { valid, errors, sanitized } = validateBody(
    parsed.data as Record<string, unknown>,
    {
      agentId: { type: 'string', required: true, maxLength: 200 },
      skillId: { type: 'string', required: true, maxLength: 100 },
    },
  );

  if (!valid) return apiError(errors.join(', '));

  const agentId = sanitized.agentId as string;
  const skillId = sanitized.skillId as string;

  // Always use SkillMarketplace to execute the skill (it has the mock results logic)
  const marketplace = new SkillMarketplace();

  try {
    const { result, tokensCharged, latencyMs, log } = marketplace.useSkill(agentId, skillId);

    // Log usage to DB toolUsage table (fire and forget, don't block response)
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const usageId = crypto.randomUUID();

      const dbPromise = (async () => {
        // Insert into tool_usage table
        await sql`
          INSERT INTO tool_usage (id, agent_id, tool_name, input_params, output_summary, tokens_used, cost, latency_ms, status, created_at)
          VALUES (${usageId}, ${agentId}, ${skillId}, ${JSON.stringify({ query: log.query, skillId })}, ${result}, ${tokensCharged}, ${String(tokensCharged)}, ${latencyMs}, 'success', NOW())
        `;

        // Update skill totalCalls/totalRevenue in DB if skill exists
        const dbSkill = await sql`SELECT * FROM skill WHERE id = ${skillId} LIMIT 1`;

        if (dbSkill.length > 0) {
          await sql`
            UPDATE skill
            SET total_calls = total_calls + 1,
                total_revenue = total_revenue + ${tokensCharged},
                updated_at = NOW()
            WHERE id = ${skillId}
          `;
        }

        // Update skill_installation counters if exists
        const installation = await sql`
          SELECT * FROM skill_installation
          WHERE skill_id = ${skillId}
            AND agent_id = ${agentId}
            AND status = 'active'
          LIMIT 1
        `;

        if (installation.length > 0) {
          await sql`
            UPDATE skill_installation
            SET usage_count = usage_count + 1,
                total_billed = total_billed + ${tokensCharged}
            WHERE id = ${installation[0].id}
          `;
        }
      })();

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 3000),
      );

      await Promise.race([dbPromise, timeout]);
    } catch {
      // DB logging failed — usage still tracked in-memory via SkillMarketplace
    }

    return apiSuccess({
      result,
      tokensCharged,
      latencyMs,
      logId: log.id,
      timestamp: log.timestamp,
    });
  } catch (err) {
    return apiError((err as Error).message, 404);
  }
}
