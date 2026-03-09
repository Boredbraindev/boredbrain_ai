// POST /api/agents/reset-stats — Reset all fake seeded stats to zero
// Only resets platform-fleet agents, not externally registered ones

import { apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function POST() {
  try {
    const result = await db
      .update(externalAgent)
      .set({
        totalCalls: 0,
        totalEarned: 0,
        rating: 0,
        eloRating: 1200,
      })
      .where(sql`${externalAgent.ownerAddress} = 'platform-fleet'`)
      .returning({ id: externalAgent.id });

    return apiSuccess({
      message: `Reset stats for ${result.length} platform-fleet agents`,
      updatedCount: result.length,
    });
  } catch (err) {
    const message = (err as Error).message;
    return apiError(`Reset failed: ${message}`, 500);
  }
}
