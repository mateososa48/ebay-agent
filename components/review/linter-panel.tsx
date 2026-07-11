import { Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { ListingDetail } from '@/lib/sample-listing';

export function LinterPanel({ linter }: { linter: ListingDetail['linter'] }) {
  const clean = linter.warnings.length === 0;

  return (
    <Card className="reveal p-6" style={{ animationDelay: '210ms' }}>
      <div className="flex items-center gap-3">
        <span
          className="grid size-10 place-items-center rounded-full"
          style={{ background: 'var(--tint-green)', color: 'var(--ebay-green-deep)' }}
        >
          <Icon.Shield className="size-5" />
        </span>
        <div>
          <div className="font-display text-[16px] font-semibold text-ink">Compliance &amp; voice</div>
          <div className="text-[13px] text-ink-muted">
            {clean ? 'Clean — nothing that would trip eBay or read as AI' : `${linter.warnings.length} style notes to consider`}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {linter.compliance.map((c) => (
          <div key={c} className="flex items-center gap-2.5 text-[13px] text-ink">
            <span
              className="grid size-[18px] shrink-0 place-items-center rounded-full"
              style={{ background: 'var(--tint-green)' }}
            >
              <Icon.Check className="size-3" strokeWidth={2.4} style={{ color: 'var(--ebay-green-deep)' }} />
            </span>
            {c}
          </div>
        ))}
      </div>

      {!clean && (
        <ul className="mt-5 space-y-2.5 border-t border-hairline pt-5">
          {linter.warnings.map((w) => (
            <li key={w.code} className="flex items-start gap-2.5 text-[13px]">
              <Icon.Alert className="mt-px size-4 shrink-0" style={{ color: 'var(--ebay-yellow)' }} />
              <span className="text-ink-muted">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">{w.code}</span>{' '}
                — {w.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
