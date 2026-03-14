import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'edge';
export const maxDuration = 10;

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ ok: false, error: 'No DATABASE_URL' });
  }

  try {
    const sql = neon(dbUrl);
    const results: string[] = [];

    await sql`
      CREATE TABLE IF NOT EXISTS arena_match (
        id text PRIMARY KEY,
        topic text NOT NULL,
        match_type text NOT NULL,
        agents json NOT NULL,
        winner_id text,
        rounds json,
        total_votes integer DEFAULT 0,
        result_tx_hash text,
        prize_pool text DEFAULT '0',
        elo_change integer,
        status text DEFAULT 'pending',
        created_at timestamp DEFAULT now() NOT NULL,
        completed_at timestamp
      )
    `;
    results.push('arena_match');

    await sql`
      CREATE TABLE IF NOT EXISTS agent_wallet (
        agent_id text PRIMARY KEY,
        balance integer DEFAULT 0 NOT NULL,
        daily_limit integer DEFAULT 200 NOT NULL,
        total_earned integer DEFAULT 0 NOT NULL,
        total_spent integer DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `;
    results.push('agent_wallet');

    return NextResponse.json({ ok: true, created: results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
