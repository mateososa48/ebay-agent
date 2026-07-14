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

const ACTIVITY_KINDS = [
  'sale.detected',
  'message.drafted',
  'message.sent',
  'offer.drafted',
  'offer.sent',
  'listing.imported',
  'price.revised',
  'draft.deleted',
  'published',
];

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

/* ------------------- Listing analytics (detail page) ------------------- */

export interface ListingAnalytics {
  series: { watchCount: number | null; hitCount: number | null; quantitySold: number | null; capturedAt: string }[];
  latest: { watchCount: number | null; hitCount: number | null; quantitySold: number | null; capturedAt: string } | null;
  messages: {
    id: string;
    sender: string | null;
    question: string;
    draftedReply: string | null;
    status: string;
    createdAt: string;
  }[];
  offers: { id: string; offerPrice: number; discountPct: number; status: string; createdAt: string }[];
  timeline: { id: string; kind: string; data: Record<string, unknown>; createdAt: string }[];
  soldAt: string | null;
  salePrice: number | null;
  listedAt: string | null; // when it went live (import or publish), best-effort
}

/** Everything we know about one listing beyond the draft fields. Never throws. */
export async function getListingAnalytics(listingId: string): Promise<ListingAnalytics> {
  const empty: ListingAnalytics = {
    series: [],
    latest: null,
    messages: [],
    offers: [],
    timeline: [],
    soldAt: null,
    salePrice: null,
    listedAt: null,
  };
  try {
    const db = getDb();
    const [metrics, msgs, offs, listingRow] = await Promise.all([
      db.query<Row>(
        `select watch_count, hit_count, quantity_sold, captured_at
         from listing_metrics where listing_id = $1 order by captured_at asc limit 300`,
        [listingId],
      ),
      db.query<Row>(
        `select id, sender, question, drafted_reply, status, created_at
         from buyer_messages where listing_id = $1 order by created_at desc limit 20`,
        [listingId],
      ),
      db.query<Row>(
        `select id, offer_price, discount_pct, status, created_at
         from offers where listing_id = $1 order by created_at desc limit 10`,
        [listingId],
      ),
      db.query<Row>(`select item_id, sold_at, sale_price, listed_at, updated_at, status from listings where id = $1`, [listingId]),
    ]);
    const listing = listingRow.rows[0];
    let timeline: ListingAnalytics['timeline'] = [];
    let listedAt: string | null = null;
    if (listing) {
      const ev = await db.query<Row>(
        `select id, kind, data, created_at from events where item_id = $1 order by created_at desc limit 30`,
        [String(listing.item_id)],
      );
      timeline = ev.rows.map((r) => ({
        id: String(r.id),
        kind: String(r.kind),
        data: (r.data as Record<string, unknown>) ?? {},
        createdAt: new Date(String(r.created_at)).toISOString(),
      }));
      const listedEvent = ev.rows.find((r) => r.kind === 'published' || r.kind === 'listing.imported');
      // Prefer eBay's real go-live time; the import/publish event is only a fallback.
      listedAt = listing.listed_at
        ? new Date(String(listing.listed_at)).toISOString()
        : listedEvent
          ? new Date(String(listedEvent.created_at)).toISOString()
          : null;
    }
    const series = metrics.rows.map((r) => ({
      watchCount: r.watch_count == null ? null : Number(r.watch_count),
      hitCount: r.hit_count == null ? null : Number(r.hit_count),
      quantitySold: r.quantity_sold == null ? null : Number(r.quantity_sold),
      capturedAt: new Date(String(r.captured_at)).toISOString(),
    }));
    return {
      series,
      latest: series[series.length - 1] ?? null,
      messages: msgs.rows.map((r) => ({
        id: String(r.id),
        sender: r.sender == null ? null : String(r.sender),
        question: String(r.question),
        draftedReply: r.drafted_reply == null ? null : String(r.drafted_reply),
        status: String(r.status),
        createdAt: new Date(String(r.created_at)).toISOString(),
      })),
      offers: offs.rows.map((r) => ({
        id: String(r.id),
        offerPrice: Number(r.offer_price),
        discountPct: Number(r.discount_pct),
        status: String(r.status),
        createdAt: new Date(String(r.created_at)).toISOString(),
      })),
      timeline,
      soldAt: listing?.sold_at ? new Date(String(listing.sold_at)).toISOString() : null,
      salePrice: listing?.sale_price == null ? null : Number(listing.sale_price),
      listedAt,
    };
  } catch {
    return empty;
  }
}

/* ------------------------- Overview / dashboard ------------------------- */

export interface DashboardData {
  stats: {
    live: number;
    sold: number;
    revenue: number; // sum of sale prices
    queuedValue: number; // drafts awaiting approval
    pendingApprovals: number; // all types
    totalWatchers: number;
    offersSent: number;
    lastSnapshotAt: string | null; // newest metrics snapshot — freshness signal
  };
  liveListings: {
    id: string;
    title: string;
    photo: string;
    price: number | null;
    watchers: number | null;
    views: number | null;
    daysLive: number;
    openMessages: number;
    offerStatus: string | null; // drafted | sent | null
    watchSeries: (number | null)[]; // sparkline
  }[];
  salesByWeek: { week: string; revenue: number; count: number }[];
  attention: { kind: 'draft' | 'reply' | 'offer'; id: string; title: string; detail: string; href: string }[];
  activity: ActivityEntry[];
}

/** Aggregates for the Overview page. Each block degrades independently. */
export async function getDashboardData(nowMs: number): Promise<DashboardData> {
  serverNow = () => nowMs;
  const db = getDb();
  const data: DashboardData = {
    stats: { live: 0, sold: 0, revenue: 0, queuedValue: 0, pendingApprovals: 0, totalWatchers: 0, offersSent: 0, lastSnapshotAt: null },
    liveListings: [],
    salesByWeek: [],
    attention: [],
    activity: [],
  };

  try {
    const { rows } = await db.query<Row>(
      `select
         count(*) filter (where status = 'live') as live,
         count(*) filter (where status = 'sold') as sold,
         coalesce(sum(sale_price) filter (where status = 'sold'), 0) as revenue
       from listings`,
    );
    const r = rows[0];
    data.stats.live = Number(r?.live ?? 0);
    data.stats.sold = Number(r?.sold ?? 0);
    data.stats.revenue = Number(r?.revenue ?? 0);
  } catch { /* keep zeros */ }

  try {
    const { rows } = await db.query<Row>(
      `select coalesce(sum(l.price), 0) as queued, count(*) as n
       from approvals a join listings l on l.id = a.ref_id
       where a.type = 'listing' and a.state = 'pending'`,
    );
    data.stats.queuedValue = Number(rows[0]?.queued ?? 0);
  } catch { /* ignore */ }

  try {
    const { rows } = await db.query<Row>(`select count(*) as n from approvals where state = 'pending'`);
    data.stats.pendingApprovals = Number(rows[0]?.n ?? 0);
  } catch { /* ignore */ }

  try {
    const { rows } = await db.query<Row>(
      `with latest as (
         select distinct on (listing_id) listing_id, watch_count, hit_count
         from listing_metrics order by listing_id, captured_at desc
       ),
       spark as (
         select listing_id, array_agg(watch_count order by captured_at desc) as watches
         from (select listing_id, watch_count, captured_at,
                      row_number() over (partition by listing_id order by captured_at desc) as rn
               from listing_metrics) t
         where rn <= 24
         group by listing_id
       )
       select l.id, l.title, l.price, coalesce(l.listed_at, l.created_at) as created_at, i.photos,
              m.watch_count, m.hit_count, s.watches,
              (select count(*) from buyer_messages bm where bm.listing_id = l.id and bm.status = 'drafted') as open_msgs,
              (select o.status from offers o where o.listing_id = l.id and o.status in ('drafted','sent')
               order by o.created_at desc limit 1) as offer_status
       from listings l
       join items i on i.id = l.item_id
       left join latest m on m.listing_id = l.id
       left join spark s on s.listing_id = l.id
       where l.status = 'live'
       order by coalesce(m.watch_count, 0) desc, l.created_at desc`,
    );
    data.liveListings = rows.map((r) => {
      const photos = (r.photos as string[] | null) ?? [];
      const watches = ((r.watches as (number | string | null)[] | null) ?? [])
        .map((w) => (w == null ? null : Number(w)))
        .reverse(); // oldest → newest for the sparkline
      return {
        id: String(r.id),
        title: String(r.title),
        photo: photos[0] ?? '',
        price: r.price == null ? null : Number(r.price),
        watchers: r.watch_count == null ? null : Number(r.watch_count),
        views: r.hit_count == null ? null : Number(r.hit_count),
        daysLive: Math.max(0, Math.round(minutesSince(r.created_at) / 1440)),
        openMessages: Number(r.open_msgs ?? 0),
        offerStatus: r.offer_status == null ? null : String(r.offer_status),
        watchSeries: watches,
      };
    });
    data.stats.totalWatchers = data.liveListings.reduce((s, l) => s + (l.watchers ?? 0), 0);
  } catch { /* ignore */ }

  try {
    const { rows } = await db.query<Row>(`select count(*) as n from offers where status = 'sent'`);
    data.stats.offersSent = Number(rows[0]?.n ?? 0);
  } catch { /* ignore */ }

  try {
    const { rows } = await db.query<Row>(`select max(captured_at) as t from listing_metrics`);
    data.stats.lastSnapshotAt = rows[0]?.t ? new Date(String(rows[0].t)).toISOString() : null;
  } catch { /* ignore */ }

  try {
    const { rows } = await db.query<Row>(
      `select date_trunc('week', sold_at) as week, sum(sale_price) as revenue, count(*) as n
       from listings where status = 'sold' and sold_at is not null
       group by 1 order by 1 asc limit 26`,
    );
    data.salesByWeek = rows.map((r) => ({
      week: new Date(String(r.week)).toISOString(),
      revenue: Number(r.revenue ?? 0),
      count: Number(r.n ?? 0),
    }));
  } catch { /* ignore */ }

  try {
    const [drafts, replies, offers] = await Promise.all([
      db.query<Row>(
        `select l.id, l.title, l.price from approvals a join listings l on l.id = a.ref_id
         where a.type = 'listing' and a.state = 'pending' order by a.created_at desc limit 8`,
      ),
      db.query<Row>(
        `select bm.id, bm.question, l.title, bm.listing_id from buyer_messages bm
         left join listings l on l.id = bm.listing_id
         where bm.status = 'drafted' order by bm.created_at desc limit 8`,
      ),
      db.query<Row>(
        `select o.id, o.offer_price, l.title, o.listing_id from offers o
         join listings l on l.id = o.listing_id
         where o.status = 'drafted' order by o.created_at desc limit 8`,
      ),
    ]);
    data.attention = [
      ...drafts.rows.map((r) => ({
        kind: 'draft' as const,
        id: String(r.id),
        title: String(r.title),
        detail: r.price == null ? 'Draft ready to review' : `Draft · $${Number(r.price)}`,
        href: `/listings/${String(r.id)}`,
      })),
      ...replies.rows.map((r) => ({
        kind: 'reply' as const,
        id: String(r.id),
        title: r.title == null ? 'Buyer question' : String(r.title),
        detail: `Reply drafted — "${String(r.question).slice(0, 60)}${String(r.question).length > 60 ? '…' : ''}"`,
        href: '/',
      })),
      ...offers.rows.map((r) => ({
        kind: 'offer' as const,
        id: String(r.id),
        title: String(r.title),
        detail: `Offer drafted · $${Number(r.offer_price).toFixed(2)}`,
        href: '/',
      })),
    ];
  } catch { /* ignore */ }

  try {
    data.activity = await getRecentActivity(14);
  } catch { /* ignore */ }

  return data;
}
