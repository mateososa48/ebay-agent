import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, EBAY_USER_SCOPES } from '@/lib/ebay/oauth';
import { getDb } from '@/lib/db/client';
import { saveEbayConnection } from '@/lib/db/repos/connection';

export const dynamic = 'force-dynamic';

// eBay redirects the seller here after they approve. We exchange the code for
// a refresh token and store it, then bounce back to Settings.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) return NextResponse.redirect(new URL('/settings?ebay=denied', url.origin));
  if (!code) return NextResponse.redirect(new URL('/settings?ebay=error', url.origin));

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);
    await saveEbayConnection(getDb(), { refreshToken, scopes: EBAY_USER_SCOPES });
    return NextResponse.redirect(new URL('/settings?ebay=connected', url.origin));
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/settings?ebay=error&msg=${encodeURIComponent((e as Error).message)}`, url.origin),
    );
  }
}
