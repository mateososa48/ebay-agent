import { NextResponse } from 'next/server';
import { getUserAccessToken } from '@/lib/ebay/oauth';

export const dynamic = 'force-dynamic';

// Diagnostic: proves the stored refresh token can mint a live user access token.
// Never returns the token itself — only its length, so it's safe to hit publicly.
export async function GET() {
  try {
    const token = await getUserAccessToken();
    return NextResponse.json({ ok: true, minted: true, tokenLength: token.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
