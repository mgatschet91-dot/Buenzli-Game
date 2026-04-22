import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createNextMiddleware } from 'gt-next/middleware';

const gtProxy = createNextMiddleware({
  // Cookie-basierter Sprachwechsel ohne URL-Prefix.
  localeRouting: false,
});

const IS_ELECTRON = process.env.NEXT_PUBLIC_PLATFORM === 'electron';

const ELECTRON_BLOCKED = [
  '/basel-gemeinde-simulator',
  '/bern-gemeinde-simulator',
  '/gemeinde-simulator-schweiz',
  '/schweizer-gemeinde-spiele',
  '/solothurn-gemeinde-simulator',
  '/zuerich-gemeinde-simulator',
  '/datenschutz',
  '/impressum',
  '/kontakt',
  '/thumbnail',
  '/faq',
];

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Electron: Web-only Routen blockieren
  if (IS_ELECTRON) {
    const blocked = ELECTRON_BLOCKED.some(r => pathname === r || pathname.startsWith(r + '/'));
    if (blocked) return NextResponse.redirect(new URL('/steam', request.url));
  }

  // iso-coaster.com Domain
  if (hostname.includes('iso-coaster.com')) {
    if (pathname === '/') return NextResponse.rewrite(new URL('/coaster', request.url));
  }

  return await gtProxy(request);
}

// Configure which paths the proxy runs on
export const config = {
  matcher: [
    // Match pages only (exclude API, Next internals and static/i18n assets)
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|_gt/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
};
