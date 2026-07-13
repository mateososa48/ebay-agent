import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths reachable without logging in:
//  - the login page itself + the privacy policy
//  - eBay's OAuth callback (eBay's servers hit this with no cookie) + health
//  - the eve agent endpoints: the durable workflow runtime re-invokes steps via
//    internal server-to-server calls that carry no browser cookie, so gating these
//    would break the agent mid-run. The UI that drives them is gated at the page
//    level, so this only exposes the raw (unguessable) agent URLs.
const PUBLIC_PATHS = [
  '/login',
  '/privacy',
  '/api/ebay/callback',
  '/api/health',
  '/eve',
  '/.well-known',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const token = process.env.EVE_APP_TOKEN;
  // Auth not configured (e.g. local dev) → don't lock anyone out.
  if (!token) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (req.cookies.get('desk_auth')?.value === token) return NextResponse.next();

  // Unauthenticated. APIs + the agent endpoint get a hard 401; pages redirect to login.
  if (pathname.startsWith('/api/') || pathname.startsWith('/eve/')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals + static image assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)'],
};
