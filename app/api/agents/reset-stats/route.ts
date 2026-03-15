export const runtime = 'edge';

// POST /api/agents/reset-stats — Reset all fake seeded stats to zero
// Only resets platform-fleet agents, not externally registered ones

import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

export async function POST() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const result = await sql`
      UPDATE external_agent
      SET total_calls = 0, total_earned = 0, rating = 0, elo_rating = 1200
      WHERE owner_address = 'platform-fleet'
      RETURNING id
    `;

    return apiSuccess({
      message: `Reset stats for ${result.length} platform-fleet agents`,
      updatedCount: result.length,
    });
  } catch (err) {
    const message = (err as Error).message;
    return apiError(`Reset failed: ${message}`, 500);
  }
}
