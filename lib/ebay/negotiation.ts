// eBay Negotiation API — offers to interested buyers (watchers/carters).
// Uses the user OAuth token (sell.marketing scope, already in EBAY_USER_SCOPES).
import { ebayApiBase, getUserAccessToken } from './oauth';
import type { SendOfferInput } from './types';

async function negotiationFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getUserAccessToken();
  return fetch(`${ebayApiBase()}/sell/negotiation/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

/** eBay ItemIDs of the seller's listings currently eligible for offers to interested buyers. */
export async function getEligibleOfferListingIds(): Promise<string[]> {
  const res = await negotiationFetch('/find_eligible_items?limit=50');
  // 204/empty → nothing eligible right now.
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`eBay find_eligible_items failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { eligibleItems?: { listingId?: string }[] };
  return (data.eligibleItems ?? []).map((e) => e.listingId).filter((id): id is string => Boolean(id));
}

/** Send a discount offer to interested buyers. WRITE — call only after approval. */
export async function sendOfferToInterestedBuyers(input: SendOfferInput): Promise<void> {
  const body = {
    allowCounterOffer: false,
    ...(input.message ? { message: input.message.slice(0, 2000) } : {}),
    offeredItems: [
      {
        listingId: input.ebayListingId,
        price: { currency: 'USD', value: input.priceUsd.toFixed(2) },
        quantity: 1,
      },
    ],
  };
  const res = await negotiationFetch('/send_offer_to_interested_buyers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`eBay send_offer failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}
