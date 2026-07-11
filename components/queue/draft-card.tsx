import Link from 'next/link';
import type { QueueDraft } from '@/lib/sample-data';
import { Card, Pill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';

function agoLabel(min: number): string {
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return `${h}h ago`;
}

export function DraftCard({ draft, index }: { draft: QueueDraft; index: number }) {
  const clean = draft.linter.ok && draft.linter.warnings === 0;

  return (
    <Card
      interactive
      className="reveal group flex overflow-hidden"
      style={{ animationDelay: `${index * 70 + 120}ms` }}
    >
      {/* Photo */}
      <Link href={`/listings/${draft.id}`} className="relative block w-[136px] shrink-0 overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={draft.photo}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
      </Link>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 pl-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{draft.sku}</span>
            <span className="text-ink-faint">·</span>
            <span className="text-[12px] text-ink-muted">{draft.category}</span>
          </div>
          <Link href={`/listings/${draft.id}`}>
            <h3 className="mt-1.5 line-clamp-2 font-display text-[16px] font-semibold leading-snug text-ink transition-colors group-hover:text-[var(--ebay-blue)]">
              {draft.title}
            </h3>
          </Link>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Pill tone="neutral">{draft.condition}</Pill>
            {clean ? (
              <Pill tone="green" icon={<Icon.Shield className="size-3.5" />}>
                Passes checks
              </Pill>
            ) : (
              <Pill tone="yellow" icon={<Icon.Alert className="size-3.5" />}>
                {draft.linter.warnings} style {draft.linter.warnings === 1 ? 'note' : 'notes'}
              </Pill>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[12px] text-ink-faint">
          <Icon.Clock className="size-3.5" />
          drafted {agoLabel(draft.agedMinutes)}
        </div>
      </div>

      {/* Price rail */}
      <div className="flex w-[190px] shrink-0 flex-col justify-between gap-3 border-l border-hairline bg-surface-2/40 p-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Suggested</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-display text-[26px] font-bold leading-none text-ink tnum">${draft.price}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[12px] text-ink-muted">
            <Icon.Trend className="size-3.5 text-[var(--ebay-green-deep)]" />
            <span className="tnum">
              ${draft.compLow}–${draft.compHigh}
            </span>
            <span className="text-ink-faint">· {draft.compCount} comps</span>
          </div>
        </div>

        <Link
          href={`/listings/${draft.id}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-paper transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]"
        >
          Review
          <Icon.ChevronRight className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
