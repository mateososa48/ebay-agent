import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { Pill } from '@/components/ui/primitives';
import type { DashboardData } from '@/lib/queries';
import { cn } from '@/lib/ui/cn';
import { fmtInt } from './format';
import { Sparkline } from './sparkline';

type Row = DashboardData['liveListings'][number];

const HEAD = 'px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint';
const CELL = 'tnum px-3 py-1.5 text-right font-mono text-[12px] text-ink-muted';

function Num({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-faint">—</span>;
  return <>{fmtInt(value)}</>;
}

/** Live-listings performance table — the centerpiece of the Overview page. */
export function OverviewListingsTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-hairline-strong bg-surface-2/40 px-6 py-14 text-center">
        <Icon.Box className="size-6 text-ink-faint" />
        <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-ink-muted">
          No live listings yet — publish a draft or import from eBay in{' '}
          <Link href="/settings" className="font-medium text-[var(--ebay-blue)] transition-colors hover:text-ink">
            Settings
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse">
          <colgroup>
            <col />
            <col className="w-[86px]" />
            <col className="w-[88px]" />
            <col className="w-[82px]" />
            <col className="w-[60px]" />
            <col className="w-[92px]" />
            <col className="w-[116px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-hairline">
              <th className={cn(HEAD, 'pl-4 text-left')}>Listing</th>
              <th className={cn(HEAD, 'text-right')}>Price</th>
              <th className={cn(HEAD, 'text-right')}>Watchers</th>
              <th className={cn(HEAD, 'text-right')}>Days live</th>
              <th className={cn(HEAD, 'text-right')}>Msgs</th>
              <th className={cn(HEAD, 'text-left')}>Offer</th>
              <th className={cn(HEAD, 'pr-4 text-right')}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="group h-11 border-b border-hairline transition-colors duration-150 last:border-0 hover:bg-surface-2/50"
              >
                <td className="py-1.5 pl-4 pr-3">
                  <Link href={`/listings/${r.id}`} className="flex min-w-0 items-center gap-2.5">
                    <span className="size-[30px] shrink-0 overflow-hidden rounded-md bg-surface-2">
                      {r.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full place-items-center text-ink-faint">
                          <Icon.Photo className="size-3.5" />
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[13px] font-medium text-ink transition-colors group-hover:text-[var(--ebay-blue)]">
                      {r.title}
                    </span>
                  </Link>
                </td>
                <td className={cn(CELL, 'font-sans text-[13px] font-semibold text-ink')}>
                  {r.price == null ? <span className="font-normal text-ink-faint">—</span> : `$${fmtInt(r.price)}`}
                </td>
                <td className={cn(CELL, 'font-semibold text-ink')}>
                  <Num value={r.watchers} />
                </td>
                <td className={CELL}>{r.daysLive}d</td>
                <td className={CELL}>
                  {r.openMessages > 0 ? (
                    <span className="font-semibold text-[var(--ebay-blue)]">{r.openMessages}</span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {r.offerStatus === 'drafted' ? (
                    <Pill tone="yellow" className="px-2 py-0.5 text-[11px]">
                      Drafted
                    </Pill>
                  ) : r.offerStatus === 'sent' ? (
                    <Pill tone="blue" className="px-2 py-0.5 text-[11px]">
                      Sent
                    </Pill>
                  ) : (
                    <span className="font-mono text-[11px] text-ink-faint">—</span>
                  )}
                </td>
                <td className="py-1.5 pl-3 pr-4">
                  <div className="flex justify-end">
                    <Sparkline series={r.watchSeries} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
