import { NextResponse } from 'next/server';

export const runtime = 'edge';

export function GET() {
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      region: process.env.VERCEL_REGION || 'unknown',
    },
  });
}
