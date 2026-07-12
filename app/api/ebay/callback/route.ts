import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, EBAY_USER_SCOPES } from '@/lib/ebay/oauth';
import { getDb } from '@/lib/db/client';
import { saveEbayConnection } from '@/lib/db/repos/connection';

export const dynamic = 'force-dynamic';

// eBay redirects the seller here after they approve. eBay also *validates* this
// URL (a bare GET) when you save it as a RuName redirect — so a plain GET with
// no code must return a clean 200, or eBay rejects the URL and falls back to its
// own "safe to close" page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Validation ping (no code, no error): answer 200 so eBay accepts the URL.
  if (!code && !error) {
    return new Response('eBay OAuth callback is ready.', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }

  if (error) return NextResponse.redirect(new URL('/settings?ebay=denied', url.origin));

  try {
    const { refreshToken } = await exchangeCodeForTokens(code!);
    await saveEbayConnection(getDb(), { refreshToken, scopes: EBAY_USER_SCOPES });
    return NextResponse.redirect(new URL('/settings?ebay=connected', url.origin));
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/settings?ebay=error&msg=${encodeURIComponent((e as Error).message)}`, url.origin),
    );
  }
}
