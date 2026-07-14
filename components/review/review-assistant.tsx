'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEveAgent } from 'eve/react';
import { Icon } from '@/components/ui/icons';
import type { ListingDetail } from '@/lib/sample-listing';

type AnyPart = { type?: string; text?: string; state?: string; toolName?: string };
type AnyMsg = { role?: string; parts?: AnyPart[] };

type Row =
  | { id: string; kind: 'user' | 'assistant'; text: string }
  | { id: string; kind: 'tool'; text: string };

const SUGGESTIONS = [
  'Why is it priced here?',
  'Make the title punchier',
  'Shorten the description',
  'Is the condition right?',
];

function isUpdatePart(p: AnyPart): boolean {
  return p?.type === 'tool-update_listing' || (p?.type === 'dynamic-tool' && p?.toolName === 'update_listing');
}

/** Build an ordered chat timeline: user + assistant text, with inline chips when the agent edits the listing. */
function buildRows(messages: AnyMsg[]): Row[] {
  const out: Row[] = [];
  messages.forEach((m, mi) => {
    if (m.role === 'user') {
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
        out.push({ id: `a${mi}-${pi}`, kind: 'assistant', text: p.text.trim() });
      } else if (isUpdatePart(p) && p.state === 'output-available') {
        out.push({ id: `t${mi}-${pi}`, kind: 'tool', text: 'Updated the listing' });
      }
    });
  });
  return out;
}

function AgentAvatar() {
  return (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full shadow-raised"
      style={{ background: 'linear-gradient(140deg, var(--tint-blue), color-mix(in oklab, var(--ebay-blue) 22%, var(--surface)))' }}
    >
      <Icon.Sparkle className="size-[15px]" style={{ color: 'var(--ebay-blue)' }} />
    </span>
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
  const updates = useMemo(() => rows.filter((r) => r.kind === 'tool').length, [rows]);
  const seenUpdates = useRef(0);
  useEffect(() => {
    if (updates > seenUpdates.current) {
      seenUpdates.current = updates;
      router.refresh();
    }
  }, [updates, router]);

  // Keep pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [rows.length, running]);

  // Auto-grow the input from a single line up to a cap.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || running) return;
    setInput('');
    const context = JSON.stringify({
      listingId: listing.id,
      title: listing.title,
      price: listing.price,
      condition: listing.condition,
      description: listing.description,
      itemSpecifics: listing.specifics,
      compRange: { low: listing.compLow, high: listing.compHigh, count: listing.comps.length },
    });
    await agent.send({ message: text, clientContext: context });
  }

  if (disabled) return null;

  const empty = rows.length === 0 && !running;

  return (
    <div className="reveal flex max-h-[520px] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised" style={{ animationDelay: '180ms' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-hairline bg-surface-2/40 px-4 py-3">
        <AgentAvatar />
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[14px] font-bold text-ink">Ask the agent</div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span
              className="size-1.5 rounded-full"
              style={{ background: running ? 'var(--ebay-blue)' : 'var(--ebay-green)' }}
            />
            {running ? 'Working…' : 'Ready to help with this listing'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'thin' }}>
        {empty ? (
          <div className="pt-1">
            <div className="flex gap-2.5">
              <AgentAvatar />
              <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface-2/70 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink/90">
                Ask me why it&rsquo;s priced this way, or tell me to change the title, price, description, or specifics — I&rsquo;ll do it and update the page.
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 pl-[38px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void sendText(s)}
                  className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-all hover:-translate-y-px hover:border-hairline-strong hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          rows.map((r) => {
            if (r.kind === 'user') {
              return (
                <div key={r.id} className="flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white" style={{ background: 'var(--ebay-blue)' }}>
                    {r.text}
                  </div>
                </div>
              );
            }
            if (r.kind === 'tool') {
              return (
                <div key={r.id} className="flex items-center gap-2 pl-[38px] text-[12px] font-medium" style={{ color: 'var(--ebay-green-deep)' }}>
                  <span className="grid size-4 place-items-center rounded-full" style={{ background: 'var(--tint-green)' }}>
                    <Icon.Check className="size-3" />
                  </span>
                  {r.text}
                </div>
              );
            }
            return (
              <div key={r.id} className="flex gap-2.5">
                <AgentAvatar />
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-surface-2/70 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink/90">
                  {r.text}
                </div>
              </div>
            );
          })
        )}

        {running && (
          <div className="flex gap-2.5">
            <AgentAvatar />
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-surface-2/70 px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-ink-faint"
                  style={{ animationDelay: `${i * 140}ms`, animationDuration: '1s' }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-hairline p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendText(input);
          }}
          className="flex items-end gap-2 rounded-2xl border border-hairline bg-surface-2 px-3 py-2 transition-colors focus-within:border-[var(--ebay-blue)]"
        >
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
            placeholder={running ? 'The agent is working…' : 'Ask, or tell me to change something…'}
            disabled={running}
            className="max-h-[120px] flex-1 resize-none bg-transparent py-1 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || running}
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-white transition-all hover:-translate-y-px active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--ebay-blue)' }}
          >
            <Icon.ArrowUpRight className="size-[17px]" />
          </button>
        </form>
        <p className="mt-1.5 px-1 text-[11px] text-ink-faint">
          Enter to send · Shift+Enter for a new line · edits update the page live
        </p>
      </div>
    </div>
  );
}
