import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { ActivityList } from '@/components/overview/activity-list';
import { AttentionList } from '@/components/overview/attention-list';
import { OverviewListingsTable } from '@/components/overview/listings-table';
import { RevenueChart } from '@/components/overview/revenue-chart';
import { StatStrip } from '@/components/overview/stat-strip';
import { Icon } from '@/components/ui/icons';
import { Eyebrow } from '@/components/ui/primitives';
import { Freshness } from '@/components/ui/freshness';
import { getDashboardData, type DashboardData } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const EMPTY: DashboardData = {
  stats: { live: 0, sold: 0, revenue: 0, queuedValue: 0, pendingApprovals: 0, totalWatchers: 0, offersSent: 0, lastSnapshotAt: null },
  liveListings: [],
  salesByWeek: [],
  attention: [],
  activity: [],
};

function SectionHead({
  title,
  sub,
  href,
  linkLabel,
  count,
}: {
  title: string;
  sub?: string;
  href?: string;
  linkLabel?: string;
  count?: number;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {title}
          {count !== undefined && count > 0 && <span className="tnum text-ink-faint"> · {count}</span>}
        </h2>
        {sub && <p className="mt-0.5 text-[12px] text-ink-muted">{sub}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {linkLabel}
          <Icon.ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

export default async function OverviewPage() {
  let data = EMPTY;
  try {
    data = await getDashboardData(Date.now());
  } catch {
    /* every block degrades to its empty state */
  }

  // "This week" delta for the revenue KPI — only if the latest bucket is current.
  const lastWeek = data.salesByWeek[data.salesByWeek.length - 1];
  const revenueThisWeek =
    lastWeek && Date.now() - new Date(lastWeek.week).getTime() < 8 * 86400_000 ? lastWeek.revenue : 0;

  return (
    <AppShell>
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Command center</Eyebrow>
          <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] text-ink">
            Overview
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
            Everything the desk is doing — sales, demand, and what&rsquo;s waiting on you.
          </p>
        </div>
        <Freshness lastCapturedAt={data.stats.lastSnapshotAt} />
      </header>

      <div className="reveal mt-6" style={{ animationDelay: '60ms' }}>
        <StatStrip stats={data.stats} revenueThisWeek={revenueThisWeek} />
      </div>

      <div className="reveal mt-4 grid gap-4 lg:grid-cols-5" style={{ animationDelay: '110ms' }}>
        <RevenueChart data={data.salesByWeek} className="lg:col-span-3" />
        <AttentionList items={data.attention} className="lg:col-span-2" />
      </div>

      <section className="reveal mt-7" style={{ animationDelay: '160ms' }}>
        <SectionHead
          title="Live listings"
          sub="Sorted by watchers — your demand signal."
          href="/listings"
          linkLabel="All listings"
          count={data.liveListings.length}
        />
        <div className="mt-3">
          <OverviewListingsTable rows={data.liveListings} />
        </div>
      </section>

      <section className="reveal mt-7" style={{ animationDelay: '210ms' }}>
        <SectionHead title="Recent activity" sub="What your agent has been up to." />
        <div className="mt-3">
          <ActivityList items={data.activity} />
        </div>
      </section>
    </AppShell>
  );
}
