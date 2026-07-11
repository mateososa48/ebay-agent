// Core domain types shared across the eBay adapter and the voice linter.

export type ItemCondition =
  | 'new'
  | 'open_box'
  | 'used_like_new'
  | 'used_good'
  | 'used_fair'
  | 'for_parts';

/** What the agent believes the item is, after identification. */
export interface ItemIdentity {
  brand?: string;
  productType: string; // e.g. "Straight Leg Jeans"
  model?: string;
  categoryId?: string; // eBay leaf category id
  aspects: Record<string, string>; // item specifics: { Size: "34x32", Color: "Blue" }
  confidence: number; // 0..1
  ambiguities: string[]; // things to confirm with the seller
}

/** A comparable listing used as price evidence. Never expose `ref` to buyers. */
export interface Comp {
  source: string; // e.g. "ebay-active"
  title: string;
  price: number; // USD dollars
  sold: boolean;
  ref?: string; // opaque internal reference, NOT a buyer-facing URL
  capturedAt: string; // ISO 8601
}

export interface PriceEstimate {
  suggested: number;
  low: number;
  high: number;
  currency: 'USD';
  rationale: string;
  comps: Comp[];
}

/** A publish-ready listing draft. */
export interface ListingDraft {
  title: string;
  aspects: Record<string, string>;
  description: string;
  price: number; // USD dollars
  condition: ItemCondition;
}
