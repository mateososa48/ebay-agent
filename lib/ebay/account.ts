// eBay Sell Account API — the seller's Business Policies (shipping/payment/returns).
// Accounts opted into Business Policies REJECT inline ShippingDetails on Add/Verify
// calls ("Input data for tag <Item.ShippingDetails> is invalid or missing"), and
// must reference policy profile IDs via SellerProfiles instead.
import { ebayApiBase, getUserAccessToken } from './oauth';

export interface SellerPolicyIds {
  shippingProfileId: string;
  paymentProfileId: string;
  returnProfileId: string;
}

interface PolicyList {
  fulfillmentPolicies?: { fulfillmentPolicyId: string; name?: string }[];
  paymentPolicies?: { paymentPolicyId: string; name?: string }[];
  returnPolicies?: { returnPolicyId: string; name?: string }[];
}

async function fetchPolicies(path: string): Promise<PolicyList | null> {
  const token = await getUserAccessToken();
  const res = await fetch(`${ebayApiBase()}/sell/account/v1/${path}?marketplace_id=EBAY_US`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as PolicyList;
}

/**
 * The account's default business-policy ids, or null when the account has no
 * complete set (then inline shipping/returns XML is the right path).
 * Uses the first policy of each type — single-policy accounts are the norm.
 */
export async function getSellerPolicyIds(): Promise<SellerPolicyIds | null> {
  try {
    const [fulfillment, payment, returns] = await Promise.all([
      fetchPolicies('fulfillment_policy'),
      fetchPolicies('payment_policy'),
      fetchPolicies('return_policy'),
    ]);
    const shippingProfileId = fulfillment?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
    const paymentProfileId = payment?.paymentPolicies?.[0]?.paymentPolicyId;
    const returnProfileId = returns?.returnPolicies?.[0]?.returnPolicyId;
    if (!shippingProfileId || !paymentProfileId || !returnProfileId) return null;
    return { shippingProfileId, paymentProfileId, returnProfileId };
  } catch {
    return null;
  }
}
