'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDraftListingId } from '@/lib/actions';
import { Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { listRuns, patchRun, removeRun, hasPendingQuestion, type SavedRun } from './run-store';

function statusOf(run: SavedRun): { label: string; tone: string; pulse: boolean } {
  if (run.listingId) return { label: 'Ready to review', tone: 'var(--ebay-green-deep)', pulse: false };
  if (run.status === 'error') return { label: 'Hit an error', tone: 'var(--ebay-red)', pulse: false };
  if (run.status === 'needs_answer' || hasPendingQuestion(run.events))
    return { label: 'Needs your answer', tone: 'var(--ebay-yellow)', pulse: true };
  return { label: 'Agent working…', tone: 'var(--ebay-blue)', pulse: true };
}

/** Compact tray of agent runs that keep going in the background. Click one to
 *  expand it back to the full run view. */
export function ActiveRuns({ excludeItemId }: { excludeItemId?: string | null }) {
  const router = useRouter();
  const [runs, setRuns] = useState<SavedRun[]>([]);

  // localStorage is client-only — read after mount, then keep fresh.
  useEffect(() => {
    const refresh = () => setRuns(listRuns().filter((r) => r.itemId !== excludeItemId));
    refresh();
    const iv = setInterval(refresh, 4000);
    return () => clearInterval(iv);
  }, [excludeItemId]);

  // Background runs finish server-side even with their view closed — poll the
  // drafts so trays flip to "Ready" without the run being open.
  useEffect(() => {
    const working = runs.filter((r) => !r.listingId && r.status !== 'error');
    if (working.length === 0) return;
    const iv = setInterval(async () => {
      for (const r of working) {
        try {
          const id = await getDraftListingId(r.itemId);
          if (id) patchRun(r.itemId, { status: 'ready', listingId: id });
        } catch {
          /* next tick */
        }
      }
    }, 6000);
    return () => clearInterval(iv);
  }, [runs]);

  if (runs.length === 0) return null;

  return (
    <section className="mx-auto mt-10 max-w-2xl">
      <div className="flex items-center gap-2">
        <Eyebrow>Runs in progress</Eyebrow>
        {runs.some((r) => statusOf(r).label === 'Needs your answer') && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--ebay-red)] px-1 text-[10px] font-bold text-white">
            !
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {runs.map((run) => {
          const s = statusOf(run);
          const thumb = run.previews[0];
          return (
            <div
              key={run.itemId}
              className="group flex w-full items-center gap-3 rounded-2xl border border-hairline bg-surface p-3 text-left shadow-raised transition-all hover:-translate-y-px hover:border-hairline-strong"
            >
              <button
                onClick={() => router.push(run.listingId ? `/listings/${run.listingId}` : `/new?run=${run.itemId}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-hairline bg-surface-2">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon.Photo className="size-5 text-ink-faint" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">
                    {run.notes?.slice(0, 60) || 'Untitled item'}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={{ color: s.tone }}>
                    <span
                      className={`size-1.5 rounded-full ${s.pulse ? 'animate-pulse' : ''}`}
                      style={{ background: s.tone }}
                    />
                    {s.label}
                  </span>
                </span>
                {run.listingId ? (
                  <span className="shrink-0 text-[12.5px] font-semibold" style={{ color: 'var(--ebay-green-deep)' }}>
                    Review <Icon.ChevronRight className="inline size-3.5" />
                  </span>
                ) : (
                  <span className="shrink-0 text-[12.5px] font-medium text-ink-faint group-hover:text-ink-muted">
                    Open <Icon.ChevronRight className="inline size-3.5" />
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  removeRun(run.itemId);
                  setRuns((prev) => prev.filter((r) => r.itemId !== run.itemId));
                }}
                aria-label="Dismiss run"
                title="Dismiss (the run itself keeps its result — find it under Listings)"
                className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink group-hover:opacity-100"
              >
                <span className="text-[16px] leading-none">×</span>
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">
        Runs keep going even if you leave — drafts land in{' '}
        <Link href="/" className="underline underline-offset-2 hover:text-ink">
          your queue
        </Link>{' '}
        either way.
      </p>
    </section>
  );
}
