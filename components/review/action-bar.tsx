'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { publishListingAction, rejectListingAction } from '@/app/listings/[id]/actions';

type State =
  | { kind: 'idle' }
  | { kind: 'done'; url: string }
  | { kind: 'errors'; errors: string[] };

export function ActionBar({
  listingId, price, status, disabled,
}: { listingId: string; price: number; status: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<State>(
    status === 'live' ? { kind: 'done', url: '' } : { kind: 'idle' },
  );

  const publish = () =>
    start(async () => {
      const r = await publishListingAction(listingId);
      setState(r.ok ? { kind: 'done', url: r.url } : { kind: 'errors', errors: r.errors });
    });
  const reject = () => start(async () => { await rejectListingAction(listingId); });

  const live = state.kind === 'done';

  return (
    <div className="sticky bottom-6 z-20 mt-8" style={{ animationDelay: '260ms' }}>
      {state.kind === 'errors' && (
        <ul className="mb-2 space-y-1 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
          {state.errors.map((e, i) => <li key={i}>· {e}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface/85 px-5 py-3.5 shadow-float backdrop-blur-xl">
        <div className="flex items-center gap-2.5 pl-1">
          {live ? (
            <>
              <span className="text-[13px] text-ink-muted">Live on eBay</span>
              {state.kind === 'done' && state.url && (
                <Link href={state.url} target="_blank" className="font-display text-[15px] font-bold text-ink underline">
                  View listing
                </Link>
              )}
            </>
          ) : (
            <>
              <span className="text-[13px] text-ink-muted">Goes live at</span>
              <span className="font-display text-[19px] font-bold text-ink tnum">${price}</span>
              <span className="ml-1 hidden text-[12px] text-ink-faint sm:inline">· free shipping · 30-day returns</span>
            </>
          )}
        </div>

        {!live && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={reject}
              disabled={pending || disabled}
              className="h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              Send back
            </button>
            <button
              onClick={publish}
              disabled={pending || disabled}
              className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] active:scale-[0.97] disabled:opacity-60"
              style={{
                background: 'var(--ebay-green-deep)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 18px -8px var(--ebay-green-deep)',
              }}
            >
              <Icon.Check className="size-4" strokeWidth={2.4} />
              {pending ? 'Publishing…' : 'Approve & Publish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
