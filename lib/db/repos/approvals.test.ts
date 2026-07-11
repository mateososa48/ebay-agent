import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { enqueueApproval, getApproval, listPendingApprovals, decideApproval } from './approvals';

const REF = '11111111-1111-1111-1111-111111111111';

describe('approvals repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('enqueues a pending approval', async () => {
    db = await makeTestDb();
    const a = await enqueueApproval(db, { type: 'listing', refId: REF });
    expect(a.state).toBe('pending');
    expect(a.type).toBe('listing');
    expect(a.refId).toBe(REF);
    expect(a.decidedAt).toBeNull();
  });

  it('lists only pending approvals, oldest-first', async () => {
    db = await makeTestDb();
    const first = await enqueueApproval(db, { type: 'listing', refId: REF });
    await enqueueApproval(db, { type: 'listing', refId: REF });
    await decideApproval(db, first.id, 'approved');
    const pending = await listPendingApprovals(db);
    expect(pending).toHaveLength(1);
    expect(pending.every((p) => p.state === 'pending')).toBe(true);
  });

  it('records a decision with a timestamp', async () => {
    db = await makeTestDb();
    const a = await enqueueApproval(db, { type: 'listing', refId: REF });
    await decideApproval(db, a.id, 'rejected');
    const after = await getApproval(db, a.id);
    expect(after?.state).toBe('rejected');
    expect(after?.decidedAt).not.toBeNull();
  });
});
