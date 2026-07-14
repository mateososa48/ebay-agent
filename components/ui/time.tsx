'use client';

import { useEffect, useState } from 'react';

/** Server-rendered timestamps land in the server's timezone (UTC on Vercel),
 *  which reads as "wrong" on the user's clock. These render on the CLIENT in
 *  the viewer's local timezone — a dash on the server pass, then the real
 *  value after hydration. */

export function LocalTime({
  iso,
  options,
  className,
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
}) {
  const [text, setText] = useState('–');
  useEffect(() => {
    try {
      setText(new Date(iso).toLocaleString(undefined, options ?? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    } catch {
      setText('–');
    }
  }, [iso, options]);
  return <span className={className}>{text}</span>;
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '–';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** "8m ago" — computed in the browser and re-computed every 30s so it never lies. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState('–');
  useEffect(() => {
    const update = () => setText(relative(iso));
    update();
    const iv = setInterval(update, 30_000);
    return () => clearInterval(iv);
  }, [iso]);
  return <span className={className}>{text}</span>;
}
