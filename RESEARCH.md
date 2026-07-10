# eBay Selling Agent — Feasibility Research (July 9, 2026)

Personal (non-commercial) autonomous eBay selling agent: upload photos → research item → estimate price → create listing → send offers → answer buyer messages. Built on Vercel's **eve** agent framework with a web dashboard.

**Verdict: feasible.** Every capability has an official eBay API. Two big caveats: sold-price data is gated, and the Negotiation API doesn't work with Inventory API listings.

Verification note: primary sources were fetched and quoted directly from eBay's developer docs; the three most load-bearing claims (Message API, Negotiation/Inventory incompatibility, Media + Inventory Mapping APIs) were re-verified live on developer.ebay.com on 2026-07-09.

## Per-capability verdicts

### 1. Create listings from photos — ✅ Possible
- **Media API** (`commerce/media`): upload images to eBay Picture Services (EPS); also videos and regulatory documents. Published listings require at least one picture.
- **Inventory Mapping API** (GraphQL, new): eBay's own AI listing generator — accepts item photos, titles, aspects, product identifiers and returns an AI-powered *listing preview* with recommended category, eBay-normalized item aspects, and description (`startListingPreviewsCreation` mutation). **US marketplace only, Production only (no sandbox).** Integrates with Notification API (`LISTING_PREVIEW_CREATION_TASK_STATUS`). This does a lot of the "research the item" step for free.
- **Listing creation** — two paths:
  - **Trading API** (legacy XML): `AddFixedPriceItem` / `AddItem`. Produces `listingId`s the Negotiation API can use. ← **use this one** (see #3)
  - **Inventory API** (REST): `createOrReplaceInventoryItem` → `createOffer` → `publishOffer`. Cleaner, but: listings created this way **cannot be edited in Seller Hub** (API-only management), and the **Negotiation API does not support Inventory-API-managed listings** (verified verbatim 2026-07-09).
- Prereqs: seller account opted in to **business policies** (payment/fulfillment/return, managed via Account API) + at least one inventory location.

### 2. Price research — ⚠️ Possible with caveats (weakest link)
- **Marketplace Insights API** (90-day sold history) is **Limited Release** — requires an Application Growth Check with a business-level use case. Community threads: individual devs essentially never get approved. The old Finding API `findCompletedItems` is shut down.
- What you *can* use:
  - **Browse API `search`** — active-listing comps (client-credentials token, no user consent needed).
  - **Browse API `searchByImage`** — POST a Base64 image, get matching active listings. Item identification + comps in one call.
  - **Terapeak** (Seller Hub) — real sold data, but manual/no API.
  - Third-party scraper APIs exist for sold data but violate eBay ToS — avoid.
- **Legal caveat:** API License Agreement (updated 2025-06-24) prohibits using eBay data to train AI models and prohibits feeding **Restricted API** data (market trends, pricing, sales volumes, user behavior) into third-party gen-AI tools without eBay's prior written consent. Estimating price with your own logic over Browse comps is the pragmatic path; be careful piping eBay pricing data through LLMs.

### 3. Sending offers to interested buyers — ⚠️ Possible with caveats
- **Negotiation API** (`sell/negotiation/v1`), exactly two methods:
  - `findEligibleItems` — listings that have ≥1 interested buyer
  - `sendOfferToInterestedBuyers` — message + % discount or fixed lower price + offerDuration + allowCounterOffer
- Caveats:
  - Only to buyers eBay deems *interested* (watchers, cart abandoners) — no arbitrary targeting.
  - eBay delivers the notification; buyer identities are masked.
  - Offer-extension only — no counter-offer handling through this API.
  - **Does not support Inventory-API-managed listings** — `listingId` comes from Trading API listings. This decides the listing-creation path in #1.
- Incoming Best Offers (buyers offering you a price) are handled in the Trading API (`GetBestOffers` / `RespondToBestOffer`) — confirm details during build (not deep-verified in this pass).
- Sandbox supported (mock buyers, quirks: findEligibleItems just returns recent listings, max 10 offers per call).

### 4. Answering buyer messages — ✅ Possible (new since Q4 2025)
- **Message API** (`commerce/message/v1`) — the REST replacement for Trading API messaging calls:
  - `sendMessage` (new or existing threads), `getConversations` (filtered), `getConversation`, `updateConversation` / `bulkUpdateConversation` (read/unread/archive)
  - OAuth scope: `https://api.ebay.com/oauth/api_scope/commerce.message` (authorization code grant). Sandbox supported.
- Agent loop: poll `getConversations` → LLM drafts reply → (approval gate) → `sendMessage`.
- Legacy fallback: Trading API `GetMemberMessages` / `AddMemberMessageRTQ` (rate-limited 75 calls/60s per seller).

### 5. Full autonomy — ⚠️ Keep a human-approval step
eBay published an AI-agent policy (late 2025): prohibits scraping, LLM-driven bots, and end-to-end flows without human review (aimed mostly at buyer-side agents). Selling via official APIs with approval gates on outward actions (publish listing, send offer, send message) is the safe pattern — and eve supports per-tool approval gates natively.

## Developer program access — easy for this use case
- Self-serve eBay Developers Program account (~1 business day), free keyset, full Sandbox.
- Default **5,000 calls/day** per keyset (varies per API) — far more than a single-seller agent needs.
- Application Growth Check only needed for higher limits or restricted APIs (i.e., Marketplace Insights).
- OAuth: authorization-code-grant **user token** for your own seller account (one-time consent; refresh tokens last ~18 months). Scopes: `sell.inventory` (listing + Negotiation), `commerce.message` (messages). Client-credentials app token suffices for Browse.

## The eve framework (verified — it's real)
- **Vercel's eve** (eve.dev, github.com/vercel/eve), announced June 17, 2026, "Next.js for agents". Apache-2.0, ~3.4k stars, actively released (eve@0.22.3 on Jul 9, 2026). **Beta/public preview** — APIs may change.
- Filesystem-first: `agent/` directory with `instructions.md`, `tools/` (one TS file per tool, Zod schemas), `skills/`, `channels/`, `connections/`, cron schedules. MCP + OpenAPI support.
- Fit for this project:
  - Durable checkpointed sessions (survive crashes/deploys) — good for long-running sell cycles.
  - **Per-tool human approval gates, pause indefinitely at zero compute** — perfect for approve-before-publish.
  - HTTP API channel on by default → custom dashboard talks to the agent over HTTP; `withEve` / `useEveAgent` React APIs (see vercel-labs/steve PoC).
  - Vercel Connect manages OAuth tokens (eBay user token storage).
- Caveats: no built-in user dashboard (build a Next.js app — frontend rules in CLAUDE.md apply); primarily runs on Vercel (self-host possible via steve PoC: Postgres workflow world + Docker sandbox, Node ≥ 24); TypeScript-only.

## Suggested architecture
```
Next.js dashboard (photo upload, review/approve queue)
        │  HTTP (withEve / useEveAgent)
        ▼
eve agent (durable sessions, cron, approval gates)
  tools/
    uploadImages      → Media API (EPS)
    identifyItem      → Browse searchByImage (+ Inventory Mapping API preview, US only)
    findComps         → Browse search (active comps) → own pricing logic
    createListing     → Trading API AddFixedPriceItem  (NOT Inventory API — Negotiation compat)
    sendOffers        → Negotiation API findEligibleItems + sendOfferToInterestedBuyers (cron)
    messages          → Message API getConversations / sendMessage (cron poll + approval gate)
    orders            → Fulfillment API (shipping, tracking)
```

## Key sources
- https://developer.ebay.com/develop/api/sell/message_api (Message API — verified live)
- https://developer.ebay.com/develop/api/sell/negotiation_api (Negotiation API — verified live)
- https://developer.ebay.com/api-docs/sell/inventory/overview.html
- https://developer.ebay.com/api-docs/buy/browse/resources/search_by_image/methods/searchByImage
- https://developer.ebay.com/develop/get-started/api-call-limits
- https://developer.ebay.com/join/api-license-agreement (2025-06-24 AI restrictions)
- https://github.com/vercel/eve · https://vercel.com/docs/eve · https://github.com/vercel-labs/steve
