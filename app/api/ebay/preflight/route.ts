import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { suggestCategoryId } from '@/lib/ebay/category';
import { getSellerPostalCode } from '@/lib/ebay/trading';
import { getSellerPolicyIds } from '@/lib/ebay/account';
import { getListingDefaults } from '@/lib/db/repos/settings';
import { getListing } from '@/lib/db/repos/listings';
import { getItem } from '@/lib/db/repos/items';
import type { ItemCondition } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Publish preflight: runs eBay's VerifyAddFixedPriceItem (dry run — creates
 * nothing) for a draft and returns the full error list + which shipping mode
 * was used. CRON_SECRET-guarded diagnostic; the only way to debug the publish
 * path, since eBay credentials exist only in this deployment.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isLiveBackend()) return NextResponse.json({ ok: false, error: 'mock backend' });

  const { listingId } = (await req.json().catch(() => ({}))) as { listingId?: string };
  if (!listingId) return NextResponse.json({ ok: false, error: 'listingId required' }, { status: 400 });

  const db = getDb();
  const listing = await getListing(db, listingId);
  if (!listing) return NextResponse.json({ ok: false, error: 'listing not found' }, { status: 404 });
  const item = await getItem(db, listing.itemId);
  if (!item) return NextResponse.json({ ok: false, error: 'item not found' }, { status: 404 });

  const defaults = await getListingDefaults(db);
  const categoryId =
    listing.ebayCategoryId ?? (await suggestCategoryId(listing.title).catch(() => null)) ?? '11483';
  const postalCode =
    defaults.shipZip.trim() || (await getSellerPostalCode().catch(() => null)) || process.env.SELLER_POSTAL_CODE || '';
  const sellerProfiles = (await getSellerPolicyIds()) ?? undefined;

  const verify = await getEbayAdapter()
    .verifyListing({
      title: listing.title,
      description: listing.description,
      price: listing.price ?? 0,
      categoryId,
      condition: (listing.condition as ItemCondition) ?? 'used_good',
      aspects: listing.specifics,
      photoUrls: item.photos,
      postalCode,
      shippingMode: defaults.shipMode,
      shippingCost: defaults.shipCost,
      returnWindow: defaults.returnWindow,
      handlingDays: defaults.handlingDays,
      sellerProfiles,
    })
    .catch((e: Error) => ({ ok: false, errors: [e.message] }));

  return NextResponse.json({
    ok: verify.ok,
    errors: verify.errors,
    mode: sellerProfiles ? 'business-policies' : 'inline',
    policies: sellerProfiles ?? null,
    categoryId,
    postalCode: postalCode ? 'set' : 'MISSING',
  });
}
