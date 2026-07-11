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
  });
  await updateListing(db, listing.id, { linterReport: linter });
  const approval = await enqueueApproval(db, { type: 'listing', refId: listing.id });
  await recordEvent(db, {
    itemId,
    kind: 'draft_saved',
    data: { listingId: listing.id, warnings: linter.warnings.length },
  });

  return { listingId: listing.id, approvalId: approval.id, linter };
}
