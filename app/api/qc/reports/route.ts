export const runtime = 'edge';

/**
 * GET /api/qc/reports — View recent QC reports
 *
 * Query params:
 *   - limit: number of reports (default 10, max 50)
 *   - status: filter by status ('healthy' | 'degraded' | 'critical')
 */

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { verifyCron } from '@/lib/verify-cron';

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return apiError('DATABASE_URL not configured', 500);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 1), 50);
  const statusFilter = searchParams.get('status');

  const sql = neon(dbUrl);

  try {
    // Ensure table exists
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

    let reports;
    if (statusFilter && ['healthy', 'degraded', 'critical'].includes(statusFilter)) {
      reports = await sql`
        SELECT id, status, duration_ms, checks, issues, recommendations, auto_fixed, created_at
        FROM qc_report
        WHERE status = ${statusFilter}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      reports = await sql`
        SELECT id, status, duration_ms, checks, issues, recommendations, auto_fixed, created_at
        FROM qc_report
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    // Summary stats
    const [stats] = await sql`
      SELECT
        COUNT(*)::int AS total_reports,
        COUNT(*) FILTER (WHERE status = 'healthy')::int AS healthy_count,
        COUNT(*) FILTER (WHERE status = 'degraded')::int AS degraded_count,
        COUNT(*) FILTER (WHERE status = 'critical')::int AS critical_count,
        COALESCE(SUM(auto_fixed), 0)::int AS total_auto_fixes,
        MAX(created_at) AS last_report_at
      FROM qc_report
    `;

    return apiSuccess({
      reports,
      summary: {
        totalReports: stats.total_reports ?? 0,
        healthyCount: stats.healthy_count ?? 0,
        degradedCount: stats.degraded_count ?? 0,
        criticalCount: stats.critical_count ?? 0,
        totalAutoFixes: stats.total_auto_fixes ?? 0,
        lastReportAt: stats.last_report_at ? new Date(stats.last_report_at).toISOString() : null,
      },
    });
  } catch (e) {
    return apiError(`Failed to fetch QC reports: ${e instanceof Error ? e.message : 'unknown'}`, 500);
  }
}
