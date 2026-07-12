import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen bg-paper">
      <Sidebar />
      <main className="relative min-w-0 flex-1">
        <div className="grain pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1180px] px-8 py-10 lg:px-12">{children}</div>
      </main>
    </div>
  );
}
