import type { ItemIdentity, Comp, ItemCondition } from '../types';

export interface IdentifyByImageInput {
  images: string[]; // base64 data or storage refs (opaque to the adapter contract)
  sellerNotes?: string;
}

export interface PublishResult {
  ebayListingId: string;
  url: string;
}

/** Everything the Trading API needs to list one fixed-price item. */
export interface PublishListingInput {
  title: string;
  description: string;
  price: number; // USD dollars
  categoryId: string; // eBay leaf category id
  condition: ItemCondition;
  aspects: Record<string, string>; // item specifics
  photoUrls: string[]; // public image URLs (Vercel Blob)
  postalCode: string; // ship-from ZIP
  idempotencyKey?: string; // 32-hex UUID; eBay dedupes repeat AddFixedPriceItem calls with the same key
  // Seller defaults (from Settings). Omitted → free shipping / 30-day returns / 3-day handling.
  shippingMode?: 'free' | 'flat';
  shippingCost?: number; // USD, when shippingMode === 'flat'
  returnWindow?: 'days_30' | 'days_60' | 'none';
  handlingDays?: number;
}

export interface VerifyResult {
  ok: boolean;
  errors: string[]; // eBay error LongMessages; empty when ok
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
  verifyListing(input: PublishListingInput): Promise<VerifyResult>;
  publishListing(input: PublishListingInput): Promise<PublishResult>;
}
