import type { Db } from '../types';

/** A single app-level setting value, or null if unset. */
export async function getSetting(db: Db, key: string): Promise<string | null> {
  const { rows } = await db.query<{ value: string }>(`select value from app_settings where key = $1`, [key]);
  return rows[0]?.value ?? null;
}

/** Upsert an app-level setting. */
export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.query(
    `insert into app_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value],
  );
}

export type ShipMode = 'free' | 'flat';
export type ReturnWindow = 'days_30' | 'days_60' | 'none';

/** Seller-configurable defaults that actually drive publishing. */
export interface ListingDefaults {
  shipZip: string;
  shipMode: ShipMode;
  shipCost: number; // USD, used when shipMode === 'flat'
  returnWindow: ReturnWindow;
  handlingDays: number;
  requireApproval: boolean;
}

export const DEFAULT_LISTING_DEFAULTS: ListingDefaults = {
  shipZip: '',
  shipMode: 'free',
  shipCost: 0,
  returnWindow: 'days_30',
  handlingDays: 3,
  requireApproval: true,
};

export async function getListingDefaults(db: Db): Promise<ListingDefaults> {
  const rows = await db.query<{ key: string; value: string }>(
    `select key, value from app_settings where key = any($1)`,
    [['ship_zip', 'ship_mode', 'ship_cost', 'return_window', 'handling_days', 'require_approval']],
  );
  const m = new Map(rows.rows.map((r) => [r.key, r.value]));
  const d = DEFAULT_LISTING_DEFAULTS;
  return {
    shipZip: m.get('ship_zip') ?? d.shipZip,
    shipMode: (m.get('ship_mode') as ShipMode) ?? d.shipMode,
    shipCost: Number(m.get('ship_cost') ?? d.shipCost) || 0,
    returnWindow: (m.get('return_window') as ReturnWindow) ?? d.returnWindow,
    handlingDays: Number(m.get('handling_days') ?? d.handlingDays) || d.handlingDays,
    requireApproval: (m.get('require_approval') ?? 'true') !== 'false',
  };
}
