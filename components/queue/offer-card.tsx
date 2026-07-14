'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { approveOfferAction, rejectOfferAction } from '@/app/approvals/actions';
import type { PendingOffer } from '@/lib/queries';

export function OfferCard({ offer }: { offer: PendingOffer }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'Something went wrong.');
      else router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>Offer to interested buyers</Eyebrow>
          <div className="mt-1 truncate text-[13px] text-ink-muted">
            on{' '}
            <Link href={`/listings/${offer.listingId}`} className="font-medium text-ink underline-offset-2 hover:underline">
              {offer.listingTitle}
            </Link>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--tint-green)] px-2.5 py-1 text-[11px] font-semibold" style={{ color: 'var(--ebay-green-deep)' }}>
          Offer to approve
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-3 rounded-xl bg-surface-2/60 px-3.5 py-3">
        {offer.listPrice != null && (
          <span className="text-[14px] text-ink-faint line-through tnum">${offer.listPrice}</span>
        )}
        <span className="font-display text-[22px] font-bold text-ink tnum">${offer.offerPrice.toFixed(2)}</span>
        <span className="text-[12px] text-ink-muted tnum">{Math.round(offer.discountPct)}% off to watchers</span>
      </div>

      {offer.message && <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">“{offer.message}”</p>}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--ebay-red)' }}>
          <Icon.Alert className="size-4" /> {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => run(() => approveOfferAction(offer.id))}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-white transition-transform hover:-translate-y-px active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--ebay-green-deep)' }}
        >
          <Icon.Check className="size-4" />
          {pending ? 'Sending…' : 'Approve & send'}
        </button>
        <button
          onClick={() => run(() => rejectOfferAction(offer.id))}
          disabled={pending}
          className="h-10 rounded-full border border-hairline px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </Card>
  );
}
