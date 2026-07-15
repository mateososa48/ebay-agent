'use client';

import { useEffect, useState } from 'react';
import { NewItemFlow } from './new-item-flow';
import { ActiveRuns } from './active-runs';

/**
 * Mount-gate for the New Item flow. Run resumption reads localStorage, and the
 * eve hook consumes its options exactly once, on first render — so that first
 * render must happen on the CLIENT with storage available. Server-side we
 * render nothing; after mount, the flow gets its saved events on frame one.
 */
export function NewItemClient({ runId }: { runId?: string }) {
  const [mounted, setMounted] = useState(false);
  // A run started on this very page (no ?run= in the URL yet) must not also
  // appear in the tray below it.
  const [startedItemId, setStartedItemId] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="mx-auto max-w-2xl py-24" aria-busy="true" />;
  }
  return (
    <>
      <NewItemFlow key={runId ?? 'new'} resumeItemId={runId} onRunStarted={setStartedItemId} />
      <ActiveRuns excludeItemId={runId ?? startedItemId} />
    </>
  );
}
