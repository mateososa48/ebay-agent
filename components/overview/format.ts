/** Shared formatting helpers for the Overview page. Server-safe, locale-pinned. */

export function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

export function weekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
