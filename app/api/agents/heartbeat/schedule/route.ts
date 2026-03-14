export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * POST /api/agents/heartbeat/schedule — Create QStash recurring schedule
 * DELETE /api/agents/heartbeat/schedule — Remove schedule
 * GET /api/agents/heartbeat/schedule — Check schedule status
 *
 * Admin-only: requires CRON_SECRET via Bearer token or query param.
 */

import { NextRequest } from 'next/server';
import { Client } from '@upstash/qstash';
import { serverEnv } from '@/env/server';
import { apiSuccess, apiError } from '@/lib/api-utils';

function verifyAdmin(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;

  // Fail-closed: no secret = no access (except dev)
  if (!secret) return process.env.NODE_ENV === 'development';

  // Bearer token auth only (no query params to avoid log leakage)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }

  return false;
}

const HEARTBEAT_URL = 'https://boredbrain.app/api/agents/heartbeat';

/**
 * POST — Create a recurring heartbeat schedule (default: every 10 minutes)
 */
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return apiError('Unauthorized', 401);
  }

  if (!serverEnv.QSTASH_TOKEN) {
    return apiError('QSTASH_TOKEN not configured', 500);
  }

  const qstash = new Client({
    token: serverEnv.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_URL || 'https://qstash.upstash.io',
  });

  try {
    // Parse optional cron expression from body (minimum: every 5 minutes)
    let cron = '*/10 * * * *'; // default: every 10 minutes
    const ALLOWED_CRONS = ['*/5 * * * *', '*/10 * * * *', '*/15 * * * *', '*/30 * * * *', '0 * * * *'];
    try {
      const body = await request.json();
      if (body?.cron && ALLOWED_CRONS.includes(body.cron)) {
        cron = body.cron;
      } else if (body?.cron) {
        return apiError('Invalid cron. Allowed: ' + ALLOWED_CRONS.join(', '), 400);
      }
    } catch {
      // no body, use default
    }

    const schedule = await qstash.schedules.create({
      destination: HEARTBEAT_URL,
      cron,
    });

    return apiSuccess({
      scheduleId: schedule.scheduleId,
      cron,
      destination: HEARTBEAT_URL,
      message: `Heartbeat scheduled: ${cron}`,
    });
  } catch (err) {
    return apiError(`Failed to create schedule: ${err instanceof Error ? err.message : 'error'}`, 500);
  }
}

/**
 * GET — List active heartbeat schedules
 */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return apiError('Unauthorized', 401);
  }

  if (!serverEnv.QSTASH_TOKEN) {
    return apiError('QSTASH_TOKEN not configured', 500);
  }

  const qstash = new Client({
    token: serverEnv.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_URL || 'https://qstash.upstash.io',
  });

  try {
    const schedules = await qstash.schedules.list();
    const heartbeatSchedules = schedules.filter(
      (s) => s.destination === HEARTBEAT_URL || s.destination?.includes('/heartbeat'),
    );

    return apiSuccess({
      schedules: heartbeatSchedules.map((s) => ({
        id: s.scheduleId,
        cron: s.cron,
        destination: s.destination,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    return apiError(`Failed to list schedules: ${err instanceof Error ? err.message : 'error'}`, 500);
  }
}

/**
 * DELETE — Remove all heartbeat schedules
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return apiError('Unauthorized', 401);
  }

  if (!serverEnv.QSTASH_TOKEN) {
    return apiError('QSTASH_TOKEN not configured', 500);
  }

  const qstash = new Client({
    token: serverEnv.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_URL || 'https://qstash.upstash.io',
  });

  try {
    const schedules = await qstash.schedules.list();
    const heartbeatSchedules = schedules.filter(
      (s) => s.destination === HEARTBEAT_URL || s.destination?.includes('/heartbeat'),
    );

    let removed = 0;
    for (const s of heartbeatSchedules) {
      await qstash.schedules.delete(s.scheduleId);
      removed++;
    }

    return apiSuccess({ removed, message: `Removed ${removed} heartbeat schedule(s)` });
  } catch (err) {
    return apiError(`Failed to delete schedules: ${err instanceof Error ? err.message : 'error'}`, 500);
  }
}
