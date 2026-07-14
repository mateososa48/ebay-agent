import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { applyPhotoEdit } from '../../lib/agent/steps/photos';

export default defineTool({
  description:
    'Curate the item photos: choose the COVER (first URL becomes the cover image and the first picture buyers see), set the display order, and drop bad shots (blurry, duplicate, irrelevant). Pass the photo URLs you are KEEPING, in display order, cover first — omitted URLs are removed. You saw every photo in the conversation; pick the sharpest, best-lit, full-item shot as cover. Keep at least 3 photos when available. Works on drafts only (eBay owns the gallery once live). Provide itemId when building a new listing, or listingId when assisting on a draft review.',
  inputSchema: z.object({
    itemId: z.string().optional().describe('The item being built (new-listing mode)'),
    listingId: z.string().optional().describe('The draft listing being reviewed (assist mode)'),
    orderedPhotos: z
      .array(z.string())
      .min(1)
      .describe('Photo URLs to keep, in display order. First = cover. Must be URLs already on the item.'),
  }),
  async execute({ itemId, listingId, orderedPhotos }) {
    return applyPhotoEdit(getDb(), { itemId, listingId }, orderedPhotos);
  },
});
