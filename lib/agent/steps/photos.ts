import type { Db } from '../../db/types';
import { getItem } from '../../db/repos/items';
import { getListing } from '../../db/repos/listings';
import { recordEvent } from '../../db/repos/events';

export type PhotoEditResult =
  | { ok: true; photos: string[] }
  | { ok: false; errors: string[] };

/**
 * Reorder/curate an item's photos. The FIRST photo is the cover (and the first
 * PictureURL sent to eBay on publish). Only URLs already on the item are
 * allowed — this can reorder and drop, never invent. Refused once live (eBay
 * owns the gallery then).
 */
export async function applyPhotoEdit(
  db: Db,
  ref: { itemId?: string; listingId?: string },
  orderedPhotos: string[],
): Promise<PhotoEditResult> {
  let itemId = ref.itemId ?? null;
  if (!itemId && ref.listingId) {
    const listing = await getListing(db, ref.listingId);
    if (!listing) return { ok: false, errors: [`Listing ${ref.listingId} not found.`] };
    if (listing.status === 'live' || listing.status === 'sold') {
      return { ok: false, errors: ['This listing is already on eBay — its photos are managed there.'] };
    }
    itemId = listing.itemId;
  }
  if (!itemId) return { ok: false, errors: ['No item or listing id given.'] };

  const item = await getItem(db, itemId);
  if (!item) return { ok: false, errors: [`Item ${itemId} not found.`] };

  const existing = new Set(item.photos);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const url of orderedPhotos) {
    if (!existing.has(url)) return { ok: false, errors: [`Unknown photo: ${url.slice(0, 80)}…`] };
    if (seen.has(url)) continue; // silently dedupe
    seen.add(url);
    next.push(url);
  }
  if (next.length === 0) return { ok: false, errors: ['A listing needs at least one photo.'] };

  await db.query(`update items set photos = $2, updated_at = now() where id = $1`, [itemId, next]);
  await recordEvent(db, {
    itemId,
    kind: 'photos.curated',
    data: { cover: next[0], kept: next.length, dropped: item.photos.length - next.length },
  });
  return { ok: true, photos: next };
}
