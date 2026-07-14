import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { getSetting } from '@/lib/db/repos/settings';
import { pollSales } from '@/lib/agent/steps/sales';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Buyer-automation poller, invoked by Vercel Cron (see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set — we
 * require it when configured, so a stray public hit can't drive the poller.
 * Read-only collectors (sales) run autonomously; buyer-facing ones enqueue
 * approvals (added in later phases). Never throws — returns a JSON summary.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isLiveBackend()) {
    return NextResponse.json({ ok: true, skipped: 'mock backend' });
  }

  const db = getDb();
  const ebay = getEbayAdapter();
  const result: Record<string, unknown> = {};

  // Sale detection — read-only, on by default.
  try {
    const salesOn = (await getSetting(db, 'automation_sales')) !== 'false';
    if (salesOn) result.sales = await pollSales(db, ebay);
    else result.sales = { skipped: 'disabled' };
  } catch (e) {
    result.salesError = (e as Error).message;
  }

  return NextResponse.json({ ok: true, ...result });
}
