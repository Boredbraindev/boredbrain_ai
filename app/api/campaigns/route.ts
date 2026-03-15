export const runtime = 'nodejs';
import { apiSuccess } from '@/lib/api-utils';
import {
  CURRENT_SEASON,
  getSeasonProgress,
  getActiveCampaigns,
  TIER_MULTIPLIERS,
  STREAK_MULTIPLIERS,
  CAMPAIGN_POINTS,
} from '@/lib/season-campaigns';

// GET /api/campaigns — Returns season info, active campaigns, point rules
export async function GET() {
  const progress = getSeasonProgress();
  const campaigns = getActiveCampaigns();

  return apiSuccess({
    season: {
      id: CURRENT_SEASON.id,
      name: CURRENT_SEASON.name,
      startDate: CURRENT_SEASON.startDate,
      endDate: CURRENT_SEASON.endDate,
      status: CURRENT_SEASON.status,
      totalPool: CURRENT_SEASON.totalPool,
      progress,
    },
    campaigns,
    multipliers: {
      tier: TIER_MULTIPLIERS,
      streak: STREAK_MULTIPLIERS,
    },
    pointValues: CAMPAIGN_POINTS,
  });
}
