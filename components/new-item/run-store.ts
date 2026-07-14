// Client-side persistence for agent runs, so leaving /new never loses a run.
// eve keeps the run alive server-side; we keep the stream events + session
// cursor here so a remount can re-render history, keep answering questions,
// and keep polling for the saved draft. localStorage only — zero backend.

export type RunStatus = 'working' | 'needs_answer' | 'ready' | 'error';

export interface SavedRun {
  itemId: string;
  sessionId?: string;
  events: unknown[];
  notes?: string;
  previews: string[]; // blob photo URLs for thumbnails
  status: RunStatus;
  listingId?: string;
  startedAt: number;
  updatedAt: number;
}

const PREFIX = 'desk-run:';
const MAX_EVENTS = 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function key(itemId: string): string {
  return `${PREFIX}${itemId}`;
}

export function loadRun(itemId: string): SavedRun | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(itemId));
    return raw ? (JSON.parse(raw) as SavedRun) : null;
  } catch {
    return null;
  }
}

export function saveRun(run: SavedRun): void {
  if (typeof window === 'undefined') return;
  try {
    const capped = run.events.length > MAX_EVENTS ? { ...run, events: run.events.slice(-MAX_EVENTS) } : run;
    localStorage.setItem(key(run.itemId), JSON.stringify({ ...capped, updatedAt: Date.now() }));
  } catch {
    // Quota — drop the event log but keep the run's existence.
    try {
      localStorage.setItem(key(run.itemId), JSON.stringify({ ...run, events: [], updatedAt: Date.now() }));
    } catch {
      /* give up quietly */
    }
  }
}

export function patchRun(itemId: string, patch: Partial<SavedRun>): void {
  const cur = loadRun(itemId);
  if (!cur) return;
  saveRun({ ...cur, ...patch });
}

export function removeRun(itemId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key(itemId));
  } catch {
    /* ignore */
  }
}

export function listRuns(): SavedRun[] {
  if (typeof window === 'undefined') return [];
  const out: SavedRun[] = [];
  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      try {
        const run = JSON.parse(localStorage.getItem(k) ?? 'null') as SavedRun | null;
        if (!run) continue;
        if (now - run.updatedAt > MAX_AGE_MS) {
          localStorage.removeItem(k);
          continue;
        }
        out.push(run);
      } catch {
        /* skip corrupt entry */
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Best-effort: does the saved event log end on an unanswered ask_question?
 *  When the agent asks, the turn pauses right after `input.requested` — so a
 *  request near the tail with no substantial events after it means "waiting on
 *  you". (The full run view derives this precisely from the message reducer;
 *  this powers the tray badge.) */
export function hasPendingQuestion(events: unknown[]): boolean {
  let lastRequest = -1;
  for (let i = 0; i < events.length; i++) {
    if ((events[i] as { type?: string })?.type === 'input.requested') lastRequest = i;
  }
  if (lastRequest === -1) return false;
  return events.length - 1 - lastRequest <= 2; // only boundary events may follow
}
