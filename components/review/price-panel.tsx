import { Card, Eyebrow, Pill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { CompRow } from '@/lib/sample-listing';

export function PricePanel({
  price,
  compLow,
  compHigh,
  comps,
}: {
  price: number;
  compLow: number;
  compHigh: number;
  comps: CompRow[];
}) {
  const min = compLow;
  const max = compHigh;
  const span = Math.max(1, max - min);
  const pct = (v: number) => Math.min(98, Math.max(2, ((v - min) / span) * 100));
  const afterFees = Math.round(price * 0.871);

  return (
    <Card className="reveal p-6" style={{ animationDelay: '120ms' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Suggested price</Eyebrow>
          <div className="mt-2.5 flex items-baseline gap-3">
            <span className="font-display text-[42px] font-bold leading-none text-ink tnum">${price}</span>
            <button className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink">
              <Icon.Pencil className="size-3.5" />
              Adjust
            </button>
          </div>
          <div className="mt-2 text-[13px] text-ink-muted tnum">
            ≈ <span className="font-medium text-ink">${afterFees}</span> in your pocket after fees
          </div>
        </div>
        <Pill tone="green" icon={<Icon.Trend className="size-3.5" />}>
          From sold comps
        </Pill>
      </div>

      {/* Confidence strip */}
      <div className="mt-8">
        <div className="relative h-12">
          <div className="absolute inset-x-0 top-8 h-1.5 rounded-full bg-surface-2" />
          <div
            className="absolute top-8 h-1.5 rounded-full"
            style={{
              left: `${pct(comps.reduce((a, c) => Math.min(a, c.price), max))}%`,
              right: `${100 - pct(comps.reduce((a, c) => Math.max(a, c.price), min))}%`,
              background: 'color-mix(in oklab, var(--ebay-green) 30%, var(--surface-2))',
            }}
          />
          {comps.map((c, i) => (
            <span
              key={i}
              title={`Sold $${c.price}`}
              className="absolute top-[29px] size-2.5 -translate-x-1/2 rounded-full ring-2 ring-surface"
              style={{ left: `${pct(c.price)}%`, background: 'var(--ebay-green)' }}
            />
          ))}
          <div
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pct(price)}%` }}
          >
            <span className="whitespace-nowrap rounded-md bg-ink px-2 py-0.5 text-[12px] font-semibold text-paper tnum">
              You · ${price}
            </span>
            <span className="mt-1 h-[26px] w-[2px] rounded-full bg-ink" />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-ink-faint tnum">
          <span>${min} low</span>
          <span className="text-ink-muted">{comps.length} sold · last 90 days</span>
          <span>${max} high</span>
        </div>
      </div>
    </Card>
  );
}
