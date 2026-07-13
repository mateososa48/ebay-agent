import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { DraftCard } from '@/components/queue/draft-card';
import { Button, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { QueueDraft } from '@/lib/sample-data';
import { getQueueDrafts, getListingCounts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex-1 px-6 py-5 first:pl-7">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{label}</div>
      <div className="mt-1.5 font-display text-[28px] font-bold leading-none text-ink tnum" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] text-ink-muted">{sub}</div>}
    </div>
  );
}

export default async function QueuePage() {
  let drafts: QueueDraft[] = [];
  try {
    drafts = await getQueueDrafts(Date.now());
  } catch {
    drafts = [];
  }
  let counts = { live: 0, sold: 0 };
  try {
    counts = await getListingCounts();
  } catch {
    /* ignore */
  }
  const stats = {
    awaiting: drafts.length,
    live: counts.live,
    queuedValue: drafts.reduce((sum, d) => sum + d.price, 0),
    soldThisWeek: counts.sold,
  };

  return (
    <AppShell>
      <header className="reveal flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Your desk</Eyebrow>
          <h1 className="mt-2.5 font-display text-[40px] font-bold leading-[1.0] tracking-[-0.035em] text-ink">
            Review Queue
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-muted">
            Your agent researched, priced, and wrote these. Give them a look — approve, tweak the copy,
            or send one back for another pass.
          </p>
        </div>
        <Button asChild variant="primary" size="lg">
          <Link href="/new">
            <Icon.Plus className="size-[18px]" />
            New item
          </Link>
        </Button>
      </header>

      <div className="reveal mt-8 flex divide-x divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised" style={{ animationDelay: '60ms' }}>
        <Stat label="Awaiting you" value={String(stats.awaiting)} sub="ready to review" accent="var(--ebay-yellow)" />
        <Stat label="Live listings" value={String(stats.live)} sub="active on eBay" />
        <Stat label="Queued value" value={`$${stats.queuedValue}`} sub="if all approved" />
        <Stat label="Sold" value={String(stats.soldThisWeek)} sub="all time" accent="var(--ebay-green-deep)" />
      </div>

      <section className="mt-10">
        <div className="reveal flex items-center justify-between" style={{ animationDelay: '100ms' }}>
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
            Awaiting your approval <span className="text-ink-faint tnum">· {stats.awaiting}</span>
          </h2>
        </div>

        {drafts.length === 0 ? (
          <div className="reveal mt-4 grid place-items-center rounded-2xl border border-dashed border-hairline-strong bg-surface-2/40 px-6 py-16 text-center" style={{ animationDelay: '120ms' }}>
            <div className="grid size-12 place-items-center rounded-2xl bg-surface shadow-raised">
              <Icon.Check className="size-6" style={{ color: 'var(--ebay-green-deep)' }} />
            </div>
            <h3 className="mt-4 font-display text-[18px] font-bold text-ink">All caught up</h3>
            <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-muted">
              Nothing waiting for your review. Drop a new item on the desk and your agent will draft it here.
            </p>
            <div className="mt-5">
              <Button asChild variant="primary" size="md">
                <Link href="/new">
                  <Icon.Plus className="size-[18px]" />
                  New item
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {drafts.map((draft, i) => (
              <DraftCard key={draft.id} draft={draft} index={i} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
