export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/topics/cleanup — Close expired debates + optionally trigger fresh collection
 *
 * Requires CRON_SECRET auth (Bearer token only).
 *
 * Body (optional JSON):
 *   { "collect": true }  — also trigger Polymarket/Kalshi collection after cleanup
 *
 * Steps:
 *   1. closeExpiredDebates() — finds status='open' AND closesAt < now, scores + completes them
 *   2. Optionally calls /api/topics/collect internally
 */

import { NextRequest, NextResponse } from 'next/server';
import { closeExpiredDebates } from '@/lib/topic-debate';
import { verifyCron } from '@/lib/verify-cron';

// ---------------------------------------------------------------------------
// POST /api/topics/cleanup
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const results: {
    closed: number;
    closeErrors: string[];
    collected?: number;
    collectErrors?: string[];
  } = {
    closed: 0,
    closeErrors: [],
  };

  // 1. Close expired debates (score + complete them)
  try {
    const closeResult = await closeExpiredDebates();
    results.closed = closeResult.closed;
    results.closeErrors = closeResult.errors;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    results.closeErrors.push(`closeExpiredDebates: ${msg}`);
  }

  // 2. Optionally trigger fresh collection
  let shouldCollect = false;
  try {
    const body = await request.json().catch(() => ({}));
    shouldCollect = body?.collect === true;
  } catch {
    // No body or invalid JSON — skip collection
  }

  if (shouldCollect) {
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const collectRes = await fetch(`${baseUrl}/api/topics/collect`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      const collectData = await collectRes.json();
      results.collected = collectData?.data?.collected ?? collectData?.collected ?? 0;
      if (collectData?.data?.errors?.length) {
        results.collectErrors = collectData.data.errors;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results.collectErrors = [`collect: ${msg}`];
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    message: `Closed ${results.closed} expired debate(s)${shouldCollect ? `, collected ${results.collected ?? 0} new topic(s)` : ''}`,
  });
}

// Also support GET for easy manual/cron triggering (cleanup only, no collection)
export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const closeResult = await closeExpiredDebates();
    return NextResponse.json({
      success: true,
      closed: closeResult.closed,
      errors: closeResult.errors,
      message: `Closed ${closeResult.closed} expired debate(s)`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
