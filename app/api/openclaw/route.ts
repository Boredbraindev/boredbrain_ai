import { apiSuccess } from '@/lib/api-utils';
import { clawHubRegistry } from '@/lib/openclaw';

// GET /api/openclaw — Returns the full OpenClaw skill manifest
export async function GET() {
  const manifest = clawHubRegistry.getSkillManifest();
  return apiSuccess({ manifest });
}
