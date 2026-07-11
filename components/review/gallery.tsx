'use client';

import { useState } from 'react';
import { cn } from '@/lib/ui/cn';

export function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0);

  return (
    <div className="reveal" style={{ animationDelay: '80ms' }}>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-hairline bg-surface-2 shadow-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[active]} alt={title} className="h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] font-medium text-white backdrop-blur-sm tnum">
          {active + 1} / {photos.length}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2.5">
        {photos.map((p, i) => (
          <button
            key={p}
            onClick={() => setActive(i)}
            aria-label={`Photo ${i + 1}`}
            className={cn(
              'relative aspect-square overflow-hidden rounded-xl bg-surface-2 transition-all duration-150',
              i === active
                ? 'ring-2 ring-[var(--ebay-blue)] ring-offset-2 ring-offset-paper'
                : 'opacity-70 ring-1 ring-inset ring-hairline hover:opacity-100',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
