import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Gallery } from '@/components/review/gallery';
import { PricePanel } from '@/components/review/price-panel';
import { ListingBody } from '@/components/review/listing-body';
import { LinterPanel } from '@/components/review/linter-panel';
import { ActionBar } from '@/components/review/action-bar';
import { ReviewAssistant } from '@/components/review/review-assistant';
import { Pill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { SAMPLE_LISTING, type ListingDetail } from '@/lib/sample-listing';
import { getListingDetail } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let real: ListingDetail | null = null;
  try {
    real = await getListingDetail(id);
  } catch {
    real = null;
  }
  const l = real ?? SAMPLE_LISTING;

  return (
    <AppShell>
      <Link
        href="/"
        className="reveal inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <Icon.ChevronRight className="size-4 rotate-180" />
        Back to queue
      </Link>

      <header className="reveal mt-4" style={{ animationDelay: '40ms' }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{l.sku}</span>
          <span className="text-ink-faint">·</span>
          <span className="text-[12px] text-ink-muted">{l.category}</span>
        </div>
        <h1 className="mt-2 max-w-3xl font-display text-[30px] font-bold leading-[1.08] tracking-[-0.03em] text-ink">
          {l.title}
        </h1>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <Pill tone="neutral">{l.condition}</Pill>
          <Pill tone="blue" icon={<Icon.Sparkle className="size-3.5" />}>
            Identified · {Math.round(l.confidence * 100)}% sure
          </Pill>
          {l.linter.warnings.length === 0 ? (
            <Pill tone="green" icon={<Icon.Shield className="size-3.5" />}>
              Passes checks
            </Pill>
          ) : (
            <Pill tone="yellow" icon={<Icon.Alert className="size-3.5" />}>
              {l.linter.warnings.length} style {l.linter.warnings.length === 1 ? 'note' : 'notes'}
            </Pill>
          )}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-5">
          <Gallery photos={l.photos} title={l.title} />
          <ReviewAssistant listing={l} disabled={real === null} />
        </div>

        <div className="space-y-5">
          <PricePanel price={l.price} compLow={l.compLow} compHigh={l.compHigh} comps={l.comps} />
          <ListingBody listing={l} />
          <LinterPanel linter={l.linter} />
          <ActionBar
            listingId={l.id}
            price={l.price}
            status={l.status}
            ebayListingId={l.ebayListingId}
            disabled={real === null}
          />
        </div>
      </div>
    </AppShell>
  );
}
