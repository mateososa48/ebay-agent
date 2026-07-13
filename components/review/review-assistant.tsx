'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEveAgent } from 'eve/react';
import { Icon } from '@/components/ui/icons';
import type { ListingDetail } from '@/lib/sample-listing';

type AnyPart = { type?: string; text?: string; state?: string; toolName?: string };
type AnyMsg = { role?: string; parts?: AnyPart[] };

function textOf(m: AnyMsg): string {
  return (m.parts ?? [])
    .filter((p) => p?.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
}

/** Count completed update_listing tool calls so we can refresh the page after an edit. */
function countUpdates(messages: AnyMsg[]): number {
  let n = 0;
  for (const m of messages) {
    for (const p of m.parts ?? []) {
      const isUpdate = p?.type === 'tool-update_listing' || (p?.type === 'dynamic-tool' && p?.toolName === 'update_listing');
      if (isUpdate && p.state === 'output-available') n++;
    }
  }
  return n;
}

export function ReviewAssistant({ listing, disabled }: { listing: ListingDetail; disabled?: boolean }) {
  const agent = useEveAgent();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = (agent.data?.messages ?? []) as unknown as AnyMsg[];
  const running = agent.status === 'submitted' || agent.status === 'streaming';
  const chat = useMemo(
    () =>
      messages
        .map((m) => ({ role: m.role, text: textOf(m) }))
        .filter((m) => m.text && (m.role === 'user' || m.role === 'assistant')),
    [messages],
  );

  // When the agent finishes an edit, reload the server component so the price/title/
  // description panels reflect the new values.
  const updates = useMemo(() => countUpdates(messages), [messages]);
  const seenUpdates = useRef(0);
  useEffect(() => {
    if (updates > seenUpdates.current) {
      seenUpdates.current = updates;
      router.refresh();
    }
  }, [updates, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat.length, running]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    // Give the agent the current listing so it can answer + edit in place.
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-float transition-transform hover:-translate-y-px active:scale-[0.97]"
        style={{ background: 'var(--ebay-blue)' }}
      >
        <Icon.Sparkle className="size-[18px]" />
        Ask the agent
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-float">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon.Sparkle className="size-4" style={{ color: 'var(--ebay-blue)' }} />
          <span className="font-display text-[15px] font-bold text-ink">Assistant</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid size-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden className="text-[15px] leading-none">✕</span>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {chat.length === 0 && (
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Ask me why the price is what it is, or tell me to change the title, description, price, or item specifics — I&rsquo;ll do it.
          </p>
        )}
        {chat.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-[var(--tint-blue)] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-auto max-w-[92%] whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/90">
              {m.text}
            </div>
          ),
        )}
        {running && <div className="text-[12px] text-ink-faint">thinking…</div>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-2 border-t border-hairline p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask, or tell me to change something…"
          className="flex-1 rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--ebay-blue)]"
        />
        <button
          type="submit"
          disabled={!input.trim() || running}
          aria-label="Send"
          className="grid w-11 place-items-center rounded-xl text-white transition-transform hover:-translate-y-px active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'var(--ebay-blue)' }}
        >
          <Icon.ArrowUpRight className="size-4" />
        </button>
      </form>
    </div>
  );
}
