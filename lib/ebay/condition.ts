// lib/ebay/condition.ts
import type { ItemCondition } from '../types';

/** Map our condition grades to eBay ConditionID. Universal IDs; category-specific
 *  invalids (e.g. media wanting 2750) are caught by the Verify preflight. */
export function conditionToEbayId(condition: ItemCondition): number {
  switch (condition) {
    case 'new': return 1000;
    case 'open_box': return 1500;
    case 'used_like_new':
    case 'used_good':
    case 'used_fair': return 3000;
    case 'for_parts': return 7000;
    default: return 3000; // belt-and-suspenders for out-of-union values from free-text DB columns
  }
}

/** Reverse map for imports: eBay ConditionID → our closest grade. */
export function ebayIdToCondition(id: number | null): ItemCondition {
  if (id == null) return 'used_good';
  if (id === 1000) return 'new';
  if (id > 1000 && id < 2000) return 'open_box'; // 1500 new-other, 1750 with-defects
  if (id >= 2000 && id < 3000) return 'used_like_new'; // refurbished band
  if (id >= 7000) return 'for_parts';
  return 'used_good'; // 3000-6000 used band
}
