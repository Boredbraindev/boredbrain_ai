export const runtime = 'nodejs';
export const maxDuration = 10;

import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ ok: true, runtime: 'nodejs', ts: Date.now() });
}
