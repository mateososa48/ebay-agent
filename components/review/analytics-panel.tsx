import { Card, Eyebrow, Pill, type Tone } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { ListingAnalytics } from '@/lib/queries';

type Snap = ListingAnalytics['series'][number];
type MetricKey = 'watchCount' | 'hitCount';

const DAY = 86_400_000;

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Change in a metric vs the snapshot closest to 24h before the latest one. */
function delta(series: Snap[], key: MetricKey): { diff: number; label: string } | null {
  const pts = series.filter((s) => s[key] != null);
  if (pts.length < 2) return null;
  const latest = pts[pts.length - 1];
  const first = pts[0];
  if (!latest || !first) return null;
  const latestT = new Date(latest.capturedAt).getTime();
  const target = latestT - DAY;
  let base = first;
  let best = Infinity;
  for (const p of pts.slice(0, -1)) {
    const d = Math.abs(new Date(p.capturedAt).getTime() - target);
    if (d < best) {
      best = d;
      base = p;
    }
  }
  const spanHours = (latestT - new Date(first.capturedAt).getTime()) / 3_600_000;
  return {
    diff: (latest[key] ?? 0) - (base[key] ?? 0),
    label: spanHours >= 20 ? 'past 24h' : 'so far',
  };
}

function DeltaChip({ d }: { d: { diff: number; label: string } | null }) {
  if (!d) return null;
  const up = d.diff > 0;
  const flat = d.diff === 0;
  const color = flat ? 'var(--ink-faint)' : up ? 'var(--ebay-green-deep)' : 'var(--ebay-red)';
  const bg = flat ? 'var(--surface-2)' : up ? 'var(--tint-green)' : 'var(--tint-red)';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tnum"
      style={{ color, backgroundColor: bg }}
      title={`${up ? 'Up' : flat ? 'Unchanged' : 'Down'} ${d.label}`}
    >
      {!flat && <Icon.Trend className="size-3" style={up ? undefined : { transform: 'scaleY(-1)' }} />}
      {flat ? '±0' : `${up ? '+' : '−'}${Math.abs(d.diff)}`}
      <span className="font-normal text-ink-faint">{d.label}</span>
    </span>
  );
}

function StatCell({
  label,
  value,
  sub,
  accent,
  chip,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  chip?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{label}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="font-display text-[26px] font-bold leading-none text-ink tnum"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {chip}
      </div>
      {sub && <div className="mt-1.5 truncate text-[12px] text-ink-muted">{sub}</div>}
    </div>
  );
}

/**
 * Hero band for a live or sold listing: the four numbers that matter,
 * each with its move since roughly this time yesterday.
 */
export function AnalyticsPanel({
  analytics,
  price,
  sold,
}: {
  analytics: ListingAnalytics;
  price: number;
  sold: boolean;
}) {
  const { series, latest, listedAt, soldAt, salePrice } = analytics;

  const watchers = latest?.watchCount;
  const views = latest?.hitCount;

  const startIso = listedAt ?? series[0]?.capturedAt ?? null;
  const endMs = sold && soldAt ? new Date(soldAt).getTime() : Date.now();
  const days = startIso ? Math.max(0, Math.floor((endMs - new Date(startIso).getTime()) / DAY)) : null;

  return (
    <Card className="reveal overflow-hidden" style={{ animationDelay: '80ms' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <Eyebrow>{sold ? 'Final performance' : 'Performance'}</Eyebrow>
        <span className="font-mono text-[11px] text-ink-faint">
          {latest ? `checked ${ago(latest.capturedAt)}` : 'no snapshots yet'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline lg:grid-cols-4">
        <StatCell
          label="Watchers"
          value={watchers == null ? '—' : String(watchers)}
          sub={sold ? 'were watching at the end' : 'watching right now'}
          chip={<DeltaChip d={delta(series, 'watchCount')} />}
        />
        <StatCell
          label="Views"
          value={views == null ? '—' : views.toLocaleString('en-US')}
          sub="lifetime page views"
          chip={<DeltaChip d={delta(series, 'hitCount')} />}
        />
        <StatCell
          label={sold ? 'Days to sell' : 'Days live'}
          value={days == null ? '—' : String(days)}
          sub={startIso ? `listed ${fmtDay(startIso)}` : 'listing date unknown'}
        />
        {sold ? (
          <StatCell
            label="Sold for"
            value={salePrice == null ? money(price) : money(salePrice)}
            accent="var(--ebay-green-deep)"
            sub={`${soldAt ? fmtDay(soldAt) : 'date unknown'} · asked ${money(price)}`}
          />
        ) : (
          <StatCell label="Asking" value={money(price)} sub="adjust it in the price card" />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ Offers ------------------------------ */

const OFFER_TONE: Record<string, { tone: Tone; label: string }> = {
  drafted: { tone: 'blue', label: 'Drafted' },
  sent: { tone: 'green', label: 'Sent' },
  accepted: { tone: 'green', label: 'Accepted' },
  declined: { tone: 'red', label: 'Declined' },
  expired: { tone: 'neutral', label: 'Expired' },
};

/** Offers the agent has drafted or sent to watchers of this listing. */
export function OffersCard({ offers }: { offers: ListingAnalytics['offers'] }) {
  if (offers.length === 0) return null;
  return (
    <Card className="reveal p-5" style={{ animationDelay: '180ms' }}>
      <div className="flex items-center justify-between">
        <Eyebrow>Offers to watchers</Eyebrow>
        <span className="font-mono text-[11px] text-ink-faint tnum">{offers.length}</span>
      </div>
      <ul className="mt-3 divide-y divide-hairline">
        {offers.map((o) => {
          const meta = OFFER_TONE[o.status] ?? { tone: 'neutral' as Tone, label: o.status };
          return (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink tnum">
                  {money(o.offerPrice)}
                  <span className="ml-1.5 text-[12px] font-normal text-ink-faint tnum">
                    −{Math.round(o.discountPct)}%
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{ago(o.createdAt)}</div>
              </div>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
