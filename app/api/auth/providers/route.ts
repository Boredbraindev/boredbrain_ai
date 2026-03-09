import { NextResponse } from 'next/server';

/**
 * Returns which OAuth providers are configured (have both client ID and secret set).
 * The client uses this to conditionally show OAuth sign-in buttons.
 */
export function GET() {
  const providers: Record<string, boolean> = {
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    twitter: Boolean(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
  };

  return NextResponse.json({ providers });
}
