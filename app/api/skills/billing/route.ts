import { apiSuccess } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';

// GET /api/skills/billing — billing stats
// ?agentId=xxx  → per-agent stats
// (no param)    → global stats
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  const marketplace = new SkillMarketplace();

  if (agentId) {
    const stats = marketplace.getBillingStats(agentId);
    return apiSuccess({ type: 'agent', ...stats });
  }

  const global = marketplace.getGlobalBilling();
  return apiSuccess({ type: 'global', ...global });
}
