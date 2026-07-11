import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { lintListing } from '../../lib/voice/linter';

export default defineTool({
  description:
    'Check a listing draft against eBay policy (blocking) and the anti-slop style rules (warnings). Call this on every draft BEFORE saving. If it returns ok:false, fix the blocking issues and lint again. Also address warnings so the copy reads human.',
  inputSchema: z.object({
    title: z.string(),
    aspects: z.record(z.string(), z.string()),
    description: z.string(),
    price: z.number(),
    condition: z.enum(['new', 'open_box', 'used_like_new', 'used_good', 'used_fair', 'for_parts']),
  }),
  async execute(draft) {
    return lintListing(draft);
  },
});
