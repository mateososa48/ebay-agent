import type { ItemIdentity, Comp, ListingDraft } from '../types';

export interface IdentifyByImageInput {
  images: string[]; // base64 data or storage refs (opaque to the adapter contract)
  sellerNotes?: string;
}

export interface PublishResult {
  ebayListingId: string;
  url: string;
}

/**
 * The single seam between the agent and eBay. Two implementations exist:
 * `mock` (deterministic fixtures, used everywhere until the keyset lands) and
 * `live` (real eBay APIs — added in a later plan). Listing publish maps to the
 * Trading API AddFixedPriceItem in `live`, so listings are Negotiation-API-eligible.
 */
export interface EbayAdapter {
  identifyByImage(input: IdentifyByImageInput): Promise<ItemIdentity>;
  findComps(query: { identity: ItemIdentity }): Promise<Comp[]>;
  publishListing(draft: ListingDraft): Promise<PublishResult>;
}
