import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { getSetting, getListingDefaults } from '@/lib/db/repos/settings';
import { pollSales } from '@/lib/agent/steps/sales';
import { pollMessages } from '@/lib/agent/steps/messages';
import { pollOffers } from '@/lib/agent/steps/offers';
import { draftBuyerReply, fallbackReply } from '@/lib/ai/draft';

export const dynamic = 'force-dynamic';
// 60s is safe on the Hobby plan. Collectors are idempotent, so if a run ever
// times out mid-way the next poll simply picks up where it left off.
export const maxDuration = 60;

/**
 * Buyer-automation poller — invoked by Vercel Cron (daily safety net) and the
 * GitHub Actions schedule (~15 min). Requires `Authorization: Bearer $CRON_SECRET`
 * when the secret is configured.
 *
 * Collectors:
 *  - sales   (autonomous, read-only): mark sold items sold.
 *  - messages (approval-gated): DRAFT replies to buyer questions → approval queue.
 *  - offers   (approval-gated): DRAFT discount offers to interested buyers → approval queue.
 * Nothing is ever sent to a buyer from this route. Each collector is isolated —
 * one failing never blocks the others. Never throws; returns a JSON summary.
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

  // Sale detection — read-only, on unless disabled.
  try {
    if ((await getSetting(db, 'automation_sales')) !== 'false') {
      result.sales = await pollSales(db, ebay);
    } else result.sales = { skipped: 'disabled' };
  } catch (e) {
    result.salesError = (e as Error).message;
  }

  // Buyer-message reply drafts — approval-gated, on unless disabled.
  try {
    if ((await getSetting(db, 'automation_messages')) !== 'false') {
      const model = (await getSetting(db, 'model')) ?? 'openai/gpt-5.4';
      result.messages = await pollMessages(db, ebay, async (q, listing) => {
        try {
          return await draftBuyerReply(
            {
              question: q.body,
              buyer: q.senderId,
              listing: {
                title: listing.title,
                price: listing.price,
                condition: listing.condition,
                description: listing.description,
                specifics: listing.specifics,
              },
            },
            model,
          );
        } catch {
          return fallbackReply(); // model hiccup → safe holding reply, still approval-gated
        }
      });
    } else result.messages = { skipped: 'disabled' };
  } catch (e) {
    result.messagesError = (e as Error).message;
  }

  // Offer drafts to interested buyers — approval-gated, on unless disabled.
  try {
    if ((await getSetting(db, 'automation_offers')) !== 'false') {
      const raw = Number((await getSetting(db, 'offer_discount_pct')) ?? 10);
      const discount = Number.isFinite(raw) ? raw : 10;
      result.offers = await pollOffers(db, ebay, discount);
    } else result.offers = { skipped: 'disabled' };
  } catch (e) {
    result.offersError = (e as Error).message;
  }

  // Touch listing defaults so a mis-set ZIP etc. surfaces in logs early (cheap, cached row).
  try {
    await getListingDefaults(db);
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true, ...result });
}
