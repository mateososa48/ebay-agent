export interface CompRow {
  title: string;
  price: number;
  sold: boolean;
}

export interface ListingDetail {
  id: string;
  sku: string;
  title: string;
  category: string;
  condition: string;
  status: string;
  confidence: number;
  photos: string[];
  price: number;
  compLow: number;
  compHigh: number;
  comps: CompRow[];
  specifics: { label: string; value: string }[];
  description: string;
  linter: {
    compliance: string[];
    warnings: { code: string; message: string }[];
  };
}

const img = (seed: string) => `https://picsum.photos/seed/${seed}/1000/1000`;

export const SAMPLE_LISTING: ListingDetail = {
  id: 'itm_3b7c',
  sku: 'CTX-T2-BLK',
  title: 'Contax T2 35mm Film Camera Titanium Black Carl Zeiss 38mm f/2.8 Point Shoot',
  category: 'Cameras & Photo › Film Cameras',
  condition: 'Used · Like New',
  status: 'draft',
  confidence: 0.94,
  photos: [img('contaxt2a'), img('contaxt2b'), img('contaxt2c'), img('contaxt2d'), img('contaxt2e')],
  price: 749,
  compLow: 610,
  compHigh: 890,
  comps: [
    { title: 'Contax T2 Titanium Black — tested, clean', price: 812, sold: true },
    { title: 'Contax T2 Black w/ case', price: 890, sold: true },
    { title: 'Contax T2 Titanium Black, light brassing', price: 735, sold: true },
    { title: 'Contax T2 (black) — as-is, meter issue', price: 610, sold: true },
    { title: 'Contax T2 Titanium Black, CLA’d', price: 845, sold: true },
    { title: 'Contax T2 Black, strap included', price: 760, sold: true },
  ],
  specifics: [
    { label: 'Brand', value: 'Contax' },
    { label: 'Model', value: 'T2' },
    { label: 'Type', value: 'Point & Shoot' },
    { label: 'Film Format', value: '35mm' },
    { label: 'Focal Length', value: '38mm' },
    { label: 'Max Aperture', value: 'f/2.8' },
    { label: 'Color', value: 'Titanium Black' },
    { label: 'Country of Manufacture', value: 'Japan' },
  ],
  description:
    "Contax T2 in titanium black — one of the best point-and-shoots ever made, and this one is clean. The glass is clear with no fog or fungus, and the Carl Zeiss 38mm f/2.8 is sharp wide open. Autofocus and metering both read correctly, the flash fires, and the film-door seals are good (no light leaks across my last two rolls).\n\nCosmetically there's light brassing along the bottom edge and a small mark near the strap lug, both shown in photos 3 and 4. Everything else is tight. Comes with the body cap and a fresh CR123A battery installed. No box.\n\nShips double-boxed with tracking, next business day.",
  linter: {
    compliance: [
      'No contact info, links, or emails',
      'No off-platform solicitation',
      'Title 73 / 80 characters',
      'All item specifics within limits',
    ],
    warnings: [],
  },
};
