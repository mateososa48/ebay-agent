'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { approveReplyAction, rejectReplyAction, updateReplyDraftAction } from '@/app/approvals/actions';
import type { PendingReply } from '@/lib/queries';

export function ReplyCard({ reply }: { reply: PendingReply }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(reply.draftedReply);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'Something went wrong.');
      else router.refresh();
    });
  }

  async function approve() {
    // Persist any edit, then send.
    if (text.trim() !== reply.draftedReply.trim()) {
      const saved = await updateReplyDraftAction(reply.id, text);
      if (!saved.ok) return { ok: false as const, error: 'error' in saved ? saved.error : undefined };
    }
    return approveReplyAction(reply.id);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>Buyer question{reply.sender ? ` · ${reply.sender}` : ''}</Eyebrow>
          {reply.listingTitle && (
            <div className="mt-1 truncate text-[13px] text-ink-muted">
              on{' '}
              {reply.listingId ? (
                <Link href={`/listings/${reply.listingId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                  {reply.listingTitle}
                </Link>
              ) : (
                <span className="font-medium text-ink">{reply.listingTitle}</span>
              )}
            </div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-[var(--tint-blue)] px-2.5 py-1 text-[11px] font-semibold" style={{ color: 'var(--ebay-blue)' }}>
          Reply to approve
        </span>
      </div>

      <p className="mt-3 rounded-xl bg-surface-2/60 px-3.5 py-3 text-[14px] leading-relaxed text-ink/90">
        “{reply.question}”
      </p>

      <div className="mt-3">
        <Eyebrow>Drafted reply — edit before sending</Eyebrow>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          disabled={pending}
          className="mt-2 w-full resize-y rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition-colors focus:border-[var(--ebay-blue)] disabled:opacity-60"
        />
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--ebay-red)' }}>
          <Icon.Alert className="size-4" /> {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => run(approve)}
          disabled={pending || !text.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-white transition-transform hover:-translate-y-px active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--ebay-green-deep)' }}
        >
          <Icon.Check className="size-4" />
          {pending ? 'Sending…' : 'Approve & send'}
        </button>
        <button
          onClick={() => run(() => rejectReplyAction(reply.id))}
          disabled={pending}
          className="h-10 rounded-full border border-hairline px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </Card>
  );
}
