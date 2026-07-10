# eBay Selling Agent — Design Spec

**Date:** 2026-07-10
**Status:** Approved (design), pending implementation plan
**Owner:** Mateo

## 1. Goal

A personal (non-commercial, single-user) autonomous eBay selling agent with a web dashboard. The seller uploads photos of an item; the agent identifies it, researches a realistic price, and drafts a publish-ready listing whose copy is indistinguishable from a sharp human seller's — never "AI slop." The seller reviews and approves, and the agent publishes to eBay. Later phases add sending offers to interested buyers and answering buyer messages.

The two non-negotiable quality bars:
1. **The agent is genuinely capable** — smart identification, honest pricing with evidence, no fabrication.
2. **Everything it writes reads as human** — enforced by [`VOICE.md`](../../../VOICE.md).

## 2. Scope

**v1 (this spec): the listing engine.** photos → identify → condition/detail pass → price research → draft listing + slop-linter → review & approve → publish.

**Out of scope for v1 (later phases):**
- **Phase 2:** sending offers to interested buyers (Negotiation API).
- **Phase 3:** buyer messaging / Q&A (Message API) with semi-autonomous replies.

**Explicit non-goals:** multi-user/SaaS, mobile app, bulk-import of existing listings, analytics dashboards, anything eBay's API can't do (see [`RESEARCH.md`](../../../RESEARCH.md)).

## 3. Autonomy model — semi-autonomous

- **Listings and offers always route to an approval queue.** The seller approves the outward action (publish, send offer). This is the eBay-policy-safe default and the primary quality gate.
- **Routine buyer replies (Phase 3) are handled automatically** with guardrails, escalating anything sensitive or unusual to the seller.
- Implemented via eve's native per-tool approval gates. Autonomy is adjustable per action type in Settings.

## 4. Architecture (Approach A)

- **Agent runtime:** Vercel **eve** framework. Durable, checkpointed sessions (survive crashes/deploys), cron for polling (phases 2/3), per-tool approval gates, typed tools. Agent capabilities live as files under `agent/`.
- **Dashboard:** **Next.js** (App Router) talking to the eve agent over its built-in HTTP channel (`withEve` / `useEveAgent`).
- **Persistence:** **Supabase** — Postgres for state, Storage for photos, Auth for single-user login.
- **Writing/vision model:** **Claude Opus 4.8**. Mechanical steps (linter, summaries, classification) route to a cheaper model (Haiku/Sonnet).
- **Hosting:** Vercel (eve's home). Self-hosting is possible later (the `steve` pattern) but out of scope.

### 4.1 The eBay adapter layer (the key enabler)

All eBay access sits behind **one typed interface** (`ebay/`), e.g. `identifyByImage`, `findComps`, `createListing`, `publishListing`, `getListing`. Two implementations:
- **`mock`** — fixtures/deterministic fakes. Works today, before the dev keyset arrives. Default in development.
- **`live`** — real eBay APIs. Selected by env flag when the keyset lands: first Sandbox, then Production.

This lets us build and polish the entire product now, then flip backends with near-zero rewrite. All eBay-specific constraints from `RESEARCH.md` (e.g. list via Trading API so Negotiation API works later; Media API for images; Browse for comps) are encapsulated here.

## 5. The agent capability loop (v1)

One durable eve session per item:

1. **Identify** — vision reads uploaded photos. `live` backend calls Browse `searchByImage` (Base64) for active-listing matches + Inventory Mapping API (US) for category/normalized specifics. Output: candidate identity (brand/model/category/specifics), a confidence signal, and any ambiguity to surface. Low confidence → ask the seller rather than guess.
2. **Condition & detail pass** — vision assesses condition, visible flaws, included accessories, inferable measurements. Generates a **targeted** clarification list for only what it cannot determine (size, "does it power on?", etc.), shown in the dashboard. No blanket questionnaire.
3. **Price research** — `findComps` returns comparable listings; the agent proposes a price + range **with the comp evidence shown**. Never fabricates a number; if evidence is thin, it says so.
4. **Draft listing + slop-linter** — Opus 4.8 writes title, item specifics, and description using `VOICE.md` as system prompt. Then the **slop-linter** runs:
   - **Blocking (compliance):** no contact info / links / off-platform solicitation; no keyword spam; character limits (title ≤ 80 incl. spaces, aspect values ≤ 65). Cannot proceed until clean.
   - **Warning (style):** blocklist density, copula-dressing, negative parallelism, rule-of-three, formatting tells, burstiness. Agent self-revises.
5. **Review & approve** — draft lands in the queue. Seller edits copy inline, adjusts price, hits **Approve & Publish**. Approve triggers `publishListing` (Trading API `AddFixedPriceItem` in `live`, so the listing is Negotiation-API-eligible in Phase 2). Post-publish, the listing is tracked with status.

Cheap steps route to the cheaper model; steps 1, 2, and 4 use Opus.

## 6. Data model (Supabase / Postgres)

- **`items`** — the physical thing: `id`, `photos[]` (Storage refs), `seller_notes`, `identity` (jsonb), `condition` (jsonb), `measurements` (jsonb), `status`, timestamps.
- **`listings`** — `id`, `item_id`, `title`, `specifics` (jsonb), `description`, `price`, `price_range` (jsonb), `ebay_listing_id` (nullable), `status` (draft/live/sold/ended), `linter_report` (jsonb), timestamps.
- **`comps`** — price evidence: `id`, `item_id`, `source`, `title`, `price`, `sold` (bool), `ref`, `captured_at`.
- **`approvals`** — the queue: `id`, `type` (listing|offer|message), `payload_ref`, `state` (pending/approved/rejected), timestamps.
- **`offers`** (Phase 2), **`messages`** (Phase 3).
- **`events`** — audit log of every agent action and approval decision.

## 7. Dashboard screens (v1) — "eBay-native, elevated"

Aesthetic: mostly neutral surfaces with eBay's red/blue/yellow/green used as deliberate accent *moments* (status, primary actions), real typography, and layered depth (base → elevated → floating). Not flat eBay.com. eBay logo in the top nav as the connected-account mark. Follows the user's global frontend rules (custom palette derived from eBay brand, layered tinted shadows, display+sans pairing, `transform`/`opacity`-only animation, full interactive states, screenshot-compare loop during build).

- **Queue (home)** — drafts awaiting approval as cards: photo thumb, title, price, estimated profit, linter status. The triage surface.
- **New Item** — drag-drop photo upload → starts the agent → live progress streamed from the durable eve session (identifying → pricing → drafting).
- **Listing Review** — the money screen: photo gallery, editable title/specifics/description, price with comp evidence, slop-linter panel (green checks / warnings), **Approve & Publish**.
- **Listings** — table of draft/live/sold listings with status and eBay links.
- **Settings** — connect eBay account (OAuth), voice/tone preferences, per-action autonomy toggles.

## 8. The voice / anti-slop system

`VOICE.md` is the single source of truth, used two ways:
1. As the **system prompt** for the writing model.
2. As the **slop-linter** spec: blocking compliance checks + style warnings, run programmatically after each draft.

It is a **living document** — the AI-vocabulary blocklist rotates over time and must be refreshed periodically; no single word is treated as proof.

## 9. Key external constraints (from RESEARCH.md)

- List via **Trading API** (`AddFixedPriceItem`), not the Inventory API, because the **Negotiation API does not support Inventory-API-managed listings** (Phase 2 depends on this).
- **Message API** (`commerce/message/v1`) enables Phase 3 buyer messaging (REST, shipped Q4 2025).
- **Sold-price data** (Marketplace Insights) is gated; use Browse API active comps + `searchByImage`.
- eBay's 2025 policies restrict feeding pricing/"Restricted API" data into third-party gen-AI and require human review of automated flows → keep the approval gates.
- Developer account: self-serve keyset, 5,000 calls/day default, full sandbox. (Seller has applied; awaiting approval — the adapter's `mock` backend unblocks all development in the meantime.)

## 10. Risks & open questions

- **eve is beta.** APIs may change before GA. Acceptable for a personal tool; pin versions.
- **Identification accuracy** on ambiguous/unbranded items — mitigated by the confidence gate and seller clarification step.
- **Pricing without sold data** — active comps are a weaker signal than sold comps; show evidence and let the seller adjust. Revisit Terapeak/Marketplace Insights later.
- **Title length / Cassini tokenization** — optimal title length is unresolved (a "use all 80 chars" theory was refuted). Front-load brand/product/model; treat exact length as tunable.
- **eBay OAuth token storage** — user token via authorization-code grant; store securely (Vercel Connect / Supabase). One-time consent.

## 11. Milestones

1. **M1 — Skeleton:** eve agent scaffold + Next.js dashboard shell (eBay-native design system) + Supabase schema + `mock` adapter. End-to-end mock run: upload → draft → approve → "published" (mock).
2. **M2 — The brain:** real identification/condition/pricing reasoning (Opus) + VOICE.md writer + slop-linter (blocking + warnings) against mock data. Quality bar: drafts read as human, linter is green.
3. **M3 — UI polish:** Listing Review + Queue to a high finish; screenshot-compare loop.
4. **M4 — Go live:** flip adapter to eBay **Sandbox** when keyset arrives; wire OAuth, Media API upload, Trading API publish, Browse comps. Then Production.
5. **Phase 2 / Phase 3** as separate specs.
