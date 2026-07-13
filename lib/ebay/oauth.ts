// eBay OAuth. App (client-credentials) token for Buy/Browse; user
// (authorization-code) token for selling on the connected account.

import { getDb } from '../db/client';
import { getEbayConnection } from '../db/repos/connection';

export function ebayApiBase(): string {
  return process.env.EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

export function ebayAuthBase(): string {
  return process.env.EBAY_ENV === 'sandbox' ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';
}

export const EBAY_USER_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
  'https://api.ebay.com/oauth/api_scope/commerce.message',
].join(' ');

function basicAuthHeader(): string {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) throw new Error('EBAY_APP_ID / EBAY_CERT_ID are not set');
  return `Basic ${Buffer.from(`${appId}:${certId}`).toString('base64')}`;
}

/* ----------------------------- App token ----------------------------- */

let cachedApp: { token: string; expiresAt: number } | undefined;

export async function getAppToken(): Promise<string> {
  if (cachedApp && cachedApp.expiresAt > Date.now() + 60_000) return cachedApp.token;
  const res = await fetch(`${ebayApiBase()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
  });
  if (!res.ok) throw new Error(`eBay app-token request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedApp = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 };
  return cachedApp.token;
}

/* --------------------------- User OAuth flow --------------------------- */

/** The eBay consent URL the seller visits once to authorize the app. */
export function getConsentUrl(): string {
  const appId = process.env.EBAY_APP_ID;
  const ruName = process.env.EBAY_RUNAME;
  if (!appId || !ruName) throw new Error('EBAY_APP_ID / EBAY_RUNAME are not set');
  const url = new URL(`${ebayAuthBase()}/oauth2/authorize`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', ruName); // eBay RuName
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', EBAY_USER_SCOPES);
  url.searchParams.set('prompt', 'login'); // force a fresh consent, never a cached session
  return url.toString();
}

/** Exchange the authorization code (from the callback) for a refresh + access token. */
export async function exchangeCodeForTokens(
  code: string,
): Promise<{ refreshToken: string; accessToken: string; expiresIn: number }> {
  const ruName = process.env.EBAY_RUNAME;
  if (!ruName) throw new Error('EBAY_RUNAME is not set');
  const res = await fetch(`${ebayApiBase()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: ruName }).toString(),
  });
  if (!res.ok) throw new Error(`eBay code exchange failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { refresh_token: string; access_token: string; expires_in?: number };
  return { refreshToken: data.refresh_token, accessToken: data.access_token, expiresIn: data.expires_in ?? 7200 };
}

let cachedUser: { token: string; expiresAt: number } | undefined;

/** A fresh user access token, minted from the stored refresh token and cached. */
export async function getUserAccessToken(): Promise<string> {
  if (cachedUser && cachedUser.expiresAt > Date.now() + 60_000) return cachedUser.token;
  const conn = await getEbayConnection(getDb());
  if (!conn) throw new Error('eBay account is not connected');
  const res = await fetch(`${ebayApiBase()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refreshToken,
      scope: EBAY_USER_SCOPES,
    }).toString(),
  });
  if (!res.ok) throw new Error(`eBay token refresh failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedUser = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 };
  return cachedUser.token;
}
