'use client';

import { Icon } from '@/components/ui/icons';

export function ActionBar({ price }: { price: number }) {
  return (
    <div className="sticky bottom-6 z-20 mt-8" style={{ animationDelay: '260ms' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface/85 px-5 py-3.5 shadow-float backdrop-blur-xl">
        <div className="flex items-center gap-2.5 pl-1">
          <span className="text-[13px] text-ink-muted">Goes live at</span>
          <span className="font-display text-[19px] font-bold text-ink tnum">${price}</span>
          <span className="ml-1 hidden text-[12px] text-ink-faint sm:inline">· Trading API · you can edit after</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button className="h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink">
            Send back
          </button>
          <button className="h-10 rounded-full border border-hairline-strong bg-surface px-4 text-[13px] font-medium text-ink shadow-raised transition-transform hover:-translate-y-px active:scale-[0.97]">
            Save draft
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] active:scale-[0.97]"
            style={{
              background: 'var(--ebay-green-deep)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 18px -8px var(--ebay-green-deep)',
            }}
          >
            <Icon.Check className="size-4" strokeWidth={2.4} />
            Approve &amp; Publish
          </button>
        </div>
      </div>
    </div>
  );
}
