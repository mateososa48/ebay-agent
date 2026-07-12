import { AppShell } from '@/components/shell/app-shell';
import { ListingsTable } from '@/components/listings/listings-table';
import { Eyebrow } from '@/components/ui/primitives';
import { getAllListings, type ListingRowView } from '@/lib/queries';
import { SAMPLE_DRAFTS } from '@/lib/sample-data';

export const dynamic = 'force-dynamic';

const SAMPLE_ROWS: ListingRowView[] = SAMPLE_DRAFTS.map((d, i) => ({
  id: d.id,
  sku: d.sku,
  title: d.title,
  photo: d.photo,
  category: d.category,
  price: d.price,
  status: ['live', 'draft', 'sold', 'live'][i] ?? 'draft',
  compCount: d.compCount,
  agedMinutes: d.agedMinutes * 12,
}));

export default async function ListingsPage() {
  let rows: ListingRowView[] = [];
  try {
    rows = await getAllListings(Date.now());
  } catch {
    rows = [];
  }
  const data = rows.length ? rows : SAMPLE_ROWS;

  return (
    <AppShell>
      <header className="reveal">
        <Eyebrow>Inventory</Eyebrow>
        <h1 className="mt-2.5 font-display text-[40px] font-bold leading-[1.0] tracking-[-0.035em] text-ink">
          Listings
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-muted">
          Everything your agent has drafted, put live, and sold — in one place.
        </p>
      </header>

      <div className="mt-8">
        <ListingsTable rows={data} />
      </div>
    </AppShell>
  );
}
