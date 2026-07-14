import type { DashboardData } from '@/lib/queries';
import { fmtInt, fmtMoney } from './format';

/**
 * Six compact KPI cells with hairline dividers. The -ml/-mt px trick pushes
 * the first row/column cell borders under the wrapper edge so wrapping stays
 * clean at every breakpoint.
 */
export function StatStrip({
  stats,
  revenueThisWeek = 0,
}: {
  stats: DashboardData['stats'];
  revenueThisWeek?: number;
}) {
  const cells: { label: string; value: string; sub: string; accent?: string }[] = [
    { label: 'Live', value: fmtInt(stats.live), sub: 'on eBay now' },
    { label: 'Watchers', value: fmtInt(stats.totalWatchers), sub: 'across live listings' },
    { label: 'Offers sent', value: fmtInt(stats.offersSent), sub: 'to interested buyers' },
    { label: 'Sold', value: fmtInt(stats.sold), sub: 'all time' },
    {
      label: 'Revenue',
      value: fmtMoney(stats.revenue),
      sub: revenueThisWeek > 0 ? `${fmtMoney(revenueThisWeek)} this week` : 'all time',
      accent: 'var(--ebay-green-deep)',
    },
    {
      label: 'Awaiting approval',
      value: fmtInt(stats.pendingApprovals),
      sub: stats.queuedValue > 0 ? `${fmtMoney(stats.queuedValue)} queued` : 'nothing queued',
      accent: stats.pendingApprovals > 0 ? 'var(--ebay-yellow)' : undefined,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised">
      <div className="-ml-px -mt-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="border-l border-t border-hairline px-4 py-3">
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{c.label}</div>
            <div
              className="tnum mt-1.5 font-display text-[22px] font-bold leading-none"
              style={{ color: c.accent ?? 'var(--ink)' }}
            >
              {c.value}
            </div>
            <div className="tnum mt-1 truncate text-[11px] leading-tight text-ink-muted">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
