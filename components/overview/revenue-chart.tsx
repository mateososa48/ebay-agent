import type { DashboardData } from '@/lib/queries';
import { cn } from '@/lib/ui/cn';
import { fmtMoney, weekLabel } from './format';

/**
 * Hand-rolled SVG weekly revenue bars. Geometry lives in a 100x40 viewBox
 * stretched to fit (preserveAspectRatio="none"); hairline gridlines use
 * non-scaling strokes and all text stays in HTML so nothing distorts.
 */
export function RevenueChart({
  data,
  className,
}: {
  data: DashboardData['salesByWeek'];
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const sales = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...data.map((d) => d.revenue), 0);
  const n = data.length;
  const slot = n > 0 ? 100 / n : 0;
  const barW = Math.min(slot * 0.6, 8);
  const first = data[0];
  const last = data[n - 1];

  return (
    <section className={cn('flex flex-col rounded-2xl border border-hairline bg-surface p-4 shadow-raised', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Revenue · weekly</span>
        {n > 0 && (
          <span className="text-[12px] text-ink-muted">
            <span className="tnum font-display text-[15px] font-bold text-ink">{fmtMoney(total)}</span>
            {' · '}
            <span className="tnum">
              {sales} sale{sales === 1 ? '' : 's'}
            </span>
          </span>
        )}
      </div>

      {n === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <p className="max-w-[260px] text-[13px] leading-relaxed text-ink-muted">
            No sales recorded yet — revenue lands here as items sell.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mt-3">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-[150px] w-full" aria-hidden="true">
              <line x1="0" y1="2" x2="100" y2="2" stroke="var(--hairline)" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="19" x2="100" y2="19" stroke="var(--hairline)" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="36" x2="100" y2="36" stroke="var(--hairline-strong)" vectorEffect="non-scaling-stroke" />
              {data.map((d, i) => {
                const h = max > 0 ? Math.max((d.revenue / max) * 34, d.revenue > 0 ? 1 : 0) : 0;
                return (
                  <rect
                    key={d.week}
                    x={i * slot + (slot - barW) / 2}
                    y={36 - h}
                    width={barW}
                    height={h}
                    fill="var(--ebay-green)"
                    className="transition-opacity duration-150 hover:opacity-75"
                  >
                    <title>
                      {`Week of ${weekLabel(d.week)} — ${fmtMoney(d.revenue)} · ${d.count} sale${d.count === 1 ? '' : 's'}`}
                    </title>
                  </rect>
                );
              })}
            </svg>
            <span className="tnum pointer-events-none absolute right-0 top-[7px] -translate-y-1/2 bg-surface pl-1.5 font-mono text-[9px] leading-none text-ink-faint">
              {fmtMoney(max)}
            </span>
            <span className="tnum pointer-events-none absolute right-0 top-[71px] -translate-y-1/2 bg-surface pl-1.5 font-mono text-[9px] leading-none text-ink-faint">
              {fmtMoney(max / 2)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-ink-faint">
            {first && <span>{weekLabel(first.week)}</span>}
            {n > 1 && last && <span>{weekLabel(last.week)}</span>}
          </div>
        </>
      )}
    </section>
  );
}
