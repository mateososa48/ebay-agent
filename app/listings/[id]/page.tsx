import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { Gallery } from '@/components/review/gallery';
import { PricePanel } from '@/components/review/price-panel';
import { ListingBody } from '@/components/review/listing-body';
import { LinterPanel } from '@/components/review/linter-panel';
import { ActionBar } from '@/components/review/action-bar';
import { ReviewAssistant } from '@/components/review/review-assistant';
import { AnalyticsPanel, OffersCard } from '@/components/review/analytics-panel';
import { EngagementChart } from '@/components/review/engagement-chart';
import { MessageThread } from '@/components/review/message-thread';
import { ListingTimeline } from '@/components/review/listing-timeline';
import { Button, Dot, Pill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { notFound } from 'next/navigation';
import { type ListingDetail } from '@/lib/sample-listing';
import { getListingAnalytics, getListingDetail } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [real, analytics] = await Promise.all([
    getListingDetail(id).catch((): ListingDetail | null => null),
    getListingAnalytics(id),
  ]);
  if (!real) notFound();
  const l = real;

  const isSold = l.status === 'sold';
  const isLive = l.status === 'live' || isSold;

  if (!isLive) {
    /* ------------------------- Draft: review layout ------------------------- */
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
            <ReviewAssistant listing={l} disabled={false} />
          </div>

          <div className="space-y-5">
            <PricePanel price={l.price} compLow={l.compLow} compHigh={l.compHigh} comps={l.comps} listingId={l.id} editable />
            <ListingBody listing={l} editable />
            <LinterPanel linter={l.linter} />
            <ActionBar listingId={l.id} price={l.price} status={l.status} ebayListingId={l.ebayListingId} />
          </div>
        </div>
      </AppShell>
    );
  }

  /* ------------------ Live / sold: analytics command center ------------------ */
  const listedIso = analytics.listedAt ?? analytics.series[0]?.capturedAt ?? null;
  const endMs = isSold && analytics.soldAt ? new Date(analytics.soldAt).getTime() : Date.now();
  const days = listedIso ? Math.max(0, Math.floor((endMs - new Date(listedIso).getTime()) / DAY)) : null;
  const salePrice = analytics.salePrice ?? l.price;

  return (
    <AppShell>
      <Link
        href="/listings"
        className="reveal inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <Icon.ChevronRight className="size-4 rotate-180" />
        All listings
      </Link>

      <header className="reveal mt-4" style={{ animationDelay: '40ms' }}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{l.sku}</span>
              <span className="text-ink-faint">·</span>
              <span className="text-[12px] text-ink-muted">{l.category}</span>
            </div>
            <h1 className="mt-2 max-w-3xl font-display text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-ink">
              {l.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isSold ? (
                <Pill tone="green" icon={<Icon.Check className="size-3.5" strokeWidth={2.2} />}>
                  Sold · {money(salePrice)}
                </Pill>
              ) : (
                <Pill tone="green" icon={<Dot tone="green" pulse />}>
                  Live on eBay
                </Pill>
              )}
              <Pill tone="neutral">{l.condition}</Pill>
              <span className="text-[12.5px] text-ink-muted tnum">
                {isSold
                  ? `${analytics.soldAt ? `sold ${fmtDay(analytics.soldAt)}` : 'sold'}${days != null ? ` · ${days} days on the market` : ''}`
                  : days != null
                    ? `day ${days + 1}${listedIso ? ` · listed ${fmtDay(listedIso)}` : ''}`
                    : ''}
              </span>
            </div>
          </div>
          {l.ebayListingId && (
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <a href={`https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noreferrer">
                View on eBay
                <Icon.ArrowUpRight className="size-4" />
              </a>
            </Button>
          )}
        </div>
      </header>

      <div className="mt-6">
        <AnalyticsPanel analytics={analytics} price={l.price} sold={isSold} />
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        <div className="min-w-0 space-y-5">
          <EngagementChart series={analytics.series} />
          <MessageThread messages={analytics.messages} />
          {/* Title/description are locked once on eBay — only the price card stays editable. */}
          <ListingBody listing={l} editable={false} />
        </div>

        <div className="space-y-5">
          <Gallery photos={l.photos} title={l.title} />
          <PricePanel
            price={l.price}
            compLow={l.compLow}
            compHigh={l.compHigh}
            comps={l.comps}
            listingId={l.id}
            editable={!isSold}
          />
          <OffersCard offers={analytics.offers} />
          <ListingTimeline events={analytics.timeline} />
          <ReviewAssistant listing={l} disabled={false} />
        </div>
      </div>
    </AppShell>
  );
}
