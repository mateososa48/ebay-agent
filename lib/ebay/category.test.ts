// lib/ebay/category.test.ts
import { describe, it, expect } from 'vitest';
import { parseCategorySuggestion } from './category';

describe('parseCategorySuggestion', () => {
  it('returns the first suggestion leaf categoryId', () => {
    const json = { categorySuggestions: [
      { category: { categoryId: '11483', categoryName: 'Jeans' } },
      { category: { categoryId: '999', categoryName: 'Other' } },
    ] };
    expect(parseCategorySuggestion(json)).toBe('11483');
  });
  it('returns null when there are no suggestions', () => {
    expect(parseCategorySuggestion({ categorySuggestions: [] })).toBeNull();
    expect(parseCategorySuggestion({})).toBeNull();
  });
});
