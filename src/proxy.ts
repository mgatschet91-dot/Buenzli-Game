import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createNextMiddleware } from 'gt-next/middleware';

const gtProxy = createNextMiddleware({
  // Cookie-basierter Sprachwechsel ohne URL-Prefix.
  localeRouting: false,
});

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;
  
  // Check if the request is coming from iso-coaster.com
  const isCoasterDomain = hostname.includes('iso-coaster.com');
  
  if (isCoasterDomain) {
    // For the root path on iso-coaster.com, rewrite to /coaster
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/coaster', request.url));
    }
    
    // For other paths on iso-coaster.com, you could either:
    // 1. Rewrite to /coaster/... if you have nested routes
    // 2. Keep them as-is for assets and API routes
    // Currently we just let them pass through
  }

  // Locale-/Sprache-Handling (gt-next)
  return await gtProxy(request);
}

// Configure which paths the proxy runs on
export const config = {
  matcher: [
    // Match pages only (exclude API, Next internals and static/i18n assets)
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|_gt/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
};
