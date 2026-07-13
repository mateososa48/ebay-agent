import type { Db } from '../../db/types';
import type { ItemIdentity, ItemCondition } from '../../types';
import { getItem, setItemEnrichment, updateItemStatus } from '../../db/repos/items';
import { recordEvent } from '../../db/repos/events';

export interface IdentifyInput {
  brand?: string;
  productType: string;
  model?: string;
  year?: string;
  aspects: Record<string, string>;
  condition: ItemCondition;
  confidence: number;
  ambiguities?: string[];
}

/**
 * Record the identity the agent determined by looking at the photos, reading the
 * seller's notes, and researching the web. Replaces the old keyword-guess adapter
 * call: identification is now the model's job, this just persists the result.
 */
export async function recordIdentity(db: Db, itemId: string, input: IdentifyInput): Promise<ItemIdentity> {
  const item = await getItem(db, itemId);
  if (!item) throw new Error(`recordIdentity: item ${itemId} not found`);

  // Fold the top-level fields into the aspects map so they surface as item specifics.
  const aspects: Record<string, string> = { ...input.aspects };
  if (input.brand && !aspects.Brand) aspects.Brand = input.brand;
  if (input.model && !aspects.Model) aspects.Model = input.model;
  if (input.year && !aspects.Year) aspects.Year = input.year;

  const identity: ItemIdentity = {
    brand: input.brand,
    productType: input.productType,
    model: input.model,
    aspects,
    confidence: input.confidence,
    ambiguities: input.ambiguities ?? [],
  };

  await setItemEnrichment(db, itemId, { identity, condition: { grade: input.condition } });
  await updateItemStatus(db, itemId, 'identifying');
  await recordEvent(db, {
    itemId,
    kind: 'identified',
    data: { productType: input.productType, confidence: input.confidence },
  });
  return identity;
}
