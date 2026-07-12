'use server';

import { getDb } from '@/lib/db/client';
import { createItem } from '@/lib/db/repos/items';
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
