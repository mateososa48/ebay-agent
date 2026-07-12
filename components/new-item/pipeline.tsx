import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import type { Tone } from '@/components/ui/primitives';

export type StepState = 'pending' | 'active' | 'done';

export interface PipeStep {
  key: string;
  label: string;
  hint: string;
  tone: Tone;
  icon: ReactNode;
  state: StepState;
}

const toneVar: Record<Tone, string> = {
  green: 'var(--ebay-green-deep)',
  yellow: 'var(--ebay-yellow)',
  red: 'var(--ebay-red)',
  blue: 'var(--ebay-blue)',
  neutral: 'var(--ink-faint)',
};

const toneTint: Record<Tone, string> = {
  green: 'var(--tint-green)',
  yellow: 'var(--tint-yellow)',
  red: 'var(--tint-red)',
  blue: 'var(--tint-blue)',
  neutral: 'var(--surface-2)',
};

function Node({ step }: { step: PipeStep }) {
  if (step.state === 'done') {
    return (
      <span className="grid size-10 place-items-center rounded-full" style={{ background: toneTint[step.tone] }}>
        <Icon.Check className="size-5" strokeWidth={2.4} style={{ color: toneVar[step.tone] }} />
      </span>
    );
  }
  if (step.state === 'active') {
    return (
      <span className="relative grid size-10 place-items-center rounded-full bg-surface">
        <span
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: toneVar[step.tone], borderRightColor: toneVar[step.tone] }}
        />
        <span className="size-2.5 rounded-full" style={{ background: toneVar[step.tone] }} />
      </span>
    );
  }
  return (
    <span className="grid size-10 place-items-center rounded-full border border-hairline bg-surface-2 text-ink-faint">
      {step.icon}
    </span>
  );
}

export function Pipeline({ steps }: { steps: PipeStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-4 pb-7 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[19px] top-11 h-[calc(100%-1.75rem)] w-px"
                style={{
                  background: s.state === 'done' ? toneVar[s.tone] : 'var(--hairline)',
                  opacity: s.state === 'done' ? 0.4 : 1,
                }}
              />
            )}
            <Node step={s} />
            <div className="pt-1">
              <div
                className="font-display text-[15px] font-semibold transition-colors"
                style={{ color: s.state === 'pending' ? 'var(--ink-faint)' : 'var(--ink)' }}
              >
                {s.label}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-muted">{s.hint}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
