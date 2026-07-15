import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { suggestCategoryId } from '@/lib/ebay/category';
import { getSellerPostalCode, tradingRequest } from '@/lib/ebay/trading';
import { getSellerPolicyIds } from '@/lib/ebay/account';
import { ebayApiBase, getUserAccessToken } from '@/lib/ebay/oauth';
import { conditionToEbayId } from '@/lib/ebay/condition';
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

  // ---- deep diagnostics (temporary; safe read-only calls) ----
  const token = await getUserAccessToken();
  const authed = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Which programs is the account opted into? SELLING_POLICY_MANAGEMENT = business policies.
  const programs = await fetch(`${ebayApiBase()}/sell/account/v1/program/get_opted_in_programs`, { headers: authed })
    .then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 400) }))
    .catch((e: Error) => ({ status: 0, body: e.message }));

  // Raw policy endpoints for two marketplaces (account may be homed off EBAY_US).
  const policyProbe: Record<string, unknown> = {};
  for (const mkt of ['EBAY_US', 'EBAY_ES']) {
    for (const path of ['fulfillment_policy', 'payment_policy', 'return_policy']) {
      const r = await fetch(`${ebayApiBase()}/sell/account/v1/${path}?marketplace_id=${mkt}`, { headers: authed }).catch(
        () => null,
      );
      policyProbe[`${mkt}:${path}`] = r
        ? { status: r.status, body: (await r.text()).slice(0, 240) }
        : { status: 0 };
    }
  }

  // XML variant matrix — find the shape eBay accepts (Verify = dry run).
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const specifics = Object.entries(listing.specifics)
    .filter(([, v]) => v && v.trim())
    .map(([n, v]) => `<NameValueList><Name>${esc(n)}</Name><Value>${esc(v)}</Value></NameValueList>`)
    .join('');
  const pictures = item.photos.map((u) => `<PictureURL>${esc(u)}</PictureURL>`).join('');
  const itemXml = (shippingBlock: string) => `<?xml version="1.0" encoding="utf-8"?>
<VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${esc(listing.title)}</Title>
    <Description><![CDATA[${listing.description}]]></Description>
    <PrimaryCategory><CategoryID>${esc(categoryId)}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">${(listing.price ?? 0).toFixed(2)}</StartPrice>
    <ConditionID>${conditionToEbayId((listing.condition as ItemCondition) ?? 'used_good')}</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PictureDetails>${pictures}</PictureDetails>
    <PostalCode>${esc(postalCode)}</PostalCode>
    <Quantity>1</Quantity>
    <ItemSpecifics>${specifics}</ItemSpecifics>
    <ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>
    ${shippingBlock}
  </Item>
</VerifyAddFixedPriceItemRequest>`;

  const variants: Record<string, string> = {
    // schema order inside ShippingServiceOptions: Service, Cost, Priority; FreeShipping last
    schemaOrder: `<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingService>USPSGroundAdvantage</ShippingService><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost><ShippingServicePriority>1</ShippingServicePriority><FreeShipping>true</FreeShipping></ShippingServiceOptions></ShippingDetails>`,
    noFreeFlag: `<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingService>USPSGroundAdvantage</ShippingService><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost><ShippingServicePriority>1</ShippingServicePriority></ShippingServiceOptions></ShippingDetails>`,
    uspsPriority: `<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingService>USPSPriority</ShippingService><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost><ShippingServicePriority>1</ShippingServicePriority><FreeShipping>true</FreeShipping></ShippingServiceOptions></ShippingDetails>`,
    noShippingAtAll: ``,
  };
  const matrix: Record<string, unknown> = {};
  for (const [name, block] of Object.entries(variants)) {
    try {
      const res = await tradingRequest('VerifyAddFixedPriceItem', itemXml(block));
      matrix[name] = { ack: res.ack, errors: res.errors };
    } catch (e) {
      matrix[name] = { threw: (e as Error).message.slice(0, 200) };
    }
  }

  return NextResponse.json({
    ok: verify.ok,
    errors: verify.errors,
    mode: sellerProfiles ? 'business-policies' : 'inline',
    policies: sellerProfiles ?? null,
    categoryId,
    postalCode: postalCode ? 'set' : 'MISSING',
    programs,
    policyProbe,
    matrix,
  });
}
