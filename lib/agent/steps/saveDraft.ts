import type { Db } from '../../db/types';
import type { ListingDraft } from '../../types';
import { lintListing, type LinterReport } from '../../voice/linter';
import { createListing, updateListing } from '../../db/repos/listings';
import { enqueueApproval } from '../../db/repos/approvals';
import { recordEvent } from '../../db/repos/events';

export interface SaveDraftResult {
  listingId: string;
  approvalId: string;
  linter: LinterReport;
}

/** Lint a listing draft; if compliant, persist it and queue it for the seller's approval. */
export async function saveListingDraft(db: Db, itemId: string, draft: ListingDraft): Promise<SaveDraftResult> {
  const linter = lintListing(draft);
  if (!linter.ok) {
    const codes = linter.blocking.map((b) => b.code).join(', ');
    throw new Error(`saveListingDraft: draft has ${linter.blocking.length} blocking issue(s) [${codes}] — fix before saving`);
  }

  const listing = await createListing(db, {
    itemId,
    title: draft.title,
    specifics: draft.aspects,
    description: draft.description,
    price: draft.price,
    condition: draft.condition,
  });
  // Enqueue the approval IMMEDIATELY after the listing exists — it's what makes
  // the draft visible in the queue. The Neon HTTP driver autocommits each
  // statement separately, so if a later write dies the draft still shows up
  // (rather than becoming an invisible orphan).
  const approval = await enqueueApproval(db, { type: 'listing', refId: listing.id });
  await updateListing(db, listing.id, { linterReport: linter });
  await recordEvent(db, {
    itemId,
    kind: 'draft_saved',
    data: { listingId: listing.id, warnings: linter.warnings.length },
  });

  return { listingId: listing.id, approvalId: approval.id, linter };
}
