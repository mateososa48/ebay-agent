# eBay Publishing (Trading API `AddFixedPriceItem`) — Design

- **Date:** 2026-07-12
- **Status:** Approved
- **Depends on:** eBay account OAuth connection (live; see `[[ebay-oauth-connection]]` memory)

## Goal

Wire the approval-gated **Approve & Publish** action on the listing review screen to publish a real fixed-price listing to the owner's connected eBay account via the Trading API `AddFixedPriceItem` call, with a `VerifyAddFixedPriceItem` dry-run preflight and honest error surfacing. Today `LiveEbayAdapter.publishListing` is a stub that throws, and the button is inert.

## Decisions (locked)

- **Trading API `AddFixedPriceItem`** (XML), authenticated with the user OAuth token via the `X-EBAY-API-IAF-TOKEN` header. NOT the Sell Inventory API — Trading keeps the future offers/negotiation feature viable and needs no business policies.
- **Managed Payments:** no payment policy in the request.
- **Shipping: Free shipping** — `FreeShipping=true` on a single domestic flat service at $0.
- **Returns: 30-day returns** — `ReturnsAcceptedOption`, `Days_30`, buyer pays return shipping.
- **Listing:** GTC (Good 'Til Cancelled), Quantity 1, Marketplace US (`SITEID 0`), USD.
- **Category:** auto-resolved to a leaf category ID via Commerce Taxonomy `getCategorySuggestions(title)`; persisted on the listing (replaces the hardcoded `11483` placeholder).
- **Condition:** inferred by the agent (`ItemCondition`), persisted on the listing, mapped to an eBay `ConditionID`.
- **Ship-from location:** ZIP read from the connected account via Trading `GetUser`; env fallback `SELLER_POSTAL_CODE`.
- **Preflight:** `VerifyAddFixedPriceItem` runs before `AddFixedPriceItem`; on any error, publish nothing and surface eBay's messages verbatim.
- **Approval-gated:** publishing happens only from the review screen; the existing "Require my approval before publishing" behavior is unchanged.

## Components

- **`lib/ebay/trading.ts`** — Trading API client: `request(callName, xmlBody)` sets headers (`X-EBAY-API-SITEID: 0`, `X-EBAY-API-COMPATIBILITY-LEVEL`, `X-EBAY-API-CALL-NAME`, `X-EBAY-API-IAF-TOKEN` = user access token, `Content-Type: text/xml`), POSTs to `https://api.ebay.com/ws/api.dll`, parses `Ack`/`Errors`/`ItemID`. Helpers: `verifyAddFixedPriceItem(payload)`, `addFixedPriceItem(payload)`, `getSellerPostalCode()`.
- **`lib/ebay/listing-xml.ts`** — pure, unit-testable builder: `PublishListingInput` → request XML for both Verify and Add (they share a body). Escapes XML; description in CDATA. Emits Title, PrimaryCategory, StartPrice, Quantity, `ListingDuration=GTC`, ConditionID, `Country=US`, `Currency=USD`, PostalCode, ItemSpecifics (aspects), PictureDetails (photo URLs), ShippingDetails (free flat), ReturnPolicy (30-day).
- **`lib/ebay/category.ts`** — `suggestCategoryId(title)`: Commerce Taxonomy `getDefaultCategoryTreeId` + `getCategorySuggestions`; returns the top leaf categoryId; in-memory cached; on unavailability returns `null` and the caller surfaces a clear message.
- **`lib/ebay/condition.ts`** — `conditionToEbayId(ItemCondition)`: `new→1000`, `open_box→1500`, `used_like_new|used_good|used_fair→3000`, `for_parts→7000`. (Category-specific invalids are caught by Verify.)
- **`lib/ebay/types.ts`** — add `PublishListingInput` (`title, description, price, categoryId, condition, aspects, photoUrls[], postalCode`) and `VerifyResult` (`{ ok, errors[] }`); keep `PublishResult` (`{ ebayListingId, url }`); extend `EbayAdapter` with `verifyListing(input)` and change `publishListing(input)` to take `PublishListingInput`.
- **`lib/ebay/live.ts`** — implement `verifyListing` + `publishListing` on top of `trading.ts`, `listing-xml.ts`, `condition.ts`, `getUserAccessToken()`.
- **`lib/ebay/mock.ts`** — `verifyListing → { ok: true, errors: [] }`; `publishListing → { ebayListingId: 'MOCK-…', url }`, accepting the richer input.
- **Schema + repo** — `listings` gains `condition text` and `ebay_category_id text` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`). `createListing`/`updateListing` persist them; `saveListingDraft` stops dropping `draft.condition`.
- **Server action** — `publishListingAction(listingId)`: load listing+item → resolve+persist category → assemble `PublishListingInput` (aspects from `listings.specifics`, photos from `items.photos`, ZIP from `GetUser`/env) → `verifyListing` → `publishListing` → on success `decideApproval(approved)` + `updateListing({ status:'live', ebayListingId, ebay_category_id, condition })` + item→`listed` + `recordEvent('published', { ebayListingId, url })`. Returns `{ ok, url }` or `{ ok:false, errors }`. A minimal `rejectListingAction` backs "Send back" (`decideApproval(rejected)`, item→`draft`).
- **UI** — `components/review/action-bar.tsx` becomes interactive (`useTransition`): Approve & Publish calls the action and renders pending / success (link to the live `ebay.com/itm/…`) / eBay error list; "Send back" calls the reject action.

## Data flow

Review screen → **Approve & Publish** → `publishListingAction` → resolve category → assemble payload → **`VerifyAddFixedPriceItem`** (catches missing aspects/condition/category *before* going live) → if clean, **`AddFixedPriceItem`** → store live item ID + URL, flip statuses → UI shows the live listing link.

## Error handling

- Not connected → "Connect your eBay account first."
- Verify errors (missing required aspect, bad condition for category, bad category) → surfaced verbatim; nothing published; status unchanged.
- Add errors → surfaced; `publish_failed` event logged; status unchanged.
- Missing ZIP → message to set `SELLER_POSTAL_CODE` / fix the account address.

## Scope

- **In:** real end-to-end publish, approval-gated, Verify preflight, auto-category, condition mapping, free shipping + 30-day returns, ZIP auto-read (env fallback), error surfacing, editable price.
- **Deferred (fast-follow):** inline editing of title/description/aspects in the review UI; per-category required-aspects auto-fetch/fill (Verify already reports what's missing); offers + messaging publish; "Send back" polish.

## Testing

- **Unit:** `listing-xml` builder against fixtures; `conditionToEbayId`; `category` resolver against a mocked Taxonomy response; `publishListingAction` happy + error paths against PGlite with the mock adapter.
- **Live safety net:** the Verify dry-run before the first real `Add`.
