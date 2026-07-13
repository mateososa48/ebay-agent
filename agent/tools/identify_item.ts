import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { recordIdentity } from '../../lib/agent/steps/identify';

export default defineTool({
  description:
    'Record the item you have identified from the photos, the seller notes, and your web research. Call this ONCE, after you have actually looked at the images and used web_search to confirm what it is. Provide accurate values — never guess; if something that matters is still unclear, call ask_question first. Returns the recorded identity.',
  inputSchema: z.object({
    itemId: z.string(),
    brand: z.string().optional().describe('Manufacturer / brand, if known'),
    productType: z
      .string()
      .describe('What the item is, specifically — e.g. "Panini FIFA World Cup Sticker" or "Parrot Zik 3 Wireless Headphones"'),
    model: z.string().optional().describe('Model, edition, or card/sticker number, if applicable'),
    year: z.string().optional(),
    aspects: z
      .record(z.string(), z.string())
      .describe('eBay item specifics buyers filter on (Brand, Model, Size, Color, Type, Year, …). Only include ones you actually know.'),
    condition: z
      .enum(['new', 'open_box', 'used_like_new', 'used_good', 'used_fair', 'for_parts'])
      .describe('Read from the seller notes + photos — do not default to used if they told you otherwise'),
    confidence: z.number().min(0).max(1).describe('How sure you are, 0 to 1'),
    ambiguities: z.array(z.string()).optional().describe('Anything still uncertain worth flagging to the seller'),
  }),
  async execute({ itemId, ...input }) {
    return recordIdentity(getDb(), itemId, input);
  },
});
