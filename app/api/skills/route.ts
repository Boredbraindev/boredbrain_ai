export const runtime = 'edge';

import { apiError, apiSuccess, parseJsonBody, validateBody } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';
import { neon } from '@neondatabase/serverless';

// GET /api/skills — list all skills (DB first, fallback to in-memory)
export async function GET() {
  // Try DB first with 3s timeout
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const dbPromise = sql`SELECT * FROM skill`;
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
    const sql = neon(process.env.DATABASE_URL!);

    const dbPromise = (async () => {
      // Check skill exists in DB
      const dbSkills = await sql`SELECT * FROM skill WHERE id = ${skillId} LIMIT 1`;

      if (dbSkills.length === 0) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      // Check if already installed and active
      const existing = await sql`
        SELECT * FROM skill_installation
        WHERE skill_id = ${skillId}
          AND agent_id = ${agentId}
          AND status = 'active'
        LIMIT 1
      `;

      if (existing.length > 0) {
        return existing[0];
      }

      // Create new installation
      const installId = crypto.randomUUID();
      const installations = await sql`
        INSERT INTO skill_installation (id, skill_id, agent_id, installed_at, usage_count, total_billed, status)
        VALUES (${installId}, ${skillId}, ${agentId}, NOW(), 0, 0, 'active')
        RETURNING *
      `;

      return installations[0];
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
