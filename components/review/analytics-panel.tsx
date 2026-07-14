import { Card, Eyebrow, Pill, type Tone } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { LocalTime, RelativeTime } from '@/components/ui/time';
import type { ListingAnalytics } from '@/lib/queries';

type Snap = ListingAnalytics['series'][number];
type MetricKey = 'watchCount' | 'hitCount';

const DAY = 86_400_000;

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

const DAY_FMT = { month: 'short', day: 'numeric' } as const;

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
  sub?: React.ReactNode;
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
  const { series, latest, listedAt, soldAt, salePrice, offers } = analytics;

  const watchers = latest?.watchCount;
  const views = latest?.hitCount;
  const offersSent = offers.filter((o) => o.status === 'sent').length;
  const offersDrafted = offers.filter((o) => o.status === 'drafted').length;

  const startIso = listedAt ?? series[0]?.capturedAt ?? null;
  const endMs = sold && soldAt ? new Date(soldAt).getTime() : Date.now();
  const days = startIso ? Math.max(0, Math.floor((endMs - new Date(startIso).getTime()) / DAY)) : null;

  return (
    <Card className="reveal overflow-hidden" style={{ animationDelay: '80ms' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <Eyebrow>{sold ? 'Final performance' : 'Performance'}</Eyebrow>
        <span className="font-mono text-[11px] text-ink-faint">
          {latest ? <>checked <RelativeTime iso={latest.capturedAt} /></> : 'no snapshots yet'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline lg:grid-cols-4">
        <StatCell
          label="Watchers"
          value={watchers == null ? '—' : String(watchers)}
          sub={sold ? 'were watching at the end' : 'watching right now'}
          chip={<DeltaChip d={delta(series, 'watchCount')} />}
        />
        {views != null ? (
          <StatCell
            label="Views"
            value={views.toLocaleString('en-US')}
            sub="lifetime page views"
            chip={<DeltaChip d={delta(series, 'hitCount')} />}
          />
        ) : (
          <StatCell
            label="Offers"
            value={offersSent > 0 ? String(offersSent) : offersDrafted > 0 ? '0' : '—'}
            sub={
              offersSent > 0
                ? 'sent to interested buyers'
                : offersDrafted > 0
                  ? `${offersDrafted} drafted, awaiting you`
                  : 'none eligible yet'
            }
          />
        )}
        <StatCell
          label={sold ? 'Days to sell' : 'Days live'}
          value={days == null ? '—' : String(days)}
          sub={startIso ? <>listed <LocalTime iso={startIso} options={DAY_FMT} /></> : 'listing date unknown'}
        />
        {sold ? (
          <StatCell
            label="Sold for"
            value={salePrice == null ? money(price) : money(salePrice)}
            accent="var(--ebay-green-deep)"
            sub={soldAt ? <>sold <LocalTime iso={soldAt} options={DAY_FMT} /> · asked {money(price)}</> : `asked ${money(price)}`}
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
                <div className="mt-0.5 font-mono text-[11px] text-ink-faint"><RelativeTime iso={o.createdAt} /></div>
              </div>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
