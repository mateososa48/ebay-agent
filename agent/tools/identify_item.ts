import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { getEbayAdapter } from '../../lib/ebay';
import { identifyItem } from '../../lib/agent/steps/identify';

export default defineTool({
  description:
    'Identify the item being listed, from its photos and the seller’s notes. Call this FIRST, passing the itemId given in your task. Returns brand, product type, category, item specifics, a confidence score, and any ambiguities you should flag to the seller.',
  inputSchema: z.object({ itemId: z.string().describe('The id of the item to identify') }),
  async execute({ itemId }) {
    return identifyItem(getDb(), getEbayAdapter(), itemId);
  },
});
