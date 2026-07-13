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
