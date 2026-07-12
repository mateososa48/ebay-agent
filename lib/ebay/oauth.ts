// eBay OAuth — application (client-credentials) token for the Buy/Browse APIs.
// User-scoped tokens (Trading/Negotiation/Message) come with the Connect flow.

export function ebayApiBase(): string {
  return process.env.EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

let cachedApp: { token: string; expiresAt: number } | undefined;

/** A client-credentials app token, cached until ~1 min before expiry. */
export async function getAppToken(): Promise<string> {
  if (cachedApp && cachedApp.expiresAt > Date.now() + 60_000) return cachedApp.token;

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) throw new Error('EBAY_APP_ID / EBAY_CERT_ID are not set');

  const basic = Buffer.from(`${appId}:${certId}`).toString('base64');
  const res = await fetch(`${ebayApiBase()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
  });

  if (!res.ok) {
    throw new Error(`eBay app-token request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedApp = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return cachedApp.token;
}
