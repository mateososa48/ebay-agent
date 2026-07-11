import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem } from './items';
import { recordEvent, listEventsByItem } from './events';

describe('events repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('records events and lists them newest-first for an item', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await recordEvent(db, { itemId: item.id, kind: 'identified', data: { confidence: 0.9 } });
    await recordEvent(db, { itemId: item.id, kind: 'priced', data: { suggested: 48 } });
    const events = await listEventsByItem(db, item.id);
    expect(events.map((e) => e.kind)).toEqual(['priced', 'identified']);
    expect((events[0]?.data as { suggested: number }).suggested).toBe(48);
  });

  it('allows an event with no item and null data', async () => {
    db = await makeTestDb();
    const e = await recordEvent(db, { kind: 'system_start' });
    expect(e.kind).toBe('system_start');
    expect(e.itemId).toBeNull();
    expect(e.data).toBeNull();
  });
});
