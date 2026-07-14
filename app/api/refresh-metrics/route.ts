import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { pollMetrics } from '@/lib/agent/steps/metrics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FRESH_WINDOW_MS = 8 * 60 * 1000;

/**
 * On-visit freshness: the scheduled poller (GitHub Actions) is best-effort and
 * often lags to ~hourly, so pages ping this when their data looks old. Runs a
 * bounded metrics snapshot synchronously if the newest one is stale.
 * Desk-auth protected by the middleware (not in PUBLIC_PATHS).
 */
export async function POST(): Promise<NextResponse> {
  if (!isLiveBackend()) return NextResponse.json({ ok: true, skipped: 'mock backend' });
  const db = getDb();
  try {
    const { rows } = await db.query<{ t: string | Date | null }>(`select max(captured_at) as t from listing_metrics`);
    const newest = rows[0]?.t ? new Date(rows[0].t as string).getTime() : 0;
    if (Date.now() - newest < FRESH_WINDOW_MS) {
      return NextResponse.json({ ok: true, fresh: true });
    }
    const result = await pollMetrics(db, getEbayAdapter(), 12);
    return NextResponse.json({ ok: true, refreshed: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
