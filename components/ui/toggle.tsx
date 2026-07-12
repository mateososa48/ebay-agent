'use client';

import { useState } from 'react';
import { cn } from '@/lib/ui/cn';

export function Toggle({ defaultOn = false, disabled }: { defaultOn?: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => setOn((v) => !v)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-out',
        on ? 'bg-[var(--ebay-green-deep)]' : 'border border-hairline-strong bg-surface-2',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span
        className="absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 23 : 3 }}
      />
    </button>
  );
}
