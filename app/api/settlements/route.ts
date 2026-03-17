export const runtime = 'edge';

/**
 * GET /api/settlements?limit=10
 * Returns recent settlement log entries for the settlement feed UI.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';

export async function GET(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

    // Ensure settlement_log table exists
    await sql`
      CREATE TABLE IF NOT EXISTS settlement_log (
        id TEXT PRIMARY KEY,
        debate_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        winning_outcome TEXT,
        total_pool REAL DEFAULT 0,
        participant_count INTEGER DEFAULT 0,
        tx_hash TEXT,
        settled_by TEXT,
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT
        id,
        debate_id,
        topic,
        status,
        winning_outcome,
        total_pool,
        participant_count,
        tx_hash,
        settled_by,
        settled_at,
        created_at
      FROM settlement_log
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return apiSuccess({
      settlements: rows.map((r: any) => ({
        id: r.id,
        debateId: r.debate_id,
        topic: r.topic,
        status: r.status,
        winningOutcome: r.winning_outcome,
        totalPool: r.total_pool ?? 0,
        participantCount: r.participant_count ?? 0,
        txHash: r.tx_hash,
        settledBy: r.settled_by,
        settledAt: r.settled_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(`Failed to fetch settlements: ${msg}`, 500);
  }
}
