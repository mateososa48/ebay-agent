import 'server-only';
import { getDb } from '@/lib/db/client';
import { getEbayConnection } from '@/lib/db/repos/connection';
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

export interface ListingRowView {
  id: string;
  sku: string;
  title: string;
  photo: string;
  category: string;
  price: number;
  status: string;
  compCount: number;
  agedMinutes: number;
}

export async function getAllListings(nowMs: number): Promise<ListingRowView[]> {
  serverNow = () => nowMs;
  const db = getDb();
  const { rows } = await db.query<Row>(
    `select l.id, l.title, l.price, l.status, l.created_at,
            i.id as item_id, i.photos, i.identity,
            c.n as comp_n
       from listings l
       join items i on i.id = l.item_id
       left join (select item_id, count(*) n from comps group by item_id) c on c.item_id = i.id
      order by l.created_at desc`,
  );
  return rows.map((r) => {
    const photos = (r.photos as string[] | null) ?? [];
    return {
      id: String(r.id),
      sku: skuOf(String(r.item_id), r.identity),
      title: String(r.title),
      photo: photos[0] ?? '',
      category: categoryLabel(r.identity),
      price: Number(r.price ?? 0),
      status: String(r.status),
      compCount: Number(r.comp_n ?? 0),
      agedMinutes: minutesSince(r.created_at),
    };
  });
}

export interface EbayStatus {
  keysConfigured: boolean;
  connected: boolean;
  connectedAt?: string;
  env: string;
}

export async function getEbayStatus(): Promise<EbayStatus> {
  const keysConfigured = Boolean(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID);
  const env = process.env.EBAY_ENV ?? 'production';
  try {
    const conn = await getEbayConnection(getDb());
    return { keysConfigured, connected: Boolean(conn), connectedAt: conn?.connectedAt, env };
  } catch {
    return { keysConfigured, connected: false, env };
  }
}

export async function getPendingApprovalCount(): Promise<number> {
  try {
    const { rows } = await getDb().query<{ n: string | number }>(
      `select count(*) as n from approvals where state = 'pending'`,
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export interface PendingReply {
  id: string;
  sender: string | null;
  subject: string | null;
  question: string;
  draftedReply: string;
  listingId: string | null;
  listingTitle: string | null;
  createdAt: string;
}

/** Drafted buyer replies awaiting approval, newest first. Never throws. */
export async function getPendingReplies(): Promise<PendingReply[]> {
  try {
    const { rows } = await getDb().query<{
      id: string;
      sender: string | null;
      subject: string | null;
      question: string;
      drafted_reply: string | null;
      listing_id: string | null;
      listing_title: string | null;
      created_at: string | Date;
    }>(
      `select bm.id, bm.sender, bm.subject, bm.question, bm.drafted_reply, bm.listing_id, l.title as listing_title, bm.created_at
       from buyer_messages bm
       left join listings l on l.id = bm.listing_id
       where bm.status = 'drafted'
       order by bm.created_at desc`,
    );
    return rows.map((r) => ({
      id: r.id,
      sender: r.sender,
      subject: r.subject,
      question: r.question,
      draftedReply: r.drafted_reply ?? '',
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

export interface PendingOffer {
  id: string;
  listingId: string;
  listingTitle: string;
  listPrice: number | null;
  offerPrice: number;
  discountPct: number;
  message: string | null;
  createdAt: string;
}

/** Drafted watcher offers awaiting approval, newest first. Never throws. */
export async function getPendingOffers(): Promise<PendingOffer[]> {
  try {
    const { rows } = await getDb().query<{
      id: string;
      listing_id: string;
      title: string;
      price: string | null;
      offer_price: string;
      discount_pct: string;
      message: string | null;
      created_at: string | Date;
    }>(
      `select o.id, o.listing_id, l.title, l.price, o.offer_price, o.discount_pct, o.message, o.created_at
       from offers o
       join listings l on l.id = o.listing_id
       where o.status = 'drafted'
       order by o.created_at desc`,
    );
    return rows.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.title,
      listPrice: r.price === null ? null : Number(r.price),
      offerPrice: Number(r.offer_price),
      discountPct: Number(r.discount_pct),
      message: r.message,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

export interface ActivityEntry {
  id: string;
  kind: string;
  data: Record<string, unknown>;
  createdAt: string;
}

const ACTIVITY_KINDS = ['sale.detected', 'message.drafted', 'message.sent', 'offer.drafted', 'offer.sent'];

/** Recent buyer-automation activity for the dashboard feed. Never throws. */
export async function getRecentActivity(limit = 10): Promise<ActivityEntry[]> {
  try {
    const { rows } = await getDb().query<{ id: string; kind: string; data: unknown; created_at: string | Date }>(
      `select id, kind, data, created_at from events where kind = any($1) order by created_at desc limit $2`,
      [ACTIVITY_KINDS, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      data: (r.data as Record<string, unknown>) ?? {},
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
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
    `select l.id, l.title, l.price, l.specifics, l.description, l.linter_report, l.status, l.ebay_listing_id,
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
    status: String(r.status),
    ebayListingId: r.ebay_listing_id ? String(r.ebay_listing_id) : null,
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
