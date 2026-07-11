import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import type { ItemIdentity } from '../../types';
import { getItem, setItemEnrichment, updateItemStatus } from '../../db/repos/items';
import { recordEvent } from '../../db/repos/events';

/** Identify an item from its photos + notes, persist the identity, advance status. */
export async function identifyItem(db: Db, adapter: EbayAdapter, itemId: string): Promise<ItemIdentity> {
  const item = await getItem(db, itemId);
  if (!item) throw new Error(`identifyItem: item ${itemId} not found`);

  const identity = await adapter.identifyByImage({
    images: item.photos,
    sellerNotes: item.sellerNotes ?? undefined,
  });

  await setItemEnrichment(db, itemId, { identity });
  await updateItemStatus(db, itemId, 'identifying');
  await recordEvent(db, {
    itemId,
    kind: 'identified',
    data: { confidence: identity.confidence, ambiguities: identity.ambiguities },
  });
  return identity;
}
