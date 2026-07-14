'use client';

import { useRef, useState, type DragEvent } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/ui/cn';

export function Dropzone({
  previews,
  onAdd,
  onRemove,
  disabled,
}: {
  previews: string[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handleFiles(list: FileList | null) {
    if (!list) return;
    // Some browsers hand over HEIC files with an empty MIME type — accept by extension too.
    const imgs = Array.from(list).filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif)$/i.test(f.name),
    );
    if (imgs.length) onAdd(imgs);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'group relative cursor-pointer rounded-2xl border border-dashed p-8 text-center transition-colors duration-150',
          drag ? 'border-[var(--ebay-blue)] bg-[var(--tint-blue)]' : 'border-hairline-strong bg-surface hover:bg-surface-2',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-ink-muted transition-transform group-hover:-translate-y-0.5">
          <Icon.Camera className="size-6" />
        </div>
        <div className="mt-3.5 font-display text-[16px] font-semibold text-ink">Drop photos here</div>
        <div className="mt-1 text-[13px] text-ink-muted">or click to browse · JPG, PNG, HEIC</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.currentTarget.value = '';
          }}
        />
      </div>

      {previews.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {previews.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-hairline bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {!disabled && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                >
                  <span className="text-[15px] leading-none">×</span>
                </button>
              )}
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
                  cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
