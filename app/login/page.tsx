'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EbayMark } from '@/components/brand/ebay-mark';
import { loginAction } from './actions';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    start(async () => {
      const r = await loginAction(password);
      if (r.ok) router.replace('/');
      else setError(true);
    });
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-paper px-6">
      <div className="grain pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-2">
          <span className="font-display text-[19px] font-bold tracking-[-0.03em] text-ink">Consignment Desk</span>
          <span className="text-ink-faint">·</span>
          <EbayMark className="text-[15px]" />
        </div>
        <h1 className="mt-5 font-display text-[26px] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
          Welcome back
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">Enter your password to open the desk.</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl border border-hairline bg-surface px-4 py-3.5 text-[15px] text-ink shadow-raised outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--ebay-blue)]"
          />
          {error && <p className="px-1 text-[13px]" style={{ color: 'var(--ebay-red)' }}>That password didn&rsquo;t match.</p>}
          <button
            type="submit"
            disabled={pending || !password}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-white transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] active:scale-[0.99] disabled:opacity-60"
            style={{ background: 'var(--ebay-blue)' }}
          >
            {pending ? 'Opening…' : 'Open the desk'}
          </button>
        </form>
      </div>
    </main>
  );
}
