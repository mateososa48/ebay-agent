'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDraftAction } from '@/app/listings/[id]/actions';

/**
 * Two-step inline delete: first click arms it ("Delete?"), second confirms.
 * Arms disarm themselves after 3s or on blur — no modal, no accidental loss.
 */
export function DeleteDraftButton({
  listingId,
  redirectTo,
  subtle,
}: {
  listingId: string;
  redirectTo?: string;
  subtle?: boolean;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
  }, []);

  function arm() {
    setArmed(true);
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    disarmTimer.current = setTimeout(() => setArmed(false), 3000);
  }

  function confirm() {
    setError(null);
    start(async () => {
      const r = await deleteDraftAction(listingId);
      if (!r.ok) {
        setError(r.error ?? 'Couldn’t delete.');
        setArmed(false);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  if (error) {
    return <span className="text-[12px]" style={{ color: 'var(--ebay-red)' }}>{error}</span>;
  }

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          onClick={confirm}
          disabled={pending}
          className="h-8 rounded-full px-3.5 text-[12.5px] font-semibold text-white transition-transform active:scale-[0.96] disabled:opacity-60"
          style={{ background: 'var(--ebay-red)' }}
        >
          {pending ? 'Deleting…' : 'Delete?'}
        </button>
        <button
          onClick={() => setArmed(false)}
          disabled={pending}
          className="h-8 rounded-full px-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={arm}
      aria-label="Delete draft"
      title="Delete this draft"
      className={
        subtle
          ? 'h-8 rounded-full px-2.5 text-[12.5px] font-medium text-ink-faint transition-colors hover:text-[var(--ebay-red)]'
          : 'grid size-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-[var(--tint-red)] hover:text-[var(--ebay-red)]'
      }
    >
      {subtle ? (
        'Delete draft'
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6m4-6v6M8 7l.6 12.1A2 2 0 0 0 10.6 21h2.8a2 2 0 0 0 2-1.9L16 7M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      )}
    </button>
  );
}
