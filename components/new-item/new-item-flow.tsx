'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client, defaultMessageReducer } from 'eve/client';
import type { HandleMessageStreamEvent } from 'eve/client';
import type { UserContent } from 'ai';
import { upload } from '@vercel/blob/client';
import { createItemAction, getDraftListingId } from '@/lib/actions';
import { Dropzone } from './dropzone';
import { Pipeline, type PipeStep, type StepState } from './pipeline';
import { Button, Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { loadRun, saveRun, patchRun } from './run-store';

type AnyPart = { type?: string; toolName?: string; state?: string; output?: unknown; text?: string };
type AnyMsg = { role?: string; parts?: AnyPart[] };

function scanTool(messages: AnyMsg[], tool: string) {
  let started = false;
  let done = false;
  let output: Record<string, unknown> | undefined;
  for (const m of messages) {
    for (const p of m.parts ?? []) {
      const isTool = p?.type === `tool-${tool}` || (p?.type === 'dynamic-tool' && p?.toolName === tool);
      if (!isTool) continue;
      started = true;
      if (p.state === 'output-available') {
        done = true;
        output = (p.output as Record<string, unknown>) ?? undefined;
      }
    }
  }
  return { started, done, output };
}

type InputReq = {
  requestId: string;
  prompt: string;
  display?: 'confirmation' | 'select' | 'text';
  allowFreeform?: boolean;
  options?: readonly { id: string; label: string; description?: string; style?: 'danger' | 'default' | 'primary' }[];
};
type EvePart = AnyPart & { eve?: { inputRequest?: InputReq; inputResponse?: unknown } };

/** The most recent unanswered question the agent raised via ask_question, if any. */
function pendingQuestion(messages: AnyMsg[]): InputReq | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const p of (messages[i]?.parts ?? []) as EvePart[]) {
      if (p.eve?.inputRequest && !p.eve.inputResponse) return p.eve.inputRequest;
    }
  }
  return null;
}

function lastAssistantText(messages: AnyMsg[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'assistant') continue;
    const text = (m.parts ?? [])
      .filter((p) => p?.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim();
    if (text) return text;
  }
  return '';
}

function stepState(started: boolean, done: boolean, prevReady: boolean): StepState {
  if (done) return 'done';
  if (started) return 'active';
  if (prevReady) return 'active';
  return 'pending';
}

// eBay's picture pipeline accepts JPEG/PNG/GIF but rejects HEIC/HEIF/WebP. iPhone camera
// photos are HEIC by default. Re-encode anything that isn't already eBay-safe to JPEG in
// the browser before upload. If the browser can't decode the source (e.g. HEIC in Chrome/
// Firefox), throw so the caller shows a clear message instead of shipping an image eBay
// will reject on the first real publish.
async function toUploadable(file: File): Promise<File> {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/gif') return file;
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('encode failed');
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

export function NewItemFlow({ resumeItemId }: { resumeItemId?: string }) {
  // Resume a background run: restore its persisted stream events + session
  // cursor so history re-renders and pending questions stay answerable.
  // (Read once — useEveAgent only consumes options on first mount; the page
  // keys this component by run so switching runs remounts it.)
  const resumed = useMemo(() => (resumeItemId ? loadRun(resumeItemId) : null), [resumeItemId]);
  const itemIdRef = useRef<string | null>(resumed?.itemId ?? null);
  const resolvedListingIdRef = useRef<string | null>(resumed?.listingId ?? null);

  /* --------------- Run engine: lower-level eve client ---------------
     The run lives SERVER-side; this component is just a viewport onto its
     event stream. The kickoff POST hands back the sessionId immediately, so
     we persist it before a single event streams — and a resumed mount replays
     the whole run from the server (startIndex 0..n) plus the live tail, even
     if the user left the page one second after starting. */
  const clientRef = useRef(new Client({ host: '', preserveCompletedSessions: true }));
  const sessionRef = useRef<ReturnType<Client['session']> | null>(null);
  const pumpingRef = useRef(false);
  const [events, setEvents] = useState<HandleMessageStreamEvent[]>(
    () => (resumed?.events ?? []) as HandleMessageStreamEvent[],
  );
  const [engineStatus, setEngineStatus] = useState<'ready' | 'streaming' | 'error'>('ready');
  const [engineError, setEngineError] = useState<string | null>(null);

  const reducer = useMemo(() => defaultMessageReducer(), []);
  const data = useMemo(() => {
    let acc = reducer.initial();
    for (const e of events) acc = reducer.reduce(acc, e as never);
    return acc;
  }, [events, reducer]);

  // Persist every appended event + keep the tray's status honest.
  useEffect(() => {
    const id = itemIdRef.current;
    if (!id || events.length === 0) return;
    patchRun(id, { events: events as unknown[] });
  }, [events]);

  const pump = useCallback(async (iterable: AsyncIterable<HandleMessageStreamEvent>) => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    setEngineStatus('streaming');
    setEngineError(null);
    try {
      for await (const e of iterable) {
        setEvents((prev) => [...prev, e]);
        const t = (e as { type?: string }).type;
        if (t === 'session.failed' || t === 'turn.failed') {
          setEngineError('The agent hit an error mid-run.');
        }
      }
      setEngineStatus('ready');
    } catch (e) {
      setEngineError((e as Error).message);
      setEngineStatus('error');
    } finally {
      pumpingRef.current = false;
    }
  }, []);

  // Reattach on a resumed mount: replay any events we missed straight from the
  // server, then keep streaming live. No sessionId (pre-fix runs) → can't
  // reattach; the draft poll below still catches a finished run.
  useEffect(() => {
    if (!resumed?.sessionId || sessionRef.current) return;
    const session = clientRef.current.session({
      sessionId: resumed.sessionId,
      streamIndex: resumed.events.length,
    } as never);
    sessionRef.current = session;
    void pump(session.stream({ startIndex: resumed.events.length }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agent = {
    status: engineStatus === 'streaming' ? ('streaming' as const) : engineStatus === 'error' ? ('error' as const) : ('ready' as const),
    error: engineError ? { message: engineError } : null,
    data,
    send: async (input: { message?: UserContent; inputResponses?: unknown[] }) => {
      let session = sessionRef.current;
      if (!session) {
        session = clientRef.current.session();
        sessionRef.current = session;
      }
      const res = await session.send(input as never);
      // sessionId is available the moment the POST returns — persist it before
      // any event arrives so a navigation one second in still resumes fully.
      if (itemIdRef.current && res.sessionId) {
        patchRun(itemIdRef.current, { sessionId: res.sessionId });
      }
      void pump(res);
    },
  };
  const [phase, setPhase] = useState<'upload' | 'working'>(resumed ? 'working' : 'upload');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>(resumed?.previews ?? []);
  const [notes, setNotes] = useState(resumed?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [itemId, setItemId] = useState<string | null>(resumed?.itemId ?? null);
  const [polledListingId, setPolledListingId] = useState<string | null>(resumed?.listingId ?? null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const messages = (agent.data?.messages ?? []) as unknown as AnyMsg[];
  const running = agent.status === 'streaming';
  const question = useMemo(() => pendingQuestion(messages), [messages]);

  async function submitAnswer(optionId?: string) {
    if (!question) return;
    const text = answerText.trim() || undefined;
    setAnswerText('');
    await agent.send({ inputResponses: [{ requestId: question.requestId, optionId, text }] });
  }

  // Keep the seller's note across an accidental refresh/navigation (fresh runs only —
  // a resumed run already carries its own notes).
  useEffect(() => {
    if (resumed) return;
    const saved = sessionStorage.getItem('new-item-notes');
    if (saved) setNotes(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (phase === 'upload') sessionStorage.setItem('new-item-notes', notes);
  }, [notes, phase]);

  // Mirror run state for the background-runs tray.
  useEffect(() => {
    const id = itemIdRef.current;
    if (!id || phase !== 'working') return;
    if (resolvedListingIdRef.current) return;
    patchRun(id, { status: question ? 'needs_answer' : 'working' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, phase]);

  // Warn before leaving with staged photos or an in-flight run (the item isn't saved yet).
  const dirty =
    (phase === 'upload' && (files.length > 0 || notes.trim().length > 0)) ||
    (phase === 'working' && running);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const { steps, listingId, note } = useMemo(() => {
    const identify = scanTool(messages, 'identify_item');
    const price = scanTool(messages, 'research_price');
    const lint = scanTool(messages, 'lint_listing');
    const save = scanTool(messages, 'save_listing_draft');

    const idOut = identify.output as { brand?: string; productType?: string } | undefined;
    const prOut = price.output as { suggested?: number; comps?: unknown[] } | undefined;
    const writeDone = lint.started || lint.done;

    const built: PipeStep[] = [
      {
        key: 'identify',
        label: 'Identifying the item',
        hint: identify.done
          ? [idOut?.brand, idOut?.productType].filter(Boolean).join(' ') || 'Identified'
          : 'Reading your photos and notes',
        tone: 'blue',
        icon: <Icon.Sparkle className="size-[18px]" />,
        state: stepState(identify.started, identify.done, running),
      },
      {
        key: 'price',
        label: 'Researching a price',
        hint: price.done
          ? prOut?.suggested
            ? `$${prOut.suggested} from ${prOut.comps?.length ?? 0} comps`
            : 'Priced from comps'
          : 'Pulling comparable listings + web research',
        tone: 'green',
        icon: <Icon.Trend className="size-[18px]" />,
        state: stepState(price.started, price.done, identify.done && running),
      },
      {
        key: 'write',
        label: 'Writing the listing',
        hint: writeDone ? 'Title, specifics, description written' : 'Drafting in your voice',
        tone: 'yellow',
        icon: <Icon.Pencil className="size-[18px]" />,
        state: writeDone ? 'done' : price.done && running ? 'active' : 'pending',
      },
      {
        key: 'lint',
        label: 'Checking compliance & voice',
        hint: lint.done ? 'Passed the slop-linter' : 'Scanning for policy + AI-slop issues',
        tone: 'green',
        icon: <Icon.Shield className="size-[18px]" />,
        state: lint.done ? 'done' : lint.started ? 'active' : 'pending',
      },
      {
        key: 'save',
        label: 'Adding to your queue',
        hint: save.done ? 'Draft ready to review' : 'Saving the draft',
        tone: 'green',
        icon: <Icon.Check className="size-[18px]" />,
        state: stepState(save.started, save.done, lint.done && running),
      },
    ];

    const lid = (save.output as { listingId?: string } | undefined)?.listingId;
    return { steps: built, listingId: lid, note: lastAssistantText(messages) };
  }, [messages, running]);

  // The draft is saved server-side even if the live stream drops mid-run. Poll for
  // it so the page always shows completion + the Review button.
  const resolvedListingId = listingId ?? polledListingId;
  useEffect(() => {
    if (resolvedListingId && itemIdRef.current) {
      resolvedListingIdRef.current = resolvedListingId;
      patchRun(itemIdRef.current, { status: 'ready', listingId: resolvedListingId });
    }
  }, [resolvedListingId]);
  useEffect(() => {
    if (agent.status === 'error' && itemIdRef.current && !resolvedListingIdRef.current) {
      patchRun(itemIdRef.current, { status: 'error' });
    }
  }, [agent.status]);
  useEffect(() => {
    if (phase !== 'working' || !itemId || resolvedListingId) return;
    if (agent.status === 'error') return; // hard error — stop polling, show the retry state
    let active = true;
    let attempts = 0;
    const iv = setInterval(async () => {
      attempts += 1;
      const id = await getDraftListingId(itemId);
      if (!active) return;
      if (id) {
        setPolledListingId(id);
        resolvedListingIdRef.current = id;
        if (itemIdRef.current) patchRun(itemIdRef.current, { status: 'ready', listingId: id });
        clearInterval(iv);
        return;
      }
      // Cap at ~2 min so a run that ends without ever saving a draft can't poll forever.
      if (attempts >= 40) {
        setPollTimedOut(true);
        clearInterval(iv);
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [phase, itemId, resolvedListingId, agent.status]);

  function addFiles(newFiles: File[]) {
    setFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newFiles.map((f) => URL.createObjectURL(f))]);
  }
  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const uploaded: { url: string; mediaType: string }[] = [];
      for (const f of files) {
        let file: File;
        try {
          file = await toUploadable(f);
        } catch {
          throw new Error(
            `Couldn’t process “${f.name}”. If it’s a HEIC photo, upload a JPG or PNG instead ` +
              `(on iPhone: Settings → Camera → Formats → Most Compatible).`,
          );
        }
        const res = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/blob-upload' });
        uploaded.push({ url: res.url, mediaType: file.type || 'image/jpeg' });
      }
      const urls = uploaded.map((u) => u.url);
      const { itemId: newItemId } = await createItemAction({ photos: urls, notes });
      setItemId(newItemId);
      itemIdRef.current = newItemId;
      // Register the run so it survives navigation (background-runs tray + resume).
      saveRun({
        itemId: newItemId,
        events: [],
        notes: notes.trim() || undefined,
        previews: urls,
        status: 'working',
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
      setPhase('working');
      const kickoff =
        `Prepare an eBay listing for the item with itemId "${newItemId}". Use that exact itemId in every tool call. ` +
        `ALL of the seller's photos are attached, in their current order — study every one (later photos often ` +
        `hold labels, tags, and flaw close-ups), and curate them with update_photos. ` +
        (notes.trim() ? `The seller's notes: "${notes.trim()}". ` : `The seller left no notes. `) +
        `Follow your instructions step by step.`;
      // Hand the model every photo (vision) + the notes. 24 is a generous ceiling
      // that keeps the vision context sane on extreme uploads.
      const content: UserContent = [
        { type: 'text', text: kickoff },
        ...uploaded.slice(0, 24).map((u) => ({ type: 'file' as const, data: u.url, mediaType: u.mediaType })),
      ];
      sessionStorage.removeItem('new-item-notes');
      await agent.send({ message: content });
    } catch (e) {
      setError((e as Error).message);
      setPhase('upload');
    } finally {
      setBusy(false);
    }
  }

  const canStart = (files.length > 0 || notes.trim().length > 0) && !busy;

  if (phase === 'upload') {
    return (
      <div className="reveal mx-auto max-w-2xl">
        <div className="text-center">
          <Eyebrow>New item</Eyebrow>
          <h1 className="mt-2.5 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
            Drop it on the desk
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted">
            Add a few photos and a quick note. Your agent takes it from there — identify, price, write, and
            check — while you watch.
          </p>
        </div>

        <div className="mt-8">
          <Dropzone previews={previews} onAdd={addFiles} onRemove={removeFile} disabled={busy} />
        </div>

        <div className="mt-5">
          <label className="mb-2 block">
            <Eyebrow>What is it? (helps the agent)</Eyebrow>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
            rows={3}
            placeholder="e.g. Levi's 501, men's 34x32, dark wash, small fade at the knee, made in USA"
            className="w-full resize-none rounded-2xl border border-hairline bg-surface px-4 py-3.5 text-[14.5px] leading-relaxed text-ink shadow-raised outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--ebay-blue)]"
          />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--tint-red)] px-4 py-3 text-[13px]" style={{ color: 'var(--ebay-red)' }}>
            <Icon.Alert className="size-4" />
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center">
          <Button variant="primary" size="lg" disabled={!canStart} onClick={start}>
            {busy ? 'Uploading…' : 'Start the agent'}
            <Icon.ArrowUpRight className="size-[18px]" />
          </Button>
        </div>
      </div>
    );
  }

  // Working / done
  return (
    <div className="reveal grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="lg:sticky lg:top-8">
        <Eyebrow>On the desk</Eyebrow>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {previews.length > 0 ? (
            previews.slice(0, 6).map((src, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-xl border border-hairline bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))
          ) : (
            <div className="col-span-3 grid place-items-center rounded-xl border border-hairline bg-surface-2 py-8 text-ink-faint">
              <Icon.Photo className="size-7" />
            </div>
          )}
        </div>
        {notes && <p className="mt-3 rounded-xl bg-surface-2/60 px-3.5 py-3 text-[13px] leading-relaxed text-ink-muted">“{notes}”</p>}
      </div>

      <Card className="p-7">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>{resolvedListingId ? 'Done' : 'Agent at work'}</Eyebrow>
            <h2 className="mt-1.5 font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
              {resolvedListingId ? 'Your draft is ready' : 'Building your listing'}
            </h2>
          </div>
          {!resolvedListingId && running && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tint-blue)] px-3 py-1.5 text-[12px] font-medium" style={{ color: 'var(--ebay-blue)' }}>
              <span className="size-1.5 animate-pulse rounded-full" style={{ background: 'var(--ebay-blue)' }} />
              live
            </span>
          )}
        </div>

        {question && !resolvedListingId && (
          <div className="mt-6 rounded-2xl border border-hairline p-5" style={{ background: 'var(--tint-blue)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ebay-blue)' }}>
              The agent needs a hand
            </span>
            <p className="mt-2 text-[15px] font-medium leading-relaxed text-ink">{question.prompt}</p>
            {question.options && question.options.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-2">
                {question.options.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => submitAnswer(o.id)}
                    className="h-9 rounded-full border border-hairline-strong bg-surface px-4 text-[13px] font-medium text-ink shadow-raised transition-transform hover:-translate-y-px active:scale-[0.97]"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            {(question.allowFreeform || question.display === 'text' || !question.options?.length) && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (answerText.trim()) void submitAnswer();
                }}
              >
                <input
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your answer…"
                  autoFocus
                  className="flex-1 rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--ebay-blue)]"
                />
                <button
                  type="submit"
                  disabled={!answerText.trim()}
                  className="h-[42px] rounded-xl px-4 text-[13.5px] font-semibold text-white transition-transform hover:-translate-y-px active:scale-[0.97] disabled:opacity-50"
                  style={{ background: 'var(--ebay-blue)' }}
                >
                  Send
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-7">
          <Pipeline steps={steps} />
        </div>

        {note && (
          <div className="mt-6 rounded-xl border border-hairline bg-surface-2/50 p-4">
            <Eyebrow>Agent’s note</Eyebrow>
            <p className="mt-2 text-[14px] leading-relaxed text-ink/90">{note}</p>
          </div>
        )}

        {!resolvedListingId && (agent.status === 'error' || pollTimedOut) && (
          <div className="mt-6 rounded-xl border border-hairline bg-[var(--tint-red)] p-4">
            <div className="flex items-start gap-2 text-[13px]" style={{ color: 'var(--ebay-red)' }}>
              <Icon.Alert className="mt-0.5 size-4 shrink-0" />
              <span>
                {agent.status === 'error'
                  ? agent.error?.message ?? 'The agent hit an error before it finished.'
                  : 'The agent didn’t save a draft — it may have stopped mid-run. Nothing was listed.'}
              </span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 h-9 rounded-full px-4 text-[13px] font-semibold text-white transition-transform active:scale-[0.97]"
              style={{ background: 'var(--ebay-blue)' }}
            >
              Start over
            </button>
          </div>
        )}

        {resolvedListingId && (
          <div className="mt-7 border-t border-hairline pt-6">
            <Button asChild variant="primary" size="lg">
              <Link href={`/listings/${resolvedListingId}`}>
                Review your draft
                <Icon.ChevronRight className="size-[18px]" />
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
