import 'server-only';
import { gateway } from 'ai';

export interface AiSpend {
  available: boolean;
  used?: number; // cumulative spend, USD
  balance?: number; // remaining credit, USD
}

/**
 * AI Gateway spend. The gateway provider authenticates exactly like inference —
 * AI_GATEWAY_API_KEY if set, otherwise the Vercel OIDC token — so on Vercel this
 * works with ZERO configuration. Never throws.
 */
export async function getAiSpend(): Promise<AiSpend> {
  try {
    const credits = await gateway.getCredits(); // GET ai-gateway.vercel.sh/v1/credits
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return { available: true, used: num(credits.totalUsed), balance: num(credits.balance) };
  } catch {
    return { available: false }; // no OIDC (e.g. local dev without vercel env) and no key
  }
}

export interface GatewayModel {
  id: string;
  name: string;
}

/**
 * Live model catalog from the AI Gateway (same zero-config auth). Falls back to
 * null on failure — callers then use the curated list.
 */
export async function getGatewayModels(): Promise<GatewayModel[] | null> {
  try {
    const res = await gateway.getAvailableModels();
    const models = res.models
      .filter((m) => (m as { modelType?: string }).modelType !== 'embedding')
      .map((m) => ({ id: m.id, name: m.name ?? m.id }));
    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
}
