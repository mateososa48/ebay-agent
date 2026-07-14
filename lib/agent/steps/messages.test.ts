import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createListing, updateListing } from '../../db/repos/listings';
import { listDraftedMessages } from '../../db/repos/buyer-messages';
import { listPendingApprovals } from '../../db/repos/approvals';
import { pollMessages } from './messages';
import type { EbayAdapter, EbayBuyerQuestion } from '../../ebay/types';

function fakeAdapter(questions: EbayBuyerQuestion[]): EbayAdapter {
  return {
    identifyByImage: async () => ({ productType: 'x', categoryId: '1', aspects: {}, confidence: 0, ambiguities: [] }),
    findComps: async () => [],
    verifyListing: async () => ({ ok: true, errors: [] }),
    publishListing: async () => ({ ebayListingId: 'x', url: 'x' }),
    getRecentSales: async () => [],
    getBuyerQuestions: async () => questions,
    replyToBuyerQuestion: async () => {},
    getEligibleOfferListingIds: async () => [],
    sendOfferToInterestedBuyers: async () => {},
    getActiveListings: async () => [],
    getItemDetails: async () => null,
    reviseListingPrice: async () => {},
  };
}

async function makeLiveListing(db: TestDb, ebayId: string) {
  const { rows } = await db.query<{ id: string }>(`insert into items default values returning id`);
  const item = rows[0];
  if (!item) throw new Error('failed to create test item');
  const listing = await createListing(db, {
    itemId: item.id,
    title: 'Parrot Zik Headphones',
    specifics: { Brand: 'Parrot' },
    description: 'Noise cancelling.',
    price: 39,
  });
  await updateListing(db, listing.id, { status: 'live', ebayListingId: ebayId });
  return listing.id;
}

const Q: EbayBuyerQuestion = {
  messageId: 'm-1',
  ebayListingId: '110099',
  senderId: 'buyer42',
  subject: 'Battery?',
  body: 'How is the battery life?',
};

describe('pollMessages', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('drafts a reply + enqueues a message approval for a new question', async () => {
    db = await makeTestDb();
    await makeLiveListing(db, '110099');
    const res = await pollMessages(db, fakeAdapter([Q]), async () => 'About 6 hours per charge.');
    expect(res).toEqual({ checked: 1, drafted: 1 });
    const drafts = await listDraftedMessages(db);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.draftedReply).toBe('About 6 hours per charge.');
    const approvals = await listPendingApprovals(db);
    expect(approvals.some((a) => a.type === 'message' && a.refId === drafts[0]?.id)).toBe(true);
  });

  it('is idempotent — the same eBay message never drafts twice', async () => {
    db = await makeTestDb();
    await makeLiveListing(db, '110099');
    await pollMessages(db, fakeAdapter([Q]), async () => 'r1');
    const second = await pollMessages(db, fakeAdapter([Q]), async () => 'r2');
    expect(second.drafted).toBe(0);
    expect(await listDraftedMessages(db)).toHaveLength(1);
  });

  it('skips questions about items not listed through the app', async () => {
    db = await makeTestDb();
    await makeLiveListing(db, '110099');
    const res = await pollMessages(
      db,
      fakeAdapter([{ ...Q, messageId: 'm-2', ebayListingId: '999999' }]),
      async () => 'nope',
    );
    expect(res).toEqual({ checked: 1, drafted: 0 });
  });
});
