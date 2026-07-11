import 'server-only';
import { getDb } from '@/lib/db/client';
import type { QueueDraft } from '@/lib/sample-data';
import type { ListingDetail, CompRow } from '@/lib/sample-listing';

type Row = Record<string, unknown>;

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  open_box: 'Open Box',
  used_like_new: 'Used · Like New',
  used_good: 'Used · Good',
  used_fair: 'Used · Fair',
  for_parts: 'For Parts',
};

function conditionLabel(condition: unknown): string {
  const grade = (condition as { grade?: string } | null)?.grade;
  return (grade && CONDITION_LABEL[grade]) || 'Used';
}

function categoryLabel(identity: unknown): string {
  const id = identity as { productType?: string } | null;
  return id?.productType || 'Uncategorized';
}

function skuOf(itemId: string, identity: unknown): string {
  const id = identity as { brand?: string; model?: string } | null;
  const base = [id?.brand, id?.model].filter(Boolean).join('-').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  return base ? base.slice(0, 14) : itemId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function minutesSince(iso: unknown): number {
  const t = new Date(String(iso)).getTime();
  return Math.max(0, Math.round((serverNow() - t) / 60000));
}

// Injected at call time so the module has no top-level Date usage.
let serverNow: () => number = () => new Date().getTime();

export async function getQueueDrafts(nowMs: number): Promise<QueueDraft[]> {
  serverNow = () => nowMs;
  const db = getDb();
  const { rows } = await db.query<Row>(
    `select l.id as listing_id, l.title, l.price, l.linter_report, l.created_at,
            i.id as item_id, i.photos, i.identity, i.condition,
            c.lo as comp_lo, c.hi as comp_hi, c.n as comp_n
       from approvals a
       join listings l on l.id = a.ref_id
       join items i on i.id = l.item_id
       left join (select item_id, min(price) lo, max(price) hi, count(*) n from comps group by item_id) c
              on c.item_id = i.id
      where a.type = 'listing' and a.state = 'pending'
      order by a.created_at desc`,
  );

  return rows.map((r): QueueDraft => {
    const photos = (r.photos as string[] | null) ?? [];
    const report = (r.linter_report as { warnings?: unknown[] } | null) ?? null;
    return {
      id: String(r.listing_id),
      sku: skuOf(String(r.item_id), r.identity),
      title: String(r.title),
      photo: photos[0] ?? '',
      category: categoryLabel(r.identity),
      condition: conditionLabel(r.condition),
      price: Number(r.price ?? 0),
      compLow: Number(r.comp_lo ?? 0),
      compHigh: Number(r.comp_hi ?? 0),
      compCount: Number(r.comp_n ?? 0),
      linter: { ok: true, warnings: report?.warnings?.length ?? 0 },
      agedMinutes: minutesSince(r.created_at),
    };
  });
}

export async function getListingCounts(): Promise<{ live: number; sold: number }> {
  const db = getDb();
  const { rows } = await db.query<Row>(
    `select
       count(*) filter (where status = 'live') as live,
       count(*) filter (where status = 'sold') as sold
     from listings`,
  );
  const r = rows[0];
  return { live: Number(r?.live ?? 0), sold: Number(r?.sold ?? 0) };
}

export async function getListingDetail(listingId: string): Promise<ListingDetail | null> {
  const db = getDb();
  const { rows } = await db.query<Row>(
    `select l.id, l.title, l.price, l.specifics, l.description, l.linter_report,
            i.id as item_id, i.photos, i.identity, i.condition
       from listings l join items i on i.id = l.item_id
      where l.id = $1`,
    [listingId],
  );
  const r = rows[0];
  if (!r) return null;

  const { rows: compRows } = await db.query<Row>(
    `select source, title, price, sold from comps where item_id = $1 order by price asc`,
    [String(r.item_id)],
  );
  const comps: CompRow[] = compRows.map((c) => ({
    title: String(c.title),
    price: Number(c.price),
    sold: Boolean(c.sold),
  }));

  const specificsObj = (r.specifics as Record<string, string> | null) ?? {};
  const report = (r.linter_report as { warnings?: { code?: string; message?: string }[] } | null) ?? null;
  const title = String(r.title);
  const photos = (r.photos as string[] | null) ?? [];
  const identity = r.identity as { confidence?: number } | null;

  return {
    id: String(r.id),
    sku: skuOf(String(r.item_id), r.identity),
    title,
    category: categoryLabel(r.identity),
    condition: conditionLabel(r.condition),
    confidence: identity?.confidence ?? 0.8,
    photos: photos.length > 0 ? photos : [''],
    price: Number(r.price ?? 0),
    compLow: comps.length ? Math.min(...comps.map((c) => c.price)) : 0,
    compHigh: comps.length ? Math.max(...comps.map((c) => c.price)) : 0,
    comps,
    specifics: Object.entries(specificsObj).map(([label, value]) => ({ label, value: String(value) })),
    description: String(r.description ?? ''),
    linter: {
      compliance: [
        'No contact info, links, or emails',
        'No off-platform solicitation',
        `Title ${title.length} / 80 characters`,
        'All item specifics within limits',
      ],
      warnings: (report?.warnings ?? []).map((w) => ({
        code: w.code ?? 'note',
        message: w.message ?? '',
      })),
    },
  };
}
