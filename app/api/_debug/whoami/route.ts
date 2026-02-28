import { cookies, headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const hasSession = cookieStore.has('better_auth.session_token');
  const cookieNames = allCookies.map((cookie) => cookie.name);
  const headerStore = await headers();
  const origin = headerStore.get('origin') ?? null;

  return Response.json({
    hasSession,
    cookieNames,
    origin,
  });
}
