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
