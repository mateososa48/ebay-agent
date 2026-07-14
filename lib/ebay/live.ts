import type {
  EbayAdapter,
  IdentifyByImageInput,
  PublishResult,
  PublishListingInput,
  VerifyResult,
  EbaySale,
  EbayBuyerQuestion,
  BuyerReplyInput,
  SendOfferInput,
  EbayActiveListing,
  EbayItemDetails,
  EbayListingStats,
} from './types';
import type { ItemIdentity, Comp } from '../types';
import { MockEbayAdapter } from './mock';
import { getAppToken, ebayApiBase } from './oauth';
import { buildFixedPriceItemXml } from './listing-xml';
import {
  tradingRequest,
  getRecentSales,
  getBuyerQuestions,
  replyToBuyerQuestion,
  getActiveListings,
  getItemDetails,
  reviseListingPrice,
  getListingStats,
} from './trading';
import { getEligibleOfferListingIds, sendOfferToInterestedBuyers } from './negotiation';

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

  async verifyListing(input: PublishListingInput): Promise<VerifyResult> {
    const res = await tradingRequest(
      'VerifyAddFixedPriceItem',
      buildFixedPriceItemXml(input, { verify: true }),
    );
    return { ok: res.ack === 'Success' || res.ack === 'Warning', errors: res.errors };
  }

  async publishListing(input: PublishListingInput): Promise<PublishResult> {
    const res = await tradingRequest(
      'AddFixedPriceItem',
      buildFixedPriceItemXml(input, { verify: false }),
    );
    if ((res.ack !== 'Success' && res.ack !== 'Warning') || !res.itemId) {
      throw new Error(res.errors.join('; ') || `eBay AddFixedPriceItem returned ${res.ack}`);
    }
    return { ebayListingId: res.itemId, url: `https://www.ebay.com/itm/${res.itemId}` };
  }

  getRecentSales(days?: number): Promise<EbaySale[]> {
    return getRecentSales(days);
  }

  getBuyerQuestions(days?: number): Promise<EbayBuyerQuestion[]> {
    return getBuyerQuestions(days);
  }

  replyToBuyerQuestion(input: BuyerReplyInput): Promise<void> {
    return replyToBuyerQuestion(input);
  }

  getEligibleOfferListingIds(): Promise<string[]> {
    return getEligibleOfferListingIds();
  }

  sendOfferToInterestedBuyers(input: SendOfferInput): Promise<void> {
    return sendOfferToInterestedBuyers(input);
  }

  getActiveListings(): Promise<EbayActiveListing[]> {
    return getActiveListings();
  }

  getItemDetails(ebayListingId: string): Promise<EbayItemDetails | null> {
    return getItemDetails(ebayListingId);
  }

  reviseListingPrice(input: { ebayListingId: string; priceUsd: number }): Promise<void> {
    return reviseListingPrice(input);
  }

  getListingStats(ebayListingId: string): Promise<EbayListingStats | null> {
    return getListingStats(ebayListingId);
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
