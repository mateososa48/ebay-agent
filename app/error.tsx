'use client';

import { useEffect } from 'react';

// Route-segment error boundary. Catches any render/hydration error under app/ and shows
// a friendly retry instead of Next's raw "Application error" white screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Something went sideways</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          This page hit an unexpected error. Your data is safe — nothing was lost. Try again, or head back to your queue.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="h-11 rounded-full px-6 text-[14px] font-semibold text-white transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] active:scale-[0.99]"
            style={{ background: 'var(--ebay-blue)' }}
          >
            Try again
          </button>
          <a
            href="/"
            className="h-11 rounded-full border border-hairline px-6 text-[14px] font-medium leading-[44px] text-ink-muted transition-colors hover:text-ink"
          >
            Back to queue
          </a>
        </div>
      </div>
    </main>
  );
}
