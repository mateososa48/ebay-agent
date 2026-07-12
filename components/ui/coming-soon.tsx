import type { ReactNode } from 'react';
import { Eyebrow } from './primitives';

export function ComingSoon({
  eyebrow,
  title,
  note,
  icon,
}: {
  eyebrow: string;
  title: string;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div className="reveal grid min-h-[68vh] place-items-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-hairline bg-surface text-ink-faint shadow-raised">
          {icon}
        </div>
        <div className="mt-6">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h2 className="mt-2.5 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="mx-auto mt-2.5 max-w-xs text-[14.5px] leading-relaxed text-ink-muted">{note}</p>
        <div className="mx-auto mt-6 h-px w-16 hairline-x" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Next in the build</p>
      </div>
    </div>
  );
}
