# DESIGN.md — The Dashboard Design System

The look, feel, and rules for the eBay selling agent's dashboard. Written before the code so every choice is intentional. Goal: genuine craft, zero AI slop.

## Concept — "The Consignment Desk"

A calm, editorial, high-trust operator's console for a serious seller. The feeling: the back office of a high-end consignment house crossed with a precise developer tool (Linear/Vercel restraint). The tool's real job is **earning trust** — making the seller confident enough to approve what the agent wrote. So the UI is **evidence-forward and calm**: the item photos are the hero, the price shows its comps, the draft shows its linter checks, the agent shows its work. Every element earns its place.

**The one memorable thing:** the **live agent pipeline** — drop photos and watch the agent think through `identify → price → draft → lint` as an elegant animated sequence in the eBay colors, streaming its real reasoning. Backed by a **Listing Review "money screen"** laid out like an editorial spread so approving feels confident.

## Theme

Warm **light "paper"** as the primary theme, with an impeccable **dark** counterpart (theme-aware, both first-class). Lead light — it's on-brand (eBay is optimistic/light) and dodges the generic dark-SaaS cliché. Photos and the eBay colors carry the warmth.

## Color

Never pure `#fff` / `#000`. Warm neutrals throughout. The four eBay brand colors are used **semantically**, sparingly, and confidently — as accent *moments*, never washes.

**Light**
- `--paper` (page): `#F6F4EF` (warm bone)
- `--surface` (card): `#FFFFFF`
- `--surface-2` (sunken/inset): `#F1EEE8`
- `--ink` (text): `#211C16` (warm near-black)
- `--ink-muted`: `#6E665B`
- `--ink-faint`: `#9A9184`
- `--hairline`: `#E7E1D7`

**Dark**
- `--paper`: `#141210`  · `--surface`: `#1C1915` · `--surface-2`: `#211D18`
- `--ink`: `#F3EEE6` · `--ink-muted`: `#A79E90` · `--hairline`: `#2E2823`

**eBay accents (semantic — the key move)**
- Blue `#0064D2` → primary actions, links, "trust"/info. (Buttons use a slightly deeper `#0654BA`.)
- Green `#4C8C2B` for text/positive (deeper for contrast); brand `#86B817` as fills/dots → **profit, go, published, approved**.
- Yellow `#F5AF02` → **pending, awaiting approval, linter warnings**.
- Red `#E53238` → **blocking issues, alerts, urgency**.

## Typography (not Inter, not Space Grotesk)

- **Display** — `Bricolage Grotesque` (headings, item titles, big figures). Expressive, characterful. Tight tracking (`-0.02em`) at large sizes.
- **UI / body** — `Hanken Grotesk`. Warm, crisp at 13–14px for data density. `font-variant-numeric: tabular-nums` on all prices/figures.
- **Mono** — `Geist Mono` (or JetBrains Mono) for IDs, comp source tags, SKUs, timestamps — the "console" precision touch. Used sparingly.
- Body line-height generous (`1.65`); large headings tight.

## Depth / elevation (layered, color-tinted, low-opacity — never flat `shadow-md`)

Warm-tinted shadows on a three-plane system: **base → raised → floating**.
- raised (card): `0 1px 2px rgba(50,38,24,.05), 0 4px 14px -6px rgba(50,38,24,.10)`
- floating (popover/modal): `0 8px 40px -12px rgba(50,38,24,.22), 0 2px 6px rgba(50,38,24,.06)`
- Hairline borders (`1px solid --hairline`) do most of the separation; shadows are subtle.

## Motion (Motion library; transform/opacity only; spring easing)

- **Page load:** one orchestrated staggered reveal (`animation-delay` cascade), not scattered micro-fidgets.
- **The pipeline is the showpiece:** each step (identify/price/draft/lint) lights up in sequence as the agent streams; the active step pulses in its eBay color.
- **Hover/press:** every interactive element has hover, focus-visible, active. Spring, not linear. No `transition-all`.
- Reduced-motion respected.

## Layout & composition

- Refined left **sidebar** (nav + the authentic eBay wordmark) + main content. Generous negative space; an intentional spacing scale.
- **Listing Review** is a two-column editorial spread: photo gallery left, editable copy + price-with-comps + linter panel right.
- Grid-breaking, characterful details where they earn it (oversized figures, a diagonal accent, the pipeline rail) — restrained, not busy.

## The eBay wordmark

Render the authentic lowercase **ebay** wordmark in the nav — `e` red, `b` blue, `a` yellow, `y` green — as a crafted inline SVG/typographic mark. The user asked for it specifically; do it right, not a knockoff.

## Stack

Next.js 15 (App Router, React 19) · Tailwind v4 · Motion (motion.dev) · Radix primitives (accessibility) · `next/font` for the three families · Neon (server components/actions) · `useEveAgent` for the live agent stream. Node 24.

## Anti-slop guardrails (from the global rules)

No default Tailwind palette. No `Inter`/`Roboto`/system-font headings. No flat `shadow-md`. No `transition-all`. No purple-on-white. Layered depth, custom color derived from the eBay brand, distinctive type, real interactive states, screenshot-compare iteration until it's genuinely good.
