'use server';

import { getDb } from '@/lib/db/client';
import { createItem } from '@/lib/db/repos/items';
import { getListingByItem } from '@/lib/db/repos/listings';
import { recordEvent } from '@/lib/db/repos/events';

/** Create an item from uploaded photo URLs + seller notes. Returns the itemId
 *  the agent session will work on. */
export async function createItemAction(input: {
  photos: string[];
  notes: string;
}): Promise<{ itemId: string }> {
  const db = getDb();
  const item = await createItem(db, {
    photos: input.photos,
    sellerNotes: input.notes.trim() || undefined,
  });
  await recordEvent(db, { itemId: item.id, kind: 'item_created', data: { photos: input.photos.length } });
  return { itemId: item.id };
}

/** The draft listing id the agent saved for this item, or null if not ready yet.
 *  Lets New Item show completion by polling, even if the live stream drops. */
export async function getDraftListingId(itemId: string): Promise<string | null> {
  const listing = await getListingByItem(getDb(), itemId);
  return listing?.id ?? null;
}
