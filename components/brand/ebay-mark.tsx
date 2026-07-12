import { cn } from '@/lib/ui/cn';

/**
 * The authentic eBay wordmark: lowercase e-b-a-y in the four brand colors.
 * Rendered as crafted typography (Bricolage, extra-bold, tight) rather than a
 * pixel knockoff. Colors pull from the theme tokens.
 */
export function EbayMark({ className }: { className?: string }) {
  return (
    <span
      aria-label="ebay"
      className={cn('font-display font-extrabold lowercase leading-none tracking-[-0.04em] select-none', className)}
    >
      <span style={{ color: 'var(--ebay-red)' }}>e</span>
      <span style={{ color: 'var(--ebay-blue)' }}>b</span>
      <span style={{ color: 'var(--ebay-yellow)' }}>a</span>
      <span style={{ color: 'var(--ebay-green)' }}>y</span>
    </span>
  );
}
