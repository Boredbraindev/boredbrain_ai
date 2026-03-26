export const runtime = 'edge';
export const maxDuration = 10;

/**
 * QC (Quality Check) Agent — System Health Monitor
 *
 * Comprehensive health check that runs every 6 hours via Vercel cron.
 * Checks database, agents, debates, topics, billing, settlements.
 * Auto-fixes safe/idempotent issues (expired debates, stale wallets).
 * Stores results in qc_report table for history.
 */

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { verifyCron } from '@/lib/verify-cron';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

type CheckStatus = 'healthy' | 'degraded' | 'critical';

interface QCReport {
  status: CheckStatus;
  timestamp: string;
  durationMs: number;
  checks: {
    database: { status: CheckStatus; latencyMs: number };
    agents: { total: number; active: number; withCalls: number; avgCalls: number; status: CheckStatus };
    debates: { total: number; open: number; empty: number; expired: number; needsScoring: number; status: CheckStatus };
    topics: { lastCollected: string | null; polymarketWorking: boolean; kalshiWorking: boolean; total: number; status: CheckStatus };
    billing: { totalRecords: number; failedRecords: number; last24hVolume: number; status: CheckStatus };
    settlements: { pending: number; completed: number; overdue: number; status: CheckStatus };
    wallets: { total: number; depleted: number; staleResets: number; status: CheckStatus };
  };
  autoFixed: {
    expiredDebatesClosed: number;
    walletResetsApplied: number;
    staleDebatesMarkedClosed: number;
  };
  issues: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// GET /api/qc
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  const startTime = Date.now();
  const issues: string[] = [];
  const recommendations: string[] = [];
  const autoFixed = { expiredDebatesClosed: 0, walletResetsApplied: 0, staleDebatesMarkedClosed: 0 };

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return apiSuccess({
      status: 'critical' as const,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      checks: {},
      issues: ['DATABASE_URL not configured'],
      recommendations: ['Set DATABASE_URL environment variable'],
      autoFixed,
    });
  }

  const sql = neon(dbUrl);

  // -------------------------------------------------------------------------
  // 1. Database connectivity
  // -------------------------------------------------------------------------
  let dbCheck: QCReport['checks']['database'];
  try {
    const dbStart = Date.now();
    await sql`SELECT 1`;
    const latency = Date.now() - dbStart;
    dbCheck = { status: latency > 2000 ? 'degraded' : 'healthy', latencyMs: latency };
    if (latency > 2000) {
      issues.push(`Database latency high: ${latency}ms`);
      recommendations.push('Check Neon database performance or region');
    }
  } catch (e) {
    dbCheck = { status: 'critical', latencyMs: -1 };
    issues.push(`Database unreachable: ${e instanceof Error ? e.message : 'unknown'}`);
    recommendations.push('Check DATABASE_URL and Neon dashboard for outages');
    // Can't continue without DB
    return apiSuccess({
      status: 'critical' as const,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      checks: { database: dbCheck },
      issues,
      recommendations,
      autoFixed,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Agent activity
  // -------------------------------------------------------------------------
  let agentsCheck: QCReport['checks']['agents'];
  try {
    const [agentStats] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('active', 'verified'))::int AS active,
        COUNT(*) FILTER (WHERE total_calls > 0)::int AS with_calls,
        COALESCE(AVG(total_calls) FILTER (WHERE total_calls > 0), 0)::real AS avg_calls
      FROM external_agent
    `;
    const total = agentStats.total ?? 0;
    const active = agentStats.active ?? 0;
    const withCalls = agentStats.with_calls ?? 0;
    const avgCalls = Math.round((agentStats.avg_calls ?? 0) * 100) / 100;

    let status: CheckStatus = 'healthy';
    if (total === 0) {
      status = 'critical';
      issues.push('No agents registered');
      recommendations.push('Run fleet seeding to populate agents');
    } else if (withCalls < total * 0.1) {
      status = 'degraded';
      issues.push(`Only ${withCalls}/${total} agents have any calls`);
      recommendations.push('Check heartbeat cron and agent executor');
    }
    agentsCheck = { total, active, withCalls, avgCalls, status };
  } catch (e) {
    agentsCheck = { total: 0, active: 0, withCalls: 0, avgCalls: 0, status: 'critical' };
    issues.push(`Agent check failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // -------------------------------------------------------------------------
  // 3. Debate health
  // -------------------------------------------------------------------------
  let debatesCheck: QCReport['checks']['debates'];
  try {
    const [debateStats] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'open' AND total_participants = 0)::int AS empty,
        COUNT(*) FILTER (WHERE status = 'open' AND closes_at < NOW())::int AS expired,
        COUNT(*) FILTER (WHERE status IN ('scoring', 'completed') AND resolved_outcome IS NULL AND closes_at < NOW() - INTERVAL '1 hour')::int AS needs_scoring
      FROM topic_debate
    `;
    const total = debateStats.total ?? 0;
    const open = debateStats.open ?? 0;
    const empty = debateStats.empty ?? 0;
    const expired = debateStats.expired ?? 0;
    const needsScoring = debateStats.needs_scoring ?? 0;

    let status: CheckStatus = 'healthy';
    if (expired > 10) {
      status = 'degraded';
      issues.push(`${expired} expired debates still marked as open`);
      recommendations.push('Check topic settlement cron');
    }
    if (needsScoring > 5) {
      status = 'degraded';
      issues.push(`${needsScoring} debates need scoring but haven't been settled`);
      recommendations.push('Trigger /api/topics/settle manually');
    }
    debatesCheck = { total, open, empty, expired, needsScoring, status };
  } catch (e) {
    debatesCheck = { total: 0, open: 0, empty: 0, expired: 0, needsScoring: 0, status: 'critical' };
    issues.push(`Debate check failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // -------------------------------------------------------------------------
  // 4. Topic freshness
  // -------------------------------------------------------------------------
  let topicsCheck: QCReport['checks']['topics'];
  try {
    const [topicStats] = await sql`
      SELECT
        COUNT(*)::int AS total,
        MAX(created_at) AS last_collected,
        COUNT(*) FILTER (WHERE source = 'polymarket' AND created_at > NOW() - INTERVAL '24 hours')::int AS polymarket_recent,
        COUNT(*) FILTER (WHERE source = 'kalshi' AND created_at > NOW() - INTERVAL '24 hours')::int AS kalshi_recent
      FROM topic_debate
    `;
    const total = topicStats.total ?? 0;
    const lastCollected = topicStats.last_collected ? new Date(topicStats.last_collected).toISOString() : null;
    const polymarketWorking = (topicStats.polymarket_recent ?? 0) > 0;
    const kalshiWorking = (topicStats.kalshi_recent ?? 0) > 0;

    let status: CheckStatus = 'healthy';
    if (!lastCollected) {
      status = 'critical';
      issues.push('No topics ever collected');
      recommendations.push('Run /api/topics/collect manually');
    } else {
      const hoursSinceLastCollect = (Date.now() - new Date(lastCollected).getTime()) / 3600000;
      if (hoursSinceLastCollect > 6) {
        status = 'degraded';
        issues.push(`Last topic collected ${Math.round(hoursSinceLastCollect)}h ago`);
        recommendations.push('Check /api/topics/collect cron and Polymarket API');
      }
    }
    if (!polymarketWorking) {
      issues.push('No Polymarket topics in last 24h');
      recommendations.push('Verify Polymarket API connectivity');
    }
    if (!kalshiWorking) {
      // Kalshi is less critical — just note it
      issues.push('No Kalshi topics in last 24h');
    }
    topicsCheck = { lastCollected, polymarketWorking, kalshiWorking, total, status };
  } catch (e) {
    topicsCheck = { lastCollected: null, polymarketWorking: false, kalshiWorking: false, total: 0, status: 'critical' };
    issues.push(`Topic check failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // -------------------------------------------------------------------------
  // 5. Billing health
  // -------------------------------------------------------------------------
  let billingCheck: QCReport['checks']['billing'];
  try {
    const [billingStats] = await sql`
      SELECT
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_records,
        COALESCE(SUM(total_cost) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours'), 0)::real AS last_24h_volume
      FROM billing_record
    `;
    const totalRecords = billingStats.total_records ?? 0;
    const failedRecords = billingStats.failed_records ?? 0;
    const last24hVolume = Math.round((billingStats.last_24h_volume ?? 0) * 100) / 100;

    let status: CheckStatus = 'healthy';
    if (failedRecords > 10) {
      status = 'degraded';
      issues.push(`${failedRecords} failed billing records`);
      recommendations.push('Investigate billing failures — check agent wallet balances');
    }
    if (totalRecords > 0 && last24hVolume === 0) {
      issues.push('No billing activity in last 24h');
      recommendations.push('Check if heartbeat cron is running');
    }
    billingCheck = { totalRecords, failedRecords, last24hVolume, status };
  } catch (e) {
    billingCheck = { totalRecords: 0, failedRecords: 0, last24hVolume: 0, status: 'critical' };
    issues.push(`Billing check failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // -------------------------------------------------------------------------
  // 6. Settlement status
  // -------------------------------------------------------------------------
  let settlementsCheck: QCReport['checks']['settlements'];
  try {
    const [settlementStats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('scoring', 'completed') AND resolved_outcome IS NULL)::int AS pending,
        COUNT(*) FILTER (WHERE status = 'settled')::int AS completed,
        COUNT(*) FILTER (WHERE status IN ('open', 'scoring') AND closes_at < NOW() - INTERVAL '6 hours')::int AS overdue
      FROM topic_debate
    `;
    const pending = settlementStats.pending ?? 0;
    const completed = settlementStats.completed ?? 0;
    const overdue = settlementStats.overdue ?? 0;

    let status: CheckStatus = 'healthy';
    if (overdue > 5) {
      status = 'degraded';
      issues.push(`${overdue} debates overdue for settlement (>6h past closesAt)`);
      recommendations.push('Run settlement manually or check settle cron');
    }
    if (overdue > 20) {
      status = 'critical';
    }
    settlementsCheck = { pending, completed, overdue, status };
  } catch (e) {
    settlementsCheck = { pending: 0, completed: 0, overdue: 0, status: 'critical' };
    issues.push(`Settlement check failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // -------------------------------------------------------------------------
  // 7. Wallet health
  // -------------------------------------------------------------------------
  let walletsCheck: QCReport['checks']['wallets'];
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const [walletStats] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE balance <= 0 AND is_active = true)::int AS depleted,
        COUNT(*) FILTER (WHERE last_reset_date IS NOT NULL AND last_reset_date < ${today} AND spent_today > 0)::int AS stale_resets
      FROM agent_wallet
    `;
    const total = walletStats.total ?? 0;
    const depleted = walletStats.depleted ?? 0;
    const staleResets = walletStats.stale_resets ?? 0;

    let status: CheckStatus = 'healthy';
    if (depleted > total * 0.3 && total > 0) {
      status = 'degraded';
      issues.push(`${depleted}/${total} wallets depleted`);
      recommendations.push('Run wallet rebalance via heartbeat');
    }
    walletsCheck = { total, depleted, staleResets, status };
  } catch (e) {
    walletsCheck = { total: 0, depleted: 0, staleResets: 0, status: 'critical' };
    issues.push(`Wallet check failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // =========================================================================
  // AUTO-FIX: Safe, idempotent fixes
  // =========================================================================

  // Fix 1: Close expired debates with 0 participants
  try {
    const closed = await sql`
      UPDATE topic_debate
      SET status = 'closed'
      WHERE status = 'open'
        AND closes_at < NOW()
        AND total_participants = 0
      RETURNING id
    `;
    autoFixed.expiredDebatesClosed = closed.length;
    if (closed.length > 0) {
      issues.push(`Auto-fixed: Closed ${closed.length} expired debates with 0 participants`);
    }
  } catch (e) {
    issues.push(`Auto-fix (expired debates) failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // Fix 2: Reset stale wallet spent_today if date changed
  try {
    const today = new Date().toISOString().slice(0, 10);
    const reset = await sql`
      UPDATE agent_wallet
      SET spent_today = 0, last_reset_date = ${today}
      WHERE last_reset_date IS NOT NULL
        AND last_reset_date < ${today}
        AND spent_today > 0
      RETURNING id
    `;
    autoFixed.walletResetsApplied = reset.length;
    if (reset.length > 0) {
      issues.push(`Auto-fixed: Reset spent_today for ${reset.length} wallets (new day)`);
    }
  } catch (e) {
    issues.push(`Auto-fix (wallet resets) failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // Fix 3: Mark stale debates as 'closed' if closesAt passed and no settlement after 24h
  try {
    const stale = await sql`
      UPDATE topic_debate
      SET status = 'closed'
      WHERE status IN ('open', 'scoring')
        AND closes_at < NOW() - INTERVAL '24 hours'
        AND resolved_outcome IS NULL
        AND total_participants > 0
      RETURNING id
    `;
    autoFixed.staleDebatesMarkedClosed = stale.length;
    if (stale.length > 0) {
      issues.push(`Auto-fixed: Closed ${stale.length} stale debates (>24h past closesAt, no settlement)`);
    }
  } catch (e) {
    issues.push(`Auto-fix (stale debates) failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // =========================================================================
  // Compute overall status
  // =========================================================================

  const allStatuses = [
    dbCheck.status,
    agentsCheck.status,
    debatesCheck.status,
    topicsCheck.status,
    billingCheck.status,
    settlementsCheck.status,
    walletsCheck.status,
  ];
  let overallStatus: CheckStatus = 'healthy';
  if (allStatuses.includes('critical')) overallStatus = 'critical';
  else if (allStatuses.includes('degraded')) overallStatus = 'degraded';

  const report: QCReport = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    checks: {
      database: dbCheck,
      agents: agentsCheck,
      debates: debatesCheck,
      topics: topicsCheck,
      billing: billingCheck,
      settlements: settlementsCheck,
      wallets: walletsCheck,
    },
    autoFixed,
    issues,
    recommendations,
  };

  // =========================================================================
  // Store report in DB (create table if needed)
  // =========================================================================

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS qc_report (
        id text PRIMARY KEY,
        status text NOT NULL,
        duration_ms integer DEFAULT 0,
        checks jsonb NOT NULL,
        issues text[],
        recommendations text[],
        auto_fixed integer DEFAULT 0,
        created_at timestamp DEFAULT now()
      )
    `;

    const reportId = genId();
    const totalAutoFixed = autoFixed.expiredDebatesClosed + autoFixed.walletResetsApplied + autoFixed.staleDebatesMarkedClosed;
    await sql`
      INSERT INTO qc_report (id, status, duration_ms, checks, issues, recommendations, auto_fixed, created_at)
      VALUES (
        ${reportId},
        ${report.status},
        ${report.durationMs},
        ${JSON.stringify(report.checks)}::jsonb,
        ${report.issues},
        ${report.recommendations},
        ${totalAutoFixed},
        NOW()
      )
    `;
  } catch (e) {
    // Non-critical: don't fail the report if storage fails
    issues.push(`Report storage failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  // =========================================================================
  // Prune old reports (keep last 100)
  // =========================================================================
  try {
    await sql`
      DELETE FROM qc_report
      WHERE id NOT IN (
        SELECT id FROM qc_report ORDER BY created_at DESC LIMIT 100
      )
    `;
  } catch {
    // ignore prune errors
  }

  return apiSuccess(report);
}
