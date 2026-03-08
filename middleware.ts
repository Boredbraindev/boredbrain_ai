// Import NextResponse directly to avoid loading ua-parser-js (uses __dirname, crashes Edge Runtime)
// next/server.js eagerly require()s ALL exports including userAgent → ua-parser-js → __dirname
import { NextResponse } from 'next/dist/server/web/spec-extension/response';
import type { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const authRoutes = ['/sign-in', '/sign-up'];

/** Add common security headers to a response. */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate-limit all /api/* routes: 60 req/min per IP ──────────────
  if (pathname.startsWith('/api/')) {
    const { success, remaining, resetAt } = rateLimit(request, {
      maxRequests: 60,
      windowMs: 60_000,
    });

    if (!success) {
      return applySecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit': '60',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
            },
          },
        ),
      );
    }

    // Attach rate-limit + security headers to successful API responses
    const response = NextResponse.next();
    applySecurityHeaders(response);
    response.headers.set('X-RateLimit-Limit', '60');
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    // For public API routes, return early with rate-limit headers
    if (
      pathname.startsWith('/api/raycast') ||
      pathname.startsWith('/api/tools') ||
      pathname.startsWith('/api/a2a') ||
      pathname.startsWith('/api/mcp') ||
      pathname.startsWith('/api/arena') ||
      pathname.startsWith('/api/agents') ||
      pathname.startsWith('/api/keys') ||
      pathname.startsWith('/api/revenue') ||
      pathname.startsWith('/api/playbooks') ||
      pathname.startsWith('/api/marketplace') ||
      pathname.startsWith('/api/network') ||
      pathname.startsWith('/api/auth')
    ) {
      return response;
    }

    // For other /api/* routes, check auth below but carry rate-limit headers.
    // Guest-access bypass
    const allowGuestApi =
      (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? process.env.ALLOW_GUEST_ACCESS ?? 'false') !== 'false';
    if (allowGuestApi) return response;

    // Auth check for remaining API routes
    const apiSessionToken =
      request.cookies.get('better-auth.session_token')?.value ||
      request.cookies.get('better_auth.session_token')?.value ||
      request.cookies.get('__Secure-better-auth.session_token')?.value;

    if (!apiSessionToken) {
      return applySecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Unauthorized' },
          {
            status: 401,
            headers: {
              'X-RateLimit-Limit': '60',
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
            },
          },
        ),
      );
    }

    return response;
  }

  // ── Non-API routes below ─────────────────────────────────────────

  // .well-known (no rate-limiting needed)
  if (pathname.startsWith('/.well-known')) {
    return NextResponse.next();
  }

  const allowGuestAccess =
    (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? process.env.ALLOW_GUEST_ACCESS ?? 'false') !== 'false';

  // Public frontend pages
  if (
    pathname === '/' ||
    pathname.startsWith('/arena') ||
    pathname.startsWith('/agents') ||
    pathname.startsWith('/stats') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/network') ||
    pathname.startsWith('/playbooks')
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  // If guest access is allowed, let everyone through
  if (allowGuestAccess) {
    return NextResponse.next();
  }

  // Check session via cookie
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('better_auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  const isAuthenticated = !!sessionToken;
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // If user is authenticated but trying to access auth routes
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!isAuthenticated && !isAuthRoute) {
    // Allow marketing/success page
    if (pathname.startsWith('/success')) {
      return NextResponse.next();
    }

    // Allow _next paths
    if (pathname.startsWith('/_next')) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
