# Buyer Automation — Design Spec

**Date:** 2026-07-13 · **Status:** Approved by Mateo (build all; 10% default offer discount)

## Goal
Add the post-listing half of the agent: detect sales, draft replies to buyer questions, and
propose discount offers to watchers — all polled on a schedule, with every buyer-facing action
routed through the existing approval queue. Zero external setup for the owner.

## Principles
- **Nothing reaches a buyer without Mateo's approval.** Offers and replies are drafted and
  enqueued; a human taps approve before any send. Matches how publishing already works.
- **Read-only work is autonomous.** Sale detection just records + notifies.
- **Zero external setup.** Vercel Cron (declared in `vercel.json`), no webhooks/dashboards.
- **Deliver in verified slices**, safest first: Sales → Messages → Offers → UI/Settings.

## Architecture
One Vercel Cron (~15 min) → `GET /api/cron/poll` (guarded by `CRON_SECRET` header). The route
runs three collectors against the connected eBay account when automation is enabled:

1. **Sales** *(autonomous)* — Trading `GetSellerTransactions`/`GetOrders` via the IAF user token →
   match sold items to our listings (by `ebay_listing_id`) → set `status='sold'`, `sold_at`,
   `sale_price` → log an Activity event. No approval.
2. **Buyer messages** *(approval-gated)* — Trading `GetMemberMessages` → for each unanswered
   question not already seen, the agent drafts a reply from listing details → insert a
   `buyer_messages` row + enqueue a `message` approval. On approve → `AddMemberMessageRTQ`.
3. **Offers to watchers** *(approval-gated)* — find live listings with eligible interested buyers →
   compute discount (Setting, default 10%, floored to never dip below after-fees take) → enqueue an
   `offer` approval. On approve → Negotiation `sendOfferToInterestedBuyers`.

## Data model
- `listings`: add `sold_at timestamptz`, `sale_price numeric`. (`status='sold'` already exists.)
- `buyer_messages` (new): `id`, `ebay_message_id` (unique — dedupe), `listing_id`, `question`,
  `drafted_reply`, `status` ('drafted'|'sent'|'skipped'), timestamps.
- `offers` (new): `id`, `listing_id`, `discount_pct`, `offer_price`, `message`, `status`
  ('drafted'|'sent'|'skipped'), timestamps.
- `approvals`: reuse existing `type` `'offer' | 'message'` (already defined); `ref_id` → the new rows.
- Activity feed: reuse `events` table (kind + payload); surfaced in the UI.
- Settings (app_settings): `automation_sales`, `automation_messages`, `automation_offers`
  (on/off), `offer_discount_pct` (default 10), `poll_minutes` (default 15).

## eBay scopes
Connection already holds `sell.marketing` (offers via Negotiation) + `commerce.message` (member
messaging) + Trading via IAF token (orders). Expected: **no re-connect needed** — confirm on first
live call; if a scope is missing, it's a one-time re-click of Connect.

## Notifications
In-app only (zero setup): dashboard badges + an Activity list ("Sold X for $Y", "Reply ready",
"Offer ready"). Email/push deferred (needs external keys).

## Verification
- Sales first (read-only) proves the poller + eBay reads end-to-end, zero buyer risk.
- Message/offer **send** paths are first exercised only when Mateo approves a real draft — the
  approval gate is the safety net for the untested-live writes. Use eBay verify/dry-run where
  available; keep the first offers conservative.

## Out of scope (later)
Email/push notifications; eBay Platform Notifications (webhooks); fully-autonomous sends;
multi-user.
