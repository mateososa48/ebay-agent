'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useEveAgent } from 'eve/react';
import type { UserContent } from 'ai';
import { upload } from '@vercel/blob/client';
import { createItemAction, getDraftListingId } from '@/lib/actions';
import { Dropzone } from './dropzone';
import { Pipeline, type PipeStep, type StepState } from './pipeline';
import { Button, Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';

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

export function NewItemFlow() {
  const agent = useEveAgent();
  const [phase, setPhase] = useState<'upload' | 'working'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [polledListingId, setPolledListingId] = useState<string | null>(null);

  const messages = (agent.data?.messages ?? []) as unknown as AnyMsg[];
  const running = agent.status === 'submitted' || agent.status === 'streaming';
  const question = useMemo(() => pendingQuestion(messages), [messages]);

  async function submitAnswer(optionId?: string) {
    if (!question) return;
    const text = answerText.trim() || undefined;
    setAnswerText('');
    await agent.send({ inputResponses: [{ requestId: question.requestId, optionId, text }] });
  }

  // Keep the seller's note across an accidental refresh/navigation.
  useEffect(() => {
    const saved = sessionStorage.getItem('new-item-notes');
    if (saved) setNotes(saved);
  }, []);
  useEffect(() => {
    sessionStorage.setItem('new-item-notes', notes);
  }, [notes]);

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
    if (phase !== 'working' || !itemId || resolvedListingId) return;
    let active = true;
    const iv = setInterval(async () => {
      const id = await getDraftListingId(itemId);
      if (active && id) {
        setPolledListingId(id);
        clearInterval(iv);
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [phase, itemId, resolvedListingId]);

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
        const res = await upload(f.name, f, { access: 'public', handleUploadUrl: '/api/blob-upload' });
        uploaded.push({ url: res.url, mediaType: f.type || 'image/jpeg' });
      }
      const urls = uploaded.map((u) => u.url);
      const { itemId: newItemId } = await createItemAction({ photos: urls, notes });
      setItemId(newItemId);
      setPhase('working');
      const kickoff =
        `Prepare an eBay listing for the item with itemId "${newItemId}". Use that exact itemId in every tool call. ` +
        `The seller's photos are attached — look at them closely. ` +
        (notes.trim() ? `The seller's notes: "${notes.trim()}". ` : `The seller left no notes. `) +
        `Follow your instructions step by step.`;
      // Hand the model the actual photos (vision) + the notes, not just the itemId.
      // Cap the images sent to the model — a dozen full-res photos bloats the
      // vision context and is what stalled the heavier run; 8 is plenty to identify.
      const content: UserContent = [
        { type: 'text', text: kickoff },
        ...uploaded.slice(0, 8).map((u) => ({ type: 'file' as const, data: u.url, mediaType: u.mediaType })),
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

        {agent.status === 'error' && (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-[var(--tint-red)] px-4 py-3 text-[13px]" style={{ color: 'var(--ebay-red)' }}>
            <Icon.Alert className="size-4" />
            {agent.error?.message ?? 'The agent hit an error. Try again.'}
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
