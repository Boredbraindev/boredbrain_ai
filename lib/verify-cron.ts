import { NextRequest } from 'next/server';

/**
 * Shared cron/admin authentication for API routes.
 *
 * Security model:
 *   - Dev mode: allow if no CRON_SECRET configured AND NODE_ENV === 'development'
 *   - Fail closed: if no secret in production, reject everything
 *   - Only accepts Bearer token auth (no x-vercel-cron header, no upstash-signature,
 *     no query param — these are all spoofable or leak secrets in logs)
 *
 * Usage:
 *   import { verifyCron } from '@/lib/verify-cron';
 *   if (!verifyCron(request)) return apiError('Unauthorized', 401);
 */
export function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Dev mode: allow if no secret configured AND in development
  if (!secret && process.env.NODE_ENV === 'development') return true;

  // Fail closed: if no secret in production, reject everything
  if (!secret) return false;

  // Only accept Bearer token auth
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }

  return false;
}
