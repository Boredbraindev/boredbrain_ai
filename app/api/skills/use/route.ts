import { apiError, apiSuccess, parseJsonBody, validateBody } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';

// POST /api/skills/use — use a skill (charges BBAI, returns result)
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
    const { result, tokensCharged, latencyMs, log } = marketplace.useSkill(
      sanitized.agentId as string,
      sanitized.skillId as string,
    );
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
