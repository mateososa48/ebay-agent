import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { saveListingDraft } from '../../lib/agent/steps/saveDraft';

export default defineTool({
  description:
    'Save the finished listing draft and queue it for the seller’s approval. Call this LAST, only after lint_listing returns ok:true. It re-checks compliance and will reject a draft with blocking issues.',
  inputSchema: z.object({
    itemId: z.string(),
    title: z.string(),
    aspects: z.record(z.string(), z.string()),
    description: z.string(),
    price: z.number(),
    condition: z.enum(['new', 'open_box', 'used_like_new', 'used_good', 'used_fair', 'for_parts']),
  }),
  async execute({ itemId, ...draft }) {
    return saveListingDraft(getDb(), itemId, draft);
  },
});
