import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { applyListingEdit } from '../../lib/agent/steps/editListing';

export default defineTool({
  description:
    'Update fields on the existing draft listing the seller is reviewing — title, price, description, item specifics (aspects), or condition. Use this when the seller asks you to change something. Only include the fields you are changing; leave the rest out. It re-lints automatically and refuses changes that would break eBay policy (returns { ok:false, errors }).',
  inputSchema: z.object({
    listingId: z.string().describe('The id of the listing being reviewed'),
    title: z.string().optional(),
    price: z.number().optional(),
    description: z.string().optional(),
    aspects: z.record(z.string(), z.string()).optional().describe('Item specifics to set/replace'),
    condition: z.enum(['new', 'open_box', 'used_like_new', 'used_good', 'used_fair', 'for_parts']).optional(),
  }),
  async execute({ listingId, ...edit }) {
    return applyListingEdit(getDb(), listingId, edit);
  },
});
