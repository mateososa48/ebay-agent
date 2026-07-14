import { Card, Eyebrow } from '@/components/ui/primitives';
import type { ListingAnalytics } from '@/lib/queries';

type Snap = ListingAnalytics['series'][number];
type Pt = { t: number; v: number };

/** Percent-space geometry for one series, drawn on its own y scale. */
function geometry(pts: Pt[], t0: number, span: number): { line: string; area: string; end: Pt & { x: number; y: number } } | null {
  if (pts.length < 2) return null;
  const max = Math.max(1, ...pts.map((p) => p.v));
  const coords = pts.map((p) => ({
    x: ((p.t - t0) / span) * 100,
    y: 90 - (p.v / max) * 76, // plot band: y 14 (max) → 90 (zero)
  }));
  const first = coords[0];
  const last = coords[coords.length - 1];
  const lastPt = pts[pts.length - 1];
  if (!first || !last || !lastPt) return null;
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const area = `${line} L${last.x.toFixed(2)},100 L${first.x.toFixed(2)},100 Z`;
  return { line, area, end: { ...lastPt, x: last.x, y: last.y } };
}

function lastValue(series: Snap[], key: 'watchCount' | 'hitCount'): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i]?.[key];
    if (v != null) return v;
  }
  return null;
}

function fmtShort(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtLong(t: number): string {
  return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function LegendDot({ color, label, value }: { color: string; label: string; value: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
      <span className="font-semibold text-ink tnum">{value == null ? '—' : value.toLocaleString('en-US')}</span>
    </span>
  );
}

/**
 * Views + watchers over time, hand-rolled SVG. Each series rides its own
 * y scale so a 6-watcher curve isn't flattened under a 400-view one —
 * read it for shape, read the legend for the numbers.
 */
export function EngagementChart({ series }: { series: Snap[] }) {
  const stamped = series
    .map((s) => ({ ...s, t: new Date(s.capturedAt).getTime() }))
    .filter((s) => Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t);

  const viewPts: Pt[] = stamped.filter((s) => s.hitCount != null).map((s) => ({ t: s.t, v: s.hitCount as number }));
  const watchPts: Pt[] = stamped.filter((s) => s.watchCount != null).map((s) => ({ t: s.t, v: s.watchCount as number }));

  const latestViews = lastValue(series, 'hitCount');
  const latestWatchers = lastValue(series, 'watchCount');

  const allTs = [...viewPts, ...watchPts].map((p) => p.t);
  const t0 = allTs.length ? Math.min(...allTs) : 0;
  const t1 = allTs.length ? Math.max(...allTs) : 0;
  const span = Math.max(1, t1 - t0);

  const views = geometry(viewPts, t0, span);
  const watchers = geometry(watchPts, t0, span);
  const drawable = views !== null || watchers !== null;

  return (
    <Card className="reveal p-5" style={{ animationDelay: '120ms' }}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <Eyebrow>Engagement</Eyebrow>
          <div className="mt-1 font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Views &amp; watchers over time
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LegendDot color="var(--ebay-blue)" label="Views" value={latestViews} />
          <LegendDot color="var(--ebay-green)" label="Watchers" value={latestWatchers} />
        </div>
      </div>

      {drawable ? (
        <>
          <div className="relative mt-4 h-40 overflow-hidden rounded-xl border border-hairline bg-surface-2/40">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cd-eng-views" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--ebay-blue)', stopOpacity: 0.18 }} />
                  <stop offset="1" style={{ stopColor: 'var(--ebay-blue)', stopOpacity: 0 }} />
                </linearGradient>
                <linearGradient id="cd-eng-watch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--ebay-green)', stopOpacity: 0.22 }} />
                  <stop offset="1" style={{ stopColor: 'var(--ebay-green)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {[14, 52, 90].map((y) => (
                <line key={y} x1="0" x2="100" y1={y} y2={y} vectorEffect="non-scaling-stroke" style={{ stroke: 'var(--hairline)', strokeWidth: 1 }} />
              ))}
              {views && <path d={views.area} fill="url(#cd-eng-views)" />}
              {watchers && <path d={watchers.area} fill="url(#cd-eng-watch)" />}
              {views && (
                <path d={views.line} fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--ebay-blue)', strokeWidth: 1.8 }} />
              )}
              {watchers && (
                <path d={watchers.line} fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--ebay-green)', strokeWidth: 1.8 }} />
              )}
            </svg>
            {/* End-of-line markers as HTML so they stay round under the stretched viewBox. */}
            {views && (
              <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: `${views.end.x}%`, top: `${views.end.y}%`, backgroundColor: 'var(--ebay-blue)' }} />
            )}
            {watchers && (
              <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: `${watchers.end.x}%`, top: `${watchers.end.y}%`, backgroundColor: 'var(--ebay-green)' }} />
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] text-ink-faint tnum">
            <span>{fmtShort(t0)}</span>
            <span>{stamped.length} snapshots · every ~15 min</span>
            <span>{fmtLong(t1)}</span>
          </div>
        </>
      ) : (
        <div className="mt-4 grid h-40 place-items-center rounded-xl border border-dashed border-hairline-strong bg-surface-2/40 px-6 text-center">
          <div>
            <p className="text-[13.5px] font-medium text-ink-muted">
              Collecting data — first snapshots arrive within the hour.
            </p>
            {(latestViews != null || latestWatchers != null) && (
              <p className="mt-1 font-mono text-[11px] text-ink-faint tnum">
                so far: {latestViews ?? 0} views · {latestWatchers ?? 0} watchers
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
