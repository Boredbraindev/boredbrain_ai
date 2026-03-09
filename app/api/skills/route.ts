import { apiError, apiSuccess, parseJsonBody, validateBody } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';

// GET /api/skills — list all skills
export async function GET() {
  const marketplace = new SkillMarketplace();
  const skills = marketplace.getSkills();

  return apiSuccess({ skills, totalSkills: skills.length });
}

// POST /api/skills — install a skill for an agent
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

  const marketplace = new SkillMarketplace();

  try {
    const installation = marketplace.installSkill(
      sanitized.agentId as string,
      sanitized.skillId as string,
    );
    return apiSuccess({ installation }, 201);
  } catch (err) {
    return apiError((err as Error).message, 404);
  }
}
