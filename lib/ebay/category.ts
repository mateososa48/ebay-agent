// lib/ebay/category.ts
import { ebayApiBase, getAppToken } from './oauth';

interface CategorySuggestionResponse {
  categorySuggestions?: { category?: { categoryId?: string } }[];
}

/** First suggested leaf category id, or null. Pure — unit tested. */
export function parseCategorySuggestion(json: CategorySuggestionResponse): string | null {
  return json.categorySuggestions?.[0]?.category?.categoryId ?? null;
}

const cache = new Map<string, string>();
let treeIdCache: string | undefined;

async function defaultCategoryTreeId(token: string): Promise<string> {
  if (treeIdCache) return treeIdCache;
  const res = await fetch(
    `${ebayApiBase()}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Taxonomy tree id failed (${res.status})`);
  const data = (await res.json()) as { categoryTreeId?: string };
  if (!data.categoryTreeId) throw new Error('Taxonomy returned no categoryTreeId');
  treeIdCache = data.categoryTreeId;
  return treeIdCache;
}

/** Resolve a leaf category id from a listing title, or null if none found. */
export async function suggestCategoryId(title: string): Promise<string | null> {
  const key = title.trim().toLowerCase();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached) return cached;

  const token = await getAppToken();
  const treeId = await defaultCategoryTreeId(token);
  const res = await fetch(
    `${ebayApiBase()}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(title)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Taxonomy suggestions failed (${res.status})`);
  const id = parseCategorySuggestion((await res.json()) as CategorySuggestionResponse);
  if (id) cache.set(key, id);
  return id;
}
