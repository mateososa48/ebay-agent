'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EbayMark } from '@/components/brand/ebay-mark';
import { Icon } from '@/components/ui/icons';
import { Dot } from '@/components/ui/primitives';
import { cn } from '@/lib/ui/cn';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/overview', label: 'Overview', icon: Icon.Trend },
  { href: '/', label: 'Review Queue', icon: Icon.Queue },
  { href: '/new', label: 'New Item', icon: Icon.Camera },
  { href: '/listings', label: 'Listings', icon: Icon.Grid },
  { href: '/settings', label: 'Settings', icon: Icon.Sliders },
] as const;

export function Sidebar({ pendingCount = 0, connected = false }: { pendingCount?: number; connected?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[264px] shrink-0 flex-col border-r border-hairline bg-paper-edge/60">
      {/* Brand lockup */}
      <div className="px-6 pt-7 pb-6">
        <Link href="/" className="block">
          <div className="font-display text-[20px] font-bold leading-[1.02] tracking-[-0.035em]">
            <span className="text-ink">Consignment</span>
            <br />
            <span className="text-ink-faint">Desk</span>
          </div>
        </Link>

        <div className="mt-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 shadow-raised">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">via</span>
            <EbayMark className="text-[15px]" />
            <span className="h-3 w-px bg-hairline-strong" />
            {connected ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
                <Dot tone="green" pulse />
                Connected
              </span>
            ) : (
              <Link href="/settings" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink">
                <Dot tone="yellow" />
                Connect
              </Link>
            )}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const IconCmp = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-150',
                    active ? 'bg-surface text-ink shadow-raised' : 'text-ink-muted hover:text-ink hover:bg-surface/60',
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--ebay-blue)]" />
                  )}
                  <IconCmp className={cn('size-[19px]', active ? 'text-[var(--ebay-blue)]' : 'text-ink-faint group-hover:text-ink-muted')} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === '/' && pendingCount > 0 ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--ebay-red)] px-1.5 text-[11px] font-semibold text-white tabular-nums">
                      {pendingCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-hairline px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--tint-blue)] font-display text-[14px] font-bold text-[var(--ebay-blue)]">
              M
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-ink">Mateo</div>
              <div className="font-mono text-[11px] text-ink-faint">seller · pro</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
