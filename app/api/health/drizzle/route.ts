export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { externalAgent } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    if (!db) return NextResponse.json({ ok: false, error: 'no db' });
    const result = await db.execute(sql`SELECT count(*) as cnt FROM external_agent`);
    return NextResponse.json({ ok: true, result: result.rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
