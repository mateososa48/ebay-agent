'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RelativeTime } from './time';

const STALE_MS = 8 * 60 * 1000;

/**
 * Data-freshness chip + self-healing refresh. Shows when the metrics were last
 * captured (in the viewer's clock), and if they're stale on arrival, quietly
 * asks the server to take fresh eBay snapshots and re-renders the page.
 * The scheduled poller often lags (GitHub cron is best-effort) — this makes the
 * numbers live whenever you're actually looking at them.
 */
export function Freshness({ lastCapturedAt }: { lastCapturedAt: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'refreshing' | 'done'>('idle');
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const age = lastCapturedAt ? Date.now() - new Date(lastCapturedAt).getTime() : Infinity;
    if (age < STALE_MS) return;
    fired.current = true;
    setState('refreshing');
    fetch('/api/refresh-metrics', { method: 'POST' })
      .then((r) => r.json())
      .then((r: { refreshed?: boolean }) => {
        setState('done');
        if (r.refreshed) router.refresh();
      })
      .catch(() => setState('idle'));
  }, [lastCapturedAt, router]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] text-ink-faint shadow-raised">
      <span
        className={`size-1.5 rounded-full ${state === 'refreshing' ? 'animate-pulse' : ''}`}
        style={{ background: state === 'refreshing' ? 'var(--ebay-yellow)' : 'var(--ebay-green)' }}
      />
      {state === 'refreshing' ? (
        'checking eBay…'
      ) : lastCapturedAt ? (
        <>
          updated <RelativeTime iso={lastCapturedAt} />
        </>
      ) : (
        'first check soon'
      )}
    </span>
  );
}
