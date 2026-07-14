'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { importEbayListingsAction, type ImportActionResult } from '@/app/settings/actions';

export function ImportListings() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportActionResult | null>(null);

  function run() {
    setResult(null);
    start(async () => {
      setResult(await importEbayListingsAction());
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-medium text-ink">Import my eBay listings</div>
          <div className="mt-0.5 text-[13px] text-ink-muted">
            Pulls in everything currently live on your account so the agent can manage it
          </div>
        </div>
        <button
          onClick={run}
          disabled={pending}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-white transition-transform hover:-translate-y-px active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--ebay-blue)' }}
        >
          {pending ? 'Importing…' : 'Import now'}
        </button>
      </div>

      {result && (
        <div className="mt-3">
          {result.ok ? (
            <p className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--ebay-green-deep)' }}>
              <Icon.Check className="size-4" />
              {result.imported > 0 ? (
                <>
                  Imported {result.imported} of {result.active} live {result.active === 1 ? 'listing' : 'listings'} —{' '}
                  <Link href="/listings" className="font-medium underline underline-offset-2">
                    see them
                  </Link>
                </>
              ) : result.active === 0 ? (
                'No live listings found on your eBay account.'
              ) : (
                `All ${result.active} live ${result.active === 1 ? 'listing is' : 'listings are'} already tracked.`
              )}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--ebay-red)' }}>
              <Icon.Alert className="size-4" /> {result.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
