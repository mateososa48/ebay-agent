'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ListingRowView } from '@/lib/queries';
import { Pill, type Tone } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/ui/cn';

const STATUS_TONE: Record<string, Tone> = { draft: 'yellow', live: 'green', sold: 'blue', ended: 'neutral' };
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', live: 'Live', sold: 'Sold', ended: 'Ended' };

const TABS = ['all', 'draft', 'live', 'sold'] as const;
type Tab = (typeof TABS)[number];

function ago(min: number): string {
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.floor(min / 60)}h ago`;
  return `${Math.floor(min / 1440)}d ago`;
}

export function ListingsTable({ rows }: { rows: ListingRowView[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const filtered = tab === 'all' ? rows : rows.filter((r) => r.status === tab);
  const count = (t: Tab) => (t === 'all' ? rows.length : rows.filter((r) => r.status === t).length);

  return (
    <div>
      <div className="reveal inline-flex gap-1 rounded-full border border-hairline bg-surface p-1 shadow-raised" style={{ animationDelay: '60ms' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors',
              tab === t ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink',
            )}
          >
            {t}
            <span className={cn('tnum text-[11px]', tab === t ? 'text-paper/60' : 'text-ink-faint')}>{count(t)}</span>
          </button>
        ))}
      </div>

      <div className="reveal mt-5 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised" style={{ animationDelay: '100ms' }}>
        <div className="grid grid-cols-[1fr_120px_100px_120px_40px] items-center gap-4 border-b border-hairline px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          <span>Item</span>
          <span>Status</span>
          <span className="text-right">Comps</span>
          <span className="text-right">Price</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <Icon.Grid className="size-7 text-ink-faint" />
            <p className="mt-3 text-[14px] text-ink-muted">Nothing here yet.</p>
          </div>
        ) : (
          filtered.map((r) => (
            <Link
              key={r.id}
              href={`/listings/${r.id}`}
              className="group grid grid-cols-[1fr_120px_100px_120px_40px] items-center gap-4 border-b border-hairline px-5 py-3.5 transition-colors last:border-0 hover:bg-surface-2/50"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-ink-faint">
                      <Icon.Photo className="size-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-[14px] font-semibold text-ink transition-colors group-hover:text-[var(--ebay-blue)]">
                    {r.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-faint">
                    <span className="font-mono uppercase tracking-wider">{r.sku}</span>
                    <span>·</span>
                    <span>{ago(r.agedMinutes)}</span>
                  </div>
                </div>
              </div>
              <div>
                <Pill tone={STATUS_TONE[r.status] ?? 'neutral'}>{STATUS_LABEL[r.status] ?? r.status}</Pill>
              </div>
              <div className="text-right font-mono text-[13px] text-ink-muted tnum">{r.compCount}</div>
              <div className="text-right font-display text-[15px] font-bold text-ink tnum">${r.price}</div>
              <Icon.ChevronRight className="size-4 justify-self-end text-ink-faint transition-colors group-hover:text-ink" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
