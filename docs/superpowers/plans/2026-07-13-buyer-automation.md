# Buyer Automation — Implementation Plan

> Built in verified slices. Each phase compiles, tests, and (where safe) ships before the next.

**Goal:** post-listing automation (sales, message drafts, offers) polled on a cron, approval-gated.
**Spec:** docs/superpowers/specs/2026-07-13-buyer-automation-design.md

---

## Phase 1 — Sale detection (autonomous, read-only) ← ship first
**Files:** `lib/db/schema.ts` (+`sold_at`,`sale_price`), `lib/db/repos/listings.ts` (markSold, findByEbayId),
`lib/ebay/types.ts` (+`getRecentSales`), `lib/ebay/live.ts` + `mock.ts` (impl), `lib/ebay/trading.ts`,
`lib/agent/steps/sales.ts` (collector `pollSales`), `app/api/cron/poll/route.ts`, `vercel.json`,
`lib/db/repos/events.ts` (activity log), tests.
- [ ] schema: add columns (idempotent) + migrate.
- [ ] `getRecentSales()` via Trading `GetSellerTransactions` (IAF token); mock returns [].
- [ ] `pollSales(db, ebay)`: for each sale, match listing by `ebay_listing_id`, mark sold + log event. Idempotent (skip already-sold).
- [ ] cron route: `CRON_SECRET` guard; run enabled collectors; return summary. Add to PUBLIC_PATHS? No — guard by secret header, keep out of desk-auth (cron has no cookie) → allow `/api/cron` in middleware but require the secret in the route.
- [ ] `vercel.json` cron: `*/15 * * * *`.
- [ ] tests: pollSales marks sold + is idempotent (PGlite + fake adapter).
- [ ] verify live reads, deploy.

## Phase 2 — Buyer-message replies (approval-gated)
**Files:** `lib/db/schema.ts` (+`buyer_messages`), `lib/db/repos/buyer-messages.ts`,
`lib/ebay/types.ts`+`live.ts` (`getMemberMessages`,`replyToMemberMessage`),
`lib/agent/steps/messages.ts` (`pollMessages` — draft via model), approval enqueue,
`app/listings/[id]` or a queue surface for pending replies, approve action → send.
- [ ] schema + repo (dedupe on `ebay_message_id`).
- [ ] fetch unanswered questions; agent drafts reply from listing; insert + enqueue `message` approval.
- [ ] approval UI: show question + drafted reply, edit/approve/reject; approve → `AddMemberMessageRTQ`, mark sent.
- [ ] tests: draft+enqueue; approve→send marks sent; dedupe.

## Phase 3 — Offers to watchers (approval-gated)
**Files:** `lib/db/schema.ts` (+`offers`), `lib/db/repos/offers.ts`,
`lib/ebay/types.ts`+`live.ts` (`getListingsWithInterestedBuyers`,`sendOfferToInterestedBuyers`),
`lib/agent/steps/offers.ts` (`pollOffers`), approval enqueue + UI, approve → send.
- [ ] discount from Setting (default 10%), floored to after-fees take; compute offer price.
- [ ] enqueue `offer` approval; approve → Negotiation send; mark sent.
- [ ] tests: discount floor math; enqueue; approve→send.

## Phase 4 — Activity UI + Settings
**Files:** `app/settings/page.tsx` (replace "coming soon" card with real toggles + discount + cadence),
`components/settings/automation.tsx`, `app/settings/actions.ts` (allowlist new keys),
Activity feed component + dashboard badges, `lib/queries.ts` (activity + counts).
- [ ] Settings: enable sales/messages/offers, discount %, cadence — persist + drive the poller.
- [ ] Activity list + "needs approval" badges on the queue.
- [ ] verify end-to-end, deploy.
