import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { getListingDefaults, setSetting, DEFAULT_LISTING_DEFAULTS } from './settings';

describe('getListingDefaults', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('returns the defaults when nothing is stored', async () => {
    db = await makeTestDb();
    await expect(getListingDefaults(db)).resolves.toEqual(DEFAULT_LISTING_DEFAULTS);
  });

  it('preserves a stored 0 handling time (same-day) instead of coercing it back to the default', async () => {
    db = await makeTestDb();
    await setSetting(db, 'handling_days', '0');
    const d = await getListingDefaults(db);
    expect(d.handlingDays).toBe(0);
  });

  it('falls back to the default for non-numeric junk rather than emitting NaN', async () => {
    db = await makeTestDb();
    await setSetting(db, 'handling_days', 'abc');
    await setSetting(db, 'ship_cost', '');
    const d = await getListingDefaults(db);
    expect(d.handlingDays).toBe(DEFAULT_LISTING_DEFAULTS.handlingDays);
    expect(d.shipCost).toBe(DEFAULT_LISTING_DEFAULTS.shipCost);
  });

  it('reads back stored values', async () => {
    db = await makeTestDb();
    await setSetting(db, 'ship_mode', 'flat');
    await setSetting(db, 'ship_cost', '7.5');
    await setSetting(db, 'return_window', 'days_60');
    await setSetting(db, 'require_approval', 'false');
    const d = await getListingDefaults(db);
    expect(d.shipMode).toBe('flat');
    expect(d.shipCost).toBe(7.5);
    expect(d.returnWindow).toBe('days_60');
    expect(d.requireApproval).toBe(false);
  });
});
