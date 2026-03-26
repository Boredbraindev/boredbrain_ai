export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

// ---------------------------------------------------------------------------
// GET /api/health/crons
// Returns the last-activity timestamps for key cron-driven processes.
// Use this to detect if the dev server crons (heartbeat, topic collection,
// arena debates, etc.) have stopped running.
// ---------------------------------------------------------------------------

interface CronStatus {
  name: string;
  lastActivity: string | null;
  minutesAgo: number | null;
  healthy: boolean;
}

// Maximum minutes since last activity before a cron is considered unhealthy
const STALE_THRESHOLDS: Record<string, number> = {
  heartbeat: 20,           // runs every 10 min, allow 2x grace
  agent_billing: 30,       // billing records from agent-to-agent calls
  debate_opinions: 60,     // agents participate in debates
  topic_collection: 120,   // topics collected from Polymarket
  arena_matches: 120,      // arena matches created
  network_messages: 30,    // heartbeat & invoke messages
};

export async function GET(_request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );

    // Run all checks in parallel for speed
    const [
      lastBilling,
      lastDebateOpinion,
      lastTopicDebate,
      lastArenaMatch,
      lastNetworkMessage,
      lastHeartbeatMessage,
    ] = await Promise.race([
      Promise.all([
        sql`SELECT MAX(timestamp) as last_at FROM billing_record`,
        sql`SELECT MAX(created_at) as last_at FROM debate_opinion`,
        sql`SELECT MAX(created_at) as last_at FROM topic_debate`,
        sql`SELECT MAX(created_at) as last_at FROM arena_match`,
        sql`SELECT MAX(timestamp) as last_at FROM network_message`,
        sql`SELECT MAX(timestamp) as last_at FROM network_message WHERE type = 'heartbeat'`,
      ]),
      timeout,
    ]);

    const now = new Date();

    const buildStatus = (name: string, row: Record<string, unknown>[]): CronStatus => {
      const lastAt = row?.[0]?.last_at ? new Date(row[0].last_at as string) : null;
      const minutesAgo = lastAt ? Math.round((now.getTime() - lastAt.getTime()) / 60000) : null;
      const threshold = STALE_THRESHOLDS[name] ?? 60;
      const healthy = minutesAgo !== null && minutesAgo <= threshold;

      return {
        name,
        lastActivity: lastAt ? lastAt.toISOString() : null,
        minutesAgo,
        healthy,
      };
    };

    const crons: CronStatus[] = [
      buildStatus('heartbeat', lastHeartbeatMessage),
      buildStatus('agent_billing', lastBilling),
      buildStatus('debate_opinions', lastDebateOpinion),
      buildStatus('topic_collection', lastTopicDebate),
      buildStatus('arena_matches', lastArenaMatch),
      buildStatus('network_messages', lastNetworkMessage),
    ];

    const allHealthy = crons.every((c) => c.healthy);
    const unhealthyCount = crons.filter((c) => !c.healthy).length;

    return apiSuccess({
      overall: allHealthy ? 'healthy' : 'degraded',
      unhealthyCount,
      checkedAt: now.toISOString(),
      crons,
    });
  } catch (err) {
    console.error('[health/crons]', err);
    return apiError('Failed to check cron health', 500);
  }
}
