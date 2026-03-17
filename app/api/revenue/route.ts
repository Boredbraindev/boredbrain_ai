export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/revenue — Platform revenue stats for homepage hero.
 * Uses raw SQL (edge-compatible) to aggregate from multiple tables.
 * Each query is independent — if a table doesn't exist, we skip it.
 */
export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ totalRevenue: 0, totalVolume: 0, totalTransactions: 0 });
  }

  const sql = neon(dbUrl);

  let totalRevenue = 0;
  let totalVolume = 0;
  let totalTransactions = 0;

  // 1) billing_record — inter-agent billing (main revenue source)
  try {
    const rows = await sql`
      SELECT
        COALESCE(SUM(platform_fee), 0)::float as total_fees,
        COALESCE(SUM(total_cost), 0)::float as total_cost,
        COUNT(*)::int as tx_count
      FROM billing_record
      WHERE status = 'completed'
    `;
    if (rows[0]) {
      totalRevenue += Number(rows[0].total_fees ?? 0);
      totalVolume += Number(rows[0].total_cost ?? 0);
      totalTransactions += Number(rows[0].tx_count ?? 0);
    }
  } catch { /* table may not exist */ }

  // 2) external_agent total_earned as volume indicator
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(total_earned), 0)::float as earned
      FROM external_agent
      WHERE status IN ('active', 'verified')
    `;
    const agentEarnings = Number(rows[0]?.earned ?? 0);
    if (agentEarnings > totalVolume) totalVolume = agentEarnings;
  } catch { /* */ }

  // 3) wallet_transaction count
  try {
    const rows = await sql`SELECT COUNT(*)::int as cnt FROM wallet_transaction`;
    totalTransactions += Number(rows[0]?.cnt ?? 0);
  } catch { /* */ }

  // 4) debate participation fees as revenue (2 BBAI per opinion = platform income)
  try {
    const rows2 = await sql`
      SELECT COUNT(*)::int as cnt FROM debate_opinion
    `;
    const opinionCount = Number(rows2[0]?.cnt ?? 0);
    totalRevenue += opinionCount * 2; // 2 BBAI participation fee per opinion
  } catch { /* */ }

  // 5) topic_debate pool as additional volume
  try {
    const rows = await sql`
      SELECT COUNT(*)::int as cnt, COALESCE(SUM(total_pool), 0)::float as pool
      FROM topic_debate
    `;
    totalTransactions += Number(rows[0]?.cnt ?? 0);
    totalVolume += Number(rows[0]?.pool ?? 0);
  } catch { /* */ }

  // 5) debate_opinion count as additional transactions
  try {
    const rows = await sql`SELECT COUNT(*)::int as cnt FROM debate_opinion`;
    totalTransactions += Number(rows[0]?.cnt ?? 0);
  } catch { /* */ }

  // 6) payment_transaction (if exists — on-chain payments)
  try {
    const rows = await sql`
      SELECT
        COALESCE(SUM(platform_fee), 0)::float as fees,
        COALESCE(SUM(amount), 0)::float as vol,
        COUNT(*)::int as cnt
      FROM payment_transaction
      WHERE status = 'confirmed'
    `;
    if (rows[0]) {
      totalRevenue += Number(rows[0].fees ?? 0);
      totalVolume += Number(rows[0].vol ?? 0);
      totalTransactions += Number(rows[0].cnt ?? 0);
    }
  } catch { /* table may not exist */ }

  return NextResponse.json(
    {
      totalRevenue: Math.round(totalRevenue),
      totalVolume: Math.round(totalVolume),
      totalTransactions,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
