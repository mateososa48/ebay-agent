import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createItem, getItem } from '../../db/repos/items';
import { listEventsByItem } from '../../db/repos/events';
import { recordIdentity } from './identify';

describe('recordIdentity', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('persists the model-determined identity + condition, advances status, logs an event', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: ['blob://a.jpg'], sellerNotes: 'panini world cup sticker #00, mint' });

    const identity = await recordIdentity(db, item.id, {
      brand: 'Panini',
      productType: 'FIFA World Cup Sticker',
      model: '00',
      year: '2026',
      aspects: { Type: 'Sticker' },
      condition: 'new',
      confidence: 0.9,
    });

    expect(identity.brand).toBe('Panini');
    expect(identity.productType).toBe('FIFA World Cup Sticker');
    // top-level fields fold into the specifics buyers filter on
    expect(identity.aspects.Brand).toBe('Panini');
    expect(identity.aspects.Model).toBe('00');
    expect(identity.aspects.Year).toBe('2026');

    const saved = await getItem(db, item.id);
    expect((saved?.identity as { productType: string }).productType).toBe('FIFA World Cup Sticker');
    expect((saved?.condition as { grade: string }).grade).toBe('new');
    expect(saved?.status).toBe('identifying');
    expect((await listEventsByItem(db, item.id)).some((e) => e.kind === 'identified')).toBe(true);
  });

  it('does not overwrite an aspect the model set explicitly', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const identity = await recordIdentity(db, item.id, {
      brand: 'Panini',
      productType: 'Sticker',
      aspects: { Brand: 'Panini S.p.A.' },
      condition: 'used_good',
      confidence: 0.5,
    });
    expect(identity.aspects.Brand).toBe('Panini S.p.A.');
  });

  it('throws for a missing item', async () => {
    db = await makeTestDb();
    await expect(
      recordIdentity(db, '00000000-0000-0000-0000-000000000000', {
        productType: 'Thing', aspects: {}, condition: 'used_good', confidence: 0.5,
      }),
    ).rejects.toThrow(/not found/);
  });
});
