import { apiError, apiSuccess, parseJsonBody, validateBody } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';
import { db } from '@/lib/db';
import { toolUsage, skill, skillInstallation } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from 'ai';

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
      const dbPromise = (async () => {
        // Insert into toolUsage table
        await db.insert(toolUsage).values({
          id: generateId(),
          agentId,
          toolName: skillId,
          inputParams: { query: log.query, skillId },
          outputSummary: result,
          tokensUsed: tokensCharged,
          cost: String(tokensCharged),
          latencyMs,
          status: 'success',
          createdAt: new Date(),
        });

        // Update skill totalCalls/totalRevenue in DB if skill exists
        const [dbSkill] = await db
          .select()
          .from(skill)
          .where(eq(skill.id, skillId))
          .limit(1);

        if (dbSkill) {
          await db
            .update(skill)
            .set({
              totalCalls: dbSkill.totalCalls + 1,
              totalRevenue: dbSkill.totalRevenue + tokensCharged,
              updatedAt: new Date(),
            })
            .where(eq(skill.id, skillId));
        }

        // Update skillInstallation counters if exists
        const [installation] = await db
          .select()
          .from(skillInstallation)
          .where(
            and(
              eq(skillInstallation.skillId, skillId),
              eq(skillInstallation.agentId, agentId),
              eq(skillInstallation.status, 'active'),
            ),
          )
          .limit(1);

        if (installation) {
          await db
            .update(skillInstallation)
            .set({
              usageCount: installation.usageCount + 1,
              totalBilled: installation.totalBilled + tokensCharged,
            })
            .where(eq(skillInstallation.id, installation.id));
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
