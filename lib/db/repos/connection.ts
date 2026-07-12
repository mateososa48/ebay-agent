import type { Db } from '../types';

export interface EbayConnection {
  refreshToken: string;
  ebayUser: string | null;
  scopes: string | null;
  connectedAt: string;
}

interface RawConn {
  refresh_token: string;
  ebay_user: string | null;
  scopes: string | null;
  connected_at: string | Date;
}

/** The single-row eBay OAuth connection (the seller's refresh token). */
export async function getEbayConnection(db: Db): Promise<EbayConnection | null> {
  const { rows } = await db.query<RawConn>(
    `select refresh_token, ebay_user, scopes, connected_at from ebay_connection where id = 1`,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    refreshToken: r.refresh_token,
    ebayUser: r.ebay_user,
    scopes: r.scopes,
    connectedAt: new Date(r.connected_at).toISOString(),
  };
}

export async function saveEbayConnection(
  db: Db,
  input: { refreshToken: string; ebayUser?: string; scopes?: string },
): Promise<void> {
  await db.query(
    `insert into ebay_connection (id, refresh_token, ebay_user, scopes, connected_at, updated_at)
     values (1, $1, $2, $3, now(), now())
     on conflict (id) do update
       set refresh_token = excluded.refresh_token,
           ebay_user = excluded.ebay_user,
           scopes = excluded.scopes,
           updated_at = now()`,
    [input.refreshToken, input.ebayUser ?? null, input.scopes ?? null],
  );
}
