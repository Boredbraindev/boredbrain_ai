// Import NextResponse directly to avoid loading ua-parser-js (uses __dirname, crashes Edge Runtime)
// next/server.js eagerly require()s ALL exports including userAgent → ua-parser-js → __dirname
import { NextResponse } from 'next/dist/server/web/spec-extension/response';
import type { NextRequest } from 'next/server';

const authRoutes = ['/sign-in', '/sign-up'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const allowGuestAccess =
    (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? process.env.ALLOW_GUEST_ACCESS ?? 'false') !== 'false';

  // Public API routes that don't require authentication
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
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next();
  }

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
    return NextResponse.next();
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

    // API routes
    if (pathname.startsWith('/api/')) {
      if (pathname.startsWith('/api/auth')) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow _next paths
    if (pathname.startsWith('/_next')) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
