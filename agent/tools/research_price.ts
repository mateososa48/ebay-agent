import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { getEbayAdapter } from '../../lib/ebay';
import { researchPrice } from '../../lib/agent/steps/price';

export default defineTool({
  description:
    'Research a realistic price for the item using comparable listings. Call this AFTER identify_item. Returns a suggested price, a low–high range, and the comps used as evidence. Do not invent a price; use this.',
  inputSchema: z.object({ itemId: z.string().describe('The id of the (already identified) item') }),
  async execute({ itemId }) {
    return researchPrice(getDb(), getEbayAdapter(), itemId);
  },
});
