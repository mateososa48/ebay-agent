'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark' || current === 'light') setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="grid size-9 place-items-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors duration-150 hover:text-ink hover:bg-surface-2"
    >
      {theme === 'light' ? <Icon.Moon /> : <Icon.Sun />}
    </button>
  );
}
