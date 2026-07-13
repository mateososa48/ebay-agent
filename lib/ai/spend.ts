import 'server-only';

export interface AiSpend {
  available: boolean;
  used?: number;
  balance?: number;
}

/**
 * AI Gateway spend. The gateway exposes a credits endpoint when an
 * AI_GATEWAY_API_KEY is set (on Vercel the runtime usually authenticates via OIDC
 * instead, in which case there's no key to query — we degrade to the dashboard
 * link in the UI). Never throws.
 */
export async function getAiSpend(): Promise<AiSpend> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return { available: false };
  try {
    const res = await fetch('https://ai-gateway.vercel.sh/v1/credits', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) return { available: false };
    const data = (await res.json()) as Record<string, unknown>;
    const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v));
    return {
      available: true,
      balance: num(data.balance ?? data.credits),
      used: num(data.total_used ?? data.used ?? data.usage),
    };
  } catch {
    return { available: false };
  }
}
