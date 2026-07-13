import type { EbayAdapter, IdentifyByImageInput, PublishResult, PublishListingInput, VerifyResult } from './types';
import type { ItemIdentity, Comp } from '../types';
import { MockEbayAdapter } from './mock';
import { getAppToken, ebayApiBase } from './oauth';

interface BrowseItemSummary {
  itemId?: string;
  title?: string;
  price?: { value?: string };
}

/**
 * Live eBay adapter. Today it makes PRICING real via the Browse API (active
 * comps) using the app token — safe, read-only, no user login. Identification
 * still uses the deterministic notes-based path, and publishing is deferred
 * until the user OAuth connect + business policies are wired. Both fall back to
 * the mock so a live outage never breaks the pipeline.
 */
export class LiveEbayAdapter implements EbayAdapter {
  private mock = new MockEbayAdapter();

  identifyByImage(input: IdentifyByImageInput): Promise<ItemIdentity> {
    // TODO: Browse search_by_image + vision. For now, notes-based identity.
    return this.mock.identifyByImage(input);
  }

  async findComps(query: { identity: ItemIdentity }): Promise<Comp[]> {
    try {
      const comps = await this.browseComps(query.identity);
      if (comps.length >= 2) return comps;
      return this.mock.findComps(query); // too few live results — keep the estimate stable
    } catch {
      return this.mock.findComps(query); // live outage — degrade gracefully
    }
  }

  verifyListing(_input: PublishListingInput): Promise<VerifyResult> {
    throw new Error('verifyListing not wired yet');
  }

  publishListing(_input: PublishListingInput): Promise<PublishResult> {
    throw new Error('publishListing not wired yet');
  }

  private async browseComps(identity: ItemIdentity): Promise<Comp[]> {
    const query = [identity.brand, identity.productType, identity.aspects?.Size]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!query) return [];

    const token = await getAppToken();
    const url = `${ebayApiBase()}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=10`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
    });
    if (!res.ok) throw new Error(`Browse search failed (${res.status})`);

    const data = (await res.json()) as { itemSummaries?: BrowseItemSummary[] };
    const capturedAt = new Date().toISOString();
    return (data.itemSummaries ?? [])
      .map((s): Comp => ({
        source: 'ebay-active',
        title: s.title ?? 'eBay listing',
        price: Number(s.price?.value ?? 0),
        sold: false,
        ref: s.itemId,
        capturedAt,
      }))
      .filter((c) => c.price > 0)
      .slice(0, 8);
  }
}
