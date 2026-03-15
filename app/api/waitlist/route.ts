export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// ─── GET /api/waitlist — Get waitlist count ──────────────────────────────────

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT COUNT(*)::int AS count FROM waitlist`;
    return NextResponse.json({ count: rows[0]?.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

// ─── POST /api/waitlist — Join waitlist ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email ?? '').trim().toLowerCase();

    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (email.length > 320) {
      return NextResponse.json({ error: 'Email too long' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        referral_source TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Check if already registered
    const existing = await sql`SELECT id FROM waitlist WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      // Return their position
      const posRows = await sql`
        SELECT COUNT(*)::int AS pos FROM waitlist WHERE id <= ${existing[0].id}
      `;
      return NextResponse.json({
        success: true,
        position: posRows[0]?.pos ?? 1,
        message: 'You are already on the waitlist!',
        alreadyRegistered: true,
      });
    }

    // Get referral source from header or body
    const referralSource = body.source ?? request.headers.get('referer') ?? null;

    // Insert
    const inserted = await sql`
      INSERT INTO waitlist (email, referral_source)
      VALUES (${email}, ${referralSource})
      RETURNING id
    `;

    const id = inserted[0]?.id;

    // Get position
    const posRows = await sql`SELECT COUNT(*)::int AS pos FROM waitlist WHERE id <= ${id}`;
    const position = posRows[0]?.pos ?? 1;

    return NextResponse.json({
      success: true,
      position,
      message: 'Welcome to the waitlist!',
    });
  } catch (err: any) {
    // Unique constraint violation = already registered
    if (err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
      return NextResponse.json({
        success: true,
        message: 'You are already on the waitlist!',
        alreadyRegistered: true,
      });
    }

    console.error('[api/waitlist] Error:', err);
    return NextResponse.json(
      { error: 'Failed to join waitlist. Please try again.' },
      { status: 500 },
    );
  }
}
