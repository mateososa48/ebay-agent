import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { DraftCard } from '@/components/queue/draft-card';
import { Button, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { SAMPLE_DRAFTS, SAMPLE_STATS } from '@/lib/sample-data';

export const dynamic = 'force-dynamic';

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
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

export default function QueuePage() {
  const s = SAMPLE_STATS;

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

      {/* Stat strip */}
      <div className="reveal mt-8 flex divide-x divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised" style={{ animationDelay: '60ms' }}>
        <Stat label="Awaiting you" value={String(s.awaiting)} sub="ready to review" accent="var(--ebay-yellow)" />
        <Stat label="Live listings" value={String(s.live)} sub="active on eBay" />
        <Stat label="Queued value" value={`$${s.queuedValue}`} sub="if all approved" />
        <Stat label="Sold this week" value={String(s.soldThisWeek)} sub={`$${s.soldValue} total`} accent="var(--ebay-green-deep)" />
      </div>

      {/* Queue */}
      <section className="mt-10">
        <div className="reveal flex items-center justify-between" style={{ animationDelay: '100ms' }}>
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
            Awaiting your approval <span className="text-ink-faint tnum">· {s.awaiting}</span>
          </h2>
          <button className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink">
            <Icon.Sparkle className="size-4 text-[var(--ebay-blue)]" />
            Agent idle
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {SAMPLE_DRAFTS.map((draft, i) => (
            <DraftCard key={draft.id} draft={draft} index={i} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
