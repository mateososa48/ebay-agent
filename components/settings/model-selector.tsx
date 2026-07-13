'use client';

import { useState, useTransition } from 'react';
import { setModelAction, MODEL_OPTIONS } from '@/app/settings/actions';

export function ModelSelector({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function onChange(next: string) {
    setValue(next);
    setSaved(false);
    start(async () => {
      const r = await setModelAction(next);
      if (r.ok) setSaved(true);
    });
  }

  return (
    <div className="flex items-center gap-2.5">
      {pending ? (
        <span className="text-[12px] text-ink-faint">saving…</span>
      ) : saved ? (
        <span className="text-[12px] font-medium" style={{ color: 'var(--ebay-green-deep)' }}>saved</span>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 font-mono text-[12px] text-ink outline-none transition-colors focus:border-[var(--ebay-blue)] disabled:opacity-60"
      >
        {MODEL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
