import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import type { DashboardData } from '@/lib/queries';
import { cn } from '@/lib/ui/cn';

const KIND: Record<'draft' | 'reply' | 'offer', { color: string; label: string }> = {
  draft: { color: 'var(--ebay-yellow)', label: 'Draft' },
  reply: { color: 'var(--ebay-blue)', label: 'Reply' },
  offer: { color: 'var(--ebay-green)', label: 'Offer' },
};

/** "Needs you" — drafted listings, replies, and offers waiting on approval. */
export function AttentionList({
  items,
  className,
}: {
  items: DashboardData['attention'];
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col rounded-2xl border border-hairline bg-surface shadow-raised', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Needs you
          {items.length > 0 && (
            <span className="tnum grid h-4 min-w-4 place-items-center rounded-full bg-[var(--ebay-red)] px-1 font-sans text-[10px] font-semibold normal-case tracking-normal text-white">
              {items.length}
            </span>
          )}
        </span>
        <Link
          href="/"
          className="inline-flex items-center gap-0.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Open queue
          <Icon.ChevronRight className="size-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-4 py-10 text-center">
          <div>
            <Icon.Check className="mx-auto size-5" style={{ color: 'var(--ebay-green-deep)' }} />
            <p className="mt-2 text-[13px] text-ink-muted">Nothing needs you right now.</p>
          </div>
        </div>
      ) : (
        <ul className="max-h-[214px] flex-1 overflow-y-auto p-1.5">
          {items.map((a) => (
            <li key={`${a.kind}-${a.id}`}>
              <Link
                href={a.href}
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-surface-2/70"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: KIND[a.kind].color }}
                  title={KIND[a.kind].label}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-snug text-ink">{a.title}</span>
                  <span className="block truncate text-[11.5px] leading-snug text-ink-muted">{a.detail}</span>
                </span>
                <Icon.ChevronRight className="size-3.5 shrink-0 text-ink-faint transition-colors group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
