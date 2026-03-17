// Import NextResponse directly to avoid loading ua-parser-js (uses __dirname, crashes Edge Runtime)
// next/server.js eagerly require()s ALL exports including userAgent -> ua-parser-js -> __dirname
import { NextResponse } from 'next/dist/server/web/spec-extension/response';
import type { NextRequest } from 'next/server';

const authRoutes = ['/sign-in', '/sign-up'];

// Routes that require authentication (redirect to /sign-in if no session)
const protectedRoutes = ['/dashboard', '/agents/register', '/rewards'];

// Routes that are always public (no auth required)
const publicRoutes = [
  '/',
  '/arena',
  '/agents',
  '/stats',
  '/network',
  '/playbooks',
  '/leaderboard',
  '/predict',
  '/success',
  '/referrals',
  '/economy',
  '/openclaw',
  '/onchain',
  '/docs',
  '/register',
  '/admin',
  '/profile',
  '/guide',
];

/** Check if a pathname matches one of the route prefixes */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

/** Extract Better Auth session token from cookies */
function getSessionToken(request: NextRequest): string | undefined {
  return (
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('better_auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value
  );
}

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
  const hostname = request.headers.get('host') ?? '';

  // ── Subdomain routing: register.boredbrain.app → /register ────────
  if (hostname.startsWith('register.')) {
    // Allow API calls and static assets through
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next')) {
      return NextResponse.next();
    }
    // Rewrite all pages to /register
    if (pathname !== '/register') {
      const url = request.nextUrl.clone();
      url.pathname = '/register';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ── API routes: pass through immediately ──────────────────────────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Non-API routes below ─────────────────────────────────────────

  // .well-known (no rate-limiting needed)
  if (pathname.startsWith('/.well-known')) {
    return NextResponse.next();
  }

  // Allow _next and static paths
  if (pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const allowGuestAccess =
    (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? process.env.ALLOW_GUEST_ACCESS ?? 'false') !== 'false';

  const sessionToken = getSessionToken(request);
  const isAuthenticated = !!sessionToken;
  const isAuthRoute = matchesRoute(pathname, authRoutes);
  const isPublicRoute = matchesRoute(pathname, publicRoutes);
  const isProtectedRoute = matchesRoute(pathname, protectedRoutes);

  // If user is authenticated and trying to access sign-in/sign-up, redirect to dashboard
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Public routes are always accessible
  if (isPublicRoute) {
    return applySecurityHeaders(NextResponse.next());
  }

  // If guest access is allowed, let everyone through
  if (allowGuestAccess) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Auth routes (sign-in, sign-up) are always accessible to unauthenticated users
  if (isAuthRoute) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Protected routes require authentication
  if (isProtectedRoute && !isAuthenticated) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // For any other non-authenticated route, redirect to sign-in
  if (!isAuthenticated && !isPublicRoute && !isAuthRoute) {
    // Allow success page
    if (pathname.startsWith('/success')) {
      return applySecurityHeaders(NextResponse.next());
    }

    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
