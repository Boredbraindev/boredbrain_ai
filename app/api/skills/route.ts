import { apiError, apiSuccess, parseJsonBody, validateBody } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';
import { db } from '@/lib/db';
import { skill, skillInstallation } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from 'ai';

// GET /api/skills — list all skills (DB first, fallback to in-memory)
export async function GET() {
  // Try DB first with 3s timeout
  try {
    const dbPromise = db.select().from(skill);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );
    const dbSkills = await Promise.race([dbPromise, timeout]);

    if (dbSkills && dbSkills.length > 0) {
      return apiSuccess({ skills: dbSkills, totalSkills: dbSkills.length, source: 'db' });
    }
  } catch {
    // DB unavailable or timeout — fall through to in-memory
  }

  // Fallback: use SkillMarketplace in-memory data
  const marketplace = new SkillMarketplace();
  const skills = marketplace.getSkills();
  return apiSuccess({ skills, totalSkills: skills.length, source: 'fallback' });
}

// POST /api/skills — install a skill for an agent (DB first, fallback to in-memory)
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

  // Try DB first
  try {
    const dbPromise = (async () => {
      // Check skill exists in DB
      const [dbSkill] = await db
        .select()
        .from(skill)
        .where(eq(skill.id, skillId))
        .limit(1);

      if (!dbSkill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      // Check if already installed and active
      const [existing] = await db
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

      if (existing) {
        return existing;
      }

      // Create new installation
      const [installation] = await db
        .insert(skillInstallation)
        .values({
          id: generateId(),
          skillId,
          agentId,
          installedAt: new Date(),
          usageCount: 0,
          totalBilled: 0,
          status: 'active',
        })
        .returning();

      return installation;
    })();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    const installation = await Promise.race([dbPromise, timeout]);
    return apiSuccess({ installation, source: 'db' }, 201);
  } catch (err) {
    const message = (err as Error).message;
    // If skill not found, return 404 regardless of source
    if (message.includes('Skill not found')) {
      return apiError(message, 404);
    }
    // DB failure — fallback to in-memory
  }

  // Fallback: use SkillMarketplace in-memory
  const marketplace = new SkillMarketplace();
  try {
    const installation = marketplace.installSkill(agentId, skillId);
    return apiSuccess({ installation, source: 'fallback' }, 201);
  } catch (err) {
    return apiError((err as Error).message, 404);
  }
}
