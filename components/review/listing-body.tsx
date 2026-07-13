'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { updateListingAction } from '@/app/listings/[id]/actions';
import type { ListingDetail } from '@/lib/sample-listing';

export function ListingBody({ listing, editable }: { listing: ListingDetail; editable?: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(listing.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(listing.description);
  const [err, setErr] = useState<string | null>(null);

  function saveTitle() {
    setEditingTitle(false);
    const next = title.trim();
    if (!next || next === listing.title) {
      setTitle(listing.title);
      return;
    }
    setErr(null);
    start(async () => {
      const r = await updateListingAction(listing.id, { title: next });
      if (r.ok) router.refresh();
      else {
        setErr(r.errors.join(' '));
        setTitle(listing.title);
      }
    });
  }

  function saveDesc() {
    setEditingDesc(false);
    if (desc === listing.description) return;
    setErr(null);
    start(async () => {
      const r = await updateListingAction(listing.id, { description: desc });
      if (r.ok) router.refresh();
      else {
        setErr(r.errors.join(' '));
        setDesc(listing.description);
      }
    });
  }

  return (
    <Card className="reveal overflow-hidden" style={{ animationDelay: '150ms' }}>
      {/* Title */}
      <section className="p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Title</Eyebrow>
          <span className="font-mono text-[11px] text-ink-faint tnum">{title.length} / 80</span>
        </div>
        {editable && editingTitle ? (
          <input
            autoFocus
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') { setTitle(listing.title); setEditingTitle(false); }
            }}
            className="mt-2.5 w-full rounded-xl border border-[var(--ebay-blue)] bg-surface px-4 py-3 font-display text-[16px] font-medium leading-snug text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => setEditingTitle(true)}
            className="mt-2.5 block w-full rounded-xl border border-hairline bg-surface-2/50 px-4 py-3 text-left font-display text-[16px] font-medium leading-snug text-ink transition-colors enabled:hover:border-hairline-strong"
          >
            {title}
          </button>
        )}
      </section>

      <div className="hairline-x h-px" />

      {/* Item specifics */}
      <section className="p-6">
        <Eyebrow>Item specifics</Eyebrow>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {listing.specifics.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-4 border-b border-hairline py-2.5">
              <dt className="text-[13px] text-ink-muted">{s.label}</dt>
              <dd className="text-[13px] font-medium text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
        {editable && (
          <p className="mt-3 text-[12px] text-ink-faint">Change a specific by asking the agent (e.g. “set Size to US 9”).</p>
        )}
      </section>

      <div className="hairline-x h-px" />

      {/* Description */}
      <section className="p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Description</Eyebrow>
          {editable && !editingDesc && (
            <button
              type="button"
              onClick={() => setEditingDesc(true)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Icon.Pencil className="size-3.5" />
              Edit
            </button>
          )}
        </div>
        {editable && editingDesc ? (
          <div className="mt-3">
            <textarea
              autoFocus
              rows={10}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full resize-y rounded-xl border border-[var(--ebay-blue)] bg-surface px-4 py-3 text-[14.5px] leading-[1.72] text-ink outline-none"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={saveDesc}
                className="h-9 rounded-full px-4 text-[13px] font-semibold text-white active:scale-[0.97]"
                style={{ background: 'var(--ebay-blue)' }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setDesc(listing.description); setEditingDesc(false); }}
                className="h-9 rounded-full px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3.5 text-[14.5px] leading-[1.72] text-ink/90">
            {desc.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}
        {err && <p className="mt-2 text-[12px]" style={{ color: 'var(--ebay-red)' }}>{err}</p>}
      </section>
    </Card>
  );
}
