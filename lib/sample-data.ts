// Sample data for building the UI against realistic content before the live
// Neon + agent wiring lands. Photos are placeholder photography.

export interface QueueDraft {
  id: string;
  sku: string;
  title: string;
  photo: string;
  category: string;
  condition: string;
  price: number;
  compLow: number;
  compHigh: number;
  compCount: number;
  linter: { ok: boolean; warnings: number };
  agedMinutes: number;
}

const img = (seed: string) => `https://picsum.photos/seed/${seed}/640/640`;

export const SAMPLE_DRAFTS: QueueDraft[] = [
  {
    id: 'itm_9f2a',
    sku: 'LV-501-3432',
    title: "Levi's 501 Vintage Jeans · Men's 34×32 · Dark Wash · Made in USA",
    photo: img('levis501'),
    category: "Men's Jeans",
    condition: 'Used · Good',
    price: 48,
    compLow: 34,
    compHigh: 69,
    compCount: 4,
    linter: { ok: true, warnings: 0 },
    agedMinutes: 6,
  },
  {
    id: 'itm_3b7c',
    sku: 'CTX-T2-BLK',
    title: 'Contax T2 35mm Point & Shoot Film Camera · Titanium Black',
    photo: img('contaxt2'),
    category: 'Film Cameras',
    condition: 'Used · Like New',
    price: 749,
    compLow: 610,
    compHigh: 890,
    compCount: 6,
    linter: { ok: true, warnings: 0 },
    agedMinutes: 22,
  },
  {
    id: 'itm_5d1e',
    sku: 'NK-AM90-105',
    title: 'Nike Air Max 90 · Infrared · Size 10.5 · OG Colorway',
    photo: img('airmax90'),
    category: "Men's Sneakers",
    condition: 'Used · Good',
    price: 72,
    compLow: 55,
    compHigh: 120,
    compCount: 5,
    linter: { ok: true, warnings: 2 },
    agedMinutes: 41,
  },
  {
    id: 'itm_8a4f',
    sku: 'CH-DTRT-JKT',
    title: 'Carhartt Detroit Jacket · Brown Duck · Blanket Lined · Large',
    photo: img('carhartt'),
    category: "Men's Coats & Jackets",
    condition: 'Used · Good',
    price: 58,
    compLow: 40,
    compHigh: 95,
    compCount: 4,
    linter: { ok: true, warnings: 1 },
    agedMinutes: 73,
  },
];

export const SAMPLE_STATS = {
  awaiting: SAMPLE_DRAFTS.length,
  live: 12,
  queuedValue: SAMPLE_DRAFTS.reduce((s, d) => s + d.price, 0),
  soldThisWeek: 7,
  soldValue: 612,
};
