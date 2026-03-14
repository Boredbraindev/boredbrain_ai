import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'edge';
export const maxDuration = 10;

export async function GET(request: Request) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ ok: false, error: 'No DATABASE_URL' });
  }

  try {
    const sql = neon(dbUrl);
    const start = Date.now();
    const table = new URL(request.url).searchParams.get('table');
    if (table) {
      const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${table} ORDER BY ordinal_position`;
      return NextResponse.json({ ok: true, table, columns: cols });
    }
    const result = await sql`SELECT 1 as ping`;
    const elapsed = Date.now() - start;
    return NextResponse.json({ ok: true, elapsed, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
