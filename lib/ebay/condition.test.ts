// lib/ebay/condition.test.ts
import { describe, it, expect } from 'vitest';
import { conditionToEbayId } from './condition';

describe('conditionToEbayId', () => {
  it('maps new to 1000', () => expect(conditionToEbayId('new')).toBe(1000));
  it('maps open_box to 1500', () => expect(conditionToEbayId('open_box')).toBe(1500));
  it('maps used grades to 3000', () => {
    expect(conditionToEbayId('used_like_new')).toBe(3000);
    expect(conditionToEbayId('used_good')).toBe(3000);
    expect(conditionToEbayId('used_fair')).toBe(3000);
  });
  it('maps for_parts to 7000', () => expect(conditionToEbayId('for_parts')).toBe(7000));
});
