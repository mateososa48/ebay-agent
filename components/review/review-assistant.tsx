'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEveAgent } from 'eve/react';
import { Icon } from '@/components/ui/icons';
import type { ListingDetail } from '@/lib/sample-listing';

type AnyPart = { type?: string; text?: string; state?: string; toolName?: string };
type AnyMsg = { role?: string; parts?: AnyPart[] };

type ToolKind = 'update_listing' | 'update_photos' | 'research';

type Row =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; texts: string[] }
  | { id: string; kind: 'tool'; tool: ToolKind };

/** Map a message part to the tool chip it should render, if any. */
function toolKindOf(p: AnyPart): ToolKind | null {
  const name =
    p?.type === 'dynamic-tool'
      ? p.toolName
      : typeof p?.type === 'string' && p.type.startsWith('tool-')
        ? p.type.slice(5)
        : undefined;
  switch (name) {
    case 'update_listing':
      return 'update_listing';
    case 'update_photos':
      return 'update_photos';
    case 'research_price':
    case 'web_search':
      return 'research';
    default:
      return null;
  }
}

/**
 * Build an ordered chat timeline. Consecutive assistant paragraphs are grouped
 * into a single editorial block; completed tool calls become inline chips that
 * break the group.
 */
function buildRows(messages: AnyMsg[]): Row[] {
  const out: Row[] = [];
  let texts: string[] = [];
  let groupId = '';
  const flush = () => {
    if (texts.length) out.push({ id: groupId, kind: 'assistant', texts });
    texts = [];
  };

  messages.forEach((m, mi) => {
    if (m.role === 'user') {
      flush();
      const text = (m.parts ?? [])
        .filter((p) => p?.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text)
        .join('')
        .trim();
      if (text) out.push({ id: `u${mi}`, kind: 'user', text });
      return;
    }
    if (m.role !== 'assistant') return;
    (m.parts ?? []).forEach((p, pi) => {
      if (p?.type === 'text' && typeof p.text === 'string' && p.text.trim()) {
        if (!texts.length) groupId = `a${mi}-${pi}`;
        texts.push(p.text.trim());
        return;
      }
      const tool = toolKindOf(p);
      if (tool && p?.state === 'output-available') {
        flush();
        out.push({ id: `t${mi}-${pi}`, kind: 'tool', tool });
      }
    });
  });
  flush();
  return out;
}

const CHIP_META: Record<ToolKind, { label: string; Glyph: (typeof Icon)[keyof typeof Icon]; color: string; tint: string }> = {
  update_listing: { label: 'Updated the listing', Glyph: Icon.Check, color: 'var(--ebay-green-deep)', tint: 'var(--tint-green)' },
  update_photos: { label: 'Updated the photos', Glyph: Icon.Photo, color: 'var(--ebay-green-deep)', tint: 'var(--tint-green)' },
  research: { label: 'Researched prices', Glyph: Icon.Trend, color: 'var(--ebay-blue-deep)', tint: 'var(--tint-blue)' },
};

function ToolChip({ tool }: { tool: ToolKind }) {
  const { label, Glyph, color, tint } = CHIP_META[tool];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.09em]"
      style={{ color, background: tint, borderColor: `color-mix(in oklab, ${color} 24%, transparent)` }}
    >
      <Glyph className="size-3" strokeWidth={2.1} />
      {label}
    </span>
  );
}

/** Hairline left accent used by every assistant block — editorial, not bubble. */
function AccentRail({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute bottom-0.5 left-0 top-0.5 w-[2px] rounded-full${pulsing ? ' animate-pulse' : ''}`}
      style={{
        background:
          'linear-gradient(to bottom, color-mix(in oklab, var(--ebay-blue) 55%, transparent), color-mix(in oklab, var(--ebay-blue) 10%, transparent))',
      }}
    />
  );
}

export function ReviewAssistant({ listing, disabled }: { listing: ListingDetail; disabled?: boolean }) {
  const agent = useEveAgent();
  const router = useRouter();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const messages = (agent.data?.messages ?? []) as unknown as AnyMsg[];
  const running = agent.status === 'submitted' || agent.status === 'streaming';
  const rows = useMemo(() => buildRows(messages), [messages]);

  // Refresh the page when the agent finishes an edit so the panels reflect it.
  // Research chips are informational only — they never trigger a refresh.
  const updates = useMemo(() => rows.filter((r) => r.kind === 'tool' && r.tool !== 'research').length, [rows]);
  const seenUpdates = useRef(0);
  useEffect(() => {
    if (updates > seenUpdates.current) {
      seenUpdates.current = updates;
      router.refresh();
    }
  }, [updates, router]);

  // Keep pinned to the latest message, including mid-stream growth.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [rows, running]);

  // Auto-grow the input from a single line up to a cap.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const isLive = listing.status === 'live' || listing.status === 'sold';
  const suggestions = useMemo(() => {
    // On eBay, only the price of a live listing can change — suggest questions
    // and price moves there, and full edits (photos, title, copy) on drafts.
    if (isLive) {
      return ['Why this price?', 'Should I drop the price?', 'How would you sell this faster?', 'What do the comps say now?'];
    }
    const s: string[] = [];
    if (listing.photos.length > 1) s.push('Pick a better cover photo');
    s.push('Why this price?', 'Tighten the title', 'Any risky claims in the description?');
    if (s.length < 4) s.push('Anything missing from the specifics?');
    return s.slice(0, 4);
  }, [listing.photos.length, isLive]);

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || running) return;
    setInput('');
    const context = JSON.stringify({
      listingId: listing.id,
      sku: listing.sku,
      ebayListingId: listing.ebayListingId,
      title: listing.title,
      price: listing.price,
      condition: listing.condition,
      description: listing.description,
      itemSpecifics: listing.specifics,
      photos: listing.photos,
      compRange: { low: listing.compLow, high: listing.compHigh, count: listing.comps.length },
    });
    await agent.send({ message: text, clientContext: context });
  }

  if (disabled) return null;

  const empty = rows.length === 0 && !running;
  const lastRow = rows[rows.length - 1];
  const showTyping = running && (!lastRow || lastRow.kind !== 'assistant');
  const statusLabel = running ? (agent.status === 'streaming' ? 'Writing…' : 'Thinking…') : 'Ready';

  return (
    <div
      className="reveal flex max-h-[560px] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised"
      style={{ animationDelay: '180ms' }}
    >
      {/* Header — identity + live status, glass gradient edge, shimmer while running */}
      <div className="relative shrink-0 border-b border-hairline">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, color-mix(in oklab, var(--ebay-blue) 32%, transparent), transparent)',
          }}
        />
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--tint-blue) 55%, transparent), transparent 92%)' }}
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline shadow-raised"
            style={{
              background:
                'radial-gradient(130% 130% at 28% 22%, color-mix(in oklab, var(--ebay-blue) 28%, var(--surface)), var(--tint-blue) 52%, var(--surface))',
            }}
          >
            <Icon.Sparkle className="size-4" style={{ color: 'var(--ebay-blue)' }} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-display text-[13.5px] font-bold tracking-[-0.01em] text-ink">Listing agent</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span className="relative flex size-1.5 shrink-0">
                {running && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full"
                    style={{ background: 'var(--ebay-blue)', opacity: 0.4 }}
                  />
                )}
                <span
                  className="relative size-1.5 rounded-full"
                  style={{ background: running ? 'var(--ebay-blue)' : 'var(--ebay-green)' }}
                />
              </span>
              <span className="truncate">{statusLabel}</span>
            </div>
          </div>
          <span className="hidden rounded-md border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] tracking-[0.05em] text-ink-faint sm:inline-block">
            {listing.sku}
          </span>
        </div>
        {running && (
          <div aria-hidden className="absolute inset-x-0 -bottom-px flex h-[2px]">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="h-full flex-1 animate-pulse"
                style={{
                  background: 'color-mix(in oklab, var(--ebay-blue) 55%, transparent)',
                  animationDelay: `${i * 110}ms`,
                  animationDuration: '1.4s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4"
        style={{ scrollbarWidth: 'thin' }}
      >
        {empty ? (
          <div className="pt-1">
            <div className="relative max-w-[94%] pl-3.5">
              <AccentRail />
              <p className="text-[13.5px] leading-relaxed text-ink/90">
                Ask about the price, or tell me what to change — title, price, photos, description, specifics. Edits land
                on this page right away.
              </p>
            </div>
            <div className="mt-4 pl-3.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">Try</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendText(s)}
                    className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-muted shadow-raised transition-[transform,color,background-color,border-color] duration-150 hover:-translate-y-px hover:bg-tint-blue hover:text-ink active:translate-y-0 active:scale-[0.98]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          rows.map((r) => {
            if (r.kind === 'user') {
              return (
                <div key={r.id} className="flex justify-end">
                  <div
                    className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-[6px] px-3.5 py-2 text-[13px] leading-relaxed text-white shadow-raised"
                    style={{ background: 'var(--ebay-blue)' }}
                  >
                    {r.text}
                  </div>
                </div>
              );
            }
            if (r.kind === 'tool') {
              return (
                <div key={r.id} className="py-0.5 pl-3.5">
                  <ToolChip tool={r.tool} />
                </div>
              );
            }
            return (
              <div key={r.id} className="relative max-w-[94%] pl-3.5">
                <AccentRail />
                <div className="space-y-2.5">
                  {r.texts.map((t, i) => (
                    <p key={i} className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/90">
                      {t}
                    </p>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {showTyping && (
          <div className="relative pl-3.5">
            <AccentRail pulsing />
            <div className="flex h-5 items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-ink-faint"
                  style={{ animationDelay: `${i * 140}ms`, animationDuration: '0.9s' }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-hairline bg-surface-2/40 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendText(input);
          }}
          className="rounded-2xl border border-hairline bg-surface shadow-raised transition-[border-color,box-shadow] duration-150 focus-within:border-[color:var(--ebay-blue)] focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ebay-blue)_15%,transparent)]"
        >
          <div className="flex items-end gap-2 py-2 pl-3.5 pr-2">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendText(input);
                }
              }}
              placeholder={running ? 'Working on it…' : 'Ask, or tell me to change something…'}
              disabled={running}
              className="max-h-[120px] flex-1 resize-none bg-transparent py-1 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || running}
              aria-label={running ? 'Agent is working' : 'Send message'}
              className="grid size-8 shrink-0 place-items-center rounded-full transition-[background-color,color,transform,opacity] duration-150 hover:enabled:-translate-y-px active:enabled:scale-95 disabled:cursor-not-allowed"
              style={
                running
                  ? {
                      background: 'var(--surface-2)',
                      color: 'var(--ink-faint)',
                      boxShadow: 'inset 0 0 0 1px var(--hairline-strong)',
                    }
                  : { background: 'var(--ebay-blue)', color: '#fff', opacity: input.trim() ? 1 : 0.4 }
              }
            >
              {running ? (
                <span className="size-2.5 rounded-[3px] bg-current" />
              ) : (
                <Icon.ArrowUpRight className="size-4" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </form>
        <p className="mt-1.5 px-1 text-[11px] text-ink-faint">
          Enter to send · Shift+Enter for a new line · edits update the page live
        </p>
      </div>
    </div>
  );
}
