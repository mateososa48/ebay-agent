import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

/* ----------------------------- Button ----------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-full ' +
  'transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out ' +
  'active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45 disabled:pointer-events-none';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-[var(--ebay-blue-deep)] shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-8px_var(--ebay-blue)] hover:brightness-[1.06] hover:-translate-y-px',
  secondary:
    'bg-surface text-ink border border-hairline-strong shadow-raised hover:bg-surface-2 hover:-translate-y-px',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  quiet: 'text-ink-muted hover:text-ink',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  asChild,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />;
}

/* ------------------------------ Card ------------------------------ */

export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-hairline bg-surface shadow-raised',
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-float hover:border-hairline-strong',
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------- Status pill --------------------------- */

export type Tone = 'green' | 'yellow' | 'red' | 'blue' | 'neutral';

const toneStyles: Record<Tone, { dot: string; text: string; bg: string }> = {
  green: { dot: 'var(--ebay-green)', text: 'var(--ebay-green-deep)', bg: 'var(--tint-green)' },
  yellow: { dot: 'var(--ebay-yellow)', text: 'var(--ebay-yellow)', bg: 'var(--tint-yellow)' },
  red: { dot: 'var(--ebay-red)', text: 'var(--ebay-red)', bg: 'var(--tint-red)' },
  blue: { dot: 'var(--ebay-blue)', text: 'var(--ebay-blue)', bg: 'var(--tint-blue)' },
  neutral: { dot: 'var(--ink-faint)', text: 'var(--ink-muted)', bg: 'var(--surface-2)' },
};

export function Pill({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const s = toneStyles[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none',
        className,
      )}
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {icon ?? <span className="size-1.5 rounded-full" style={{ backgroundColor: s.dot }} />}
      {children}
    </span>
  );
}

/* --------------------------- Status dot --------------------------- */

export function Dot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  const s = toneStyles[tone];
  return (
    <span className="relative inline-flex size-2">
      {pulse && (
        <span
          className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: s.dot }}
        />
      )}
      <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: s.dot }} />
    </span>
  );
}

/* --------------------------- Eyebrow label --------------------------- */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint',
        className,
      )}
    >
      {children}
    </span>
  );
}
