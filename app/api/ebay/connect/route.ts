import { NextResponse } from 'next/server';
import { getConsentUrl } from '@/lib/ebay/oauth';

export const dynamic = 'force-dynamic';

// Kicks off the one-time eBay OAuth consent.
export async function GET() {
  try {
    return NextResponse.redirect(getConsentUrl());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
