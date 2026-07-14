'use client';

import { useMemo, useState, useTransition } from 'react';
import { setModelAction } from '@/app/settings/actions';
import { MODEL_OPTIONS } from '@/app/settings/model-options';

export function ModelSelector({ current, catalog }: { current: string; catalog: { id: string; name: string }[] | null }) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // Favorites first, then the full live catalog grouped by provider (deduped).
  const groups = useMemo(() => {
    const favoriteIds = new Set<string>(MODEL_OPTIONS.map((o) => o.value));
    const byProvider = new Map<string, { id: string; name: string }[]>();
    for (const m of catalog ?? []) {
      if (favoriteIds.has(m.id)) continue;
      const provider = m.id.split('/')[0] ?? 'other';
      const list = byProvider.get(provider) ?? [];
      list.push(m);
      byProvider.set(provider, list);
    }
    return [...byProvider.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  // The saved model might come from the live catalog — make sure it's selectable.
  const knownIds = useMemo(() => {
    const ids = new Set<string>(MODEL_OPTIONS.map((o) => o.value));
    for (const [, models] of groups) for (const m of models) ids.add(m.id);
    return ids;
  }, [groups]);

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
        className="max-w-[300px] rounded-full border border-hairline bg-surface-2 px-3 py-1.5 font-mono text-[12px] text-ink outline-none transition-colors focus:border-[var(--ebay-blue)] disabled:opacity-60"
      >
        <optgroup label="Recommended">
          {MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
        {groups.map(([provider, models]) => (
          <optgroup key={provider} label={provider}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
        {!knownIds.has(value) && <option value={value}>{value}</option>}
      </select>
    </div>
  );
}
