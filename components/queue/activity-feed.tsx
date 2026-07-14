import { Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { ActivityEntry } from '@/lib/queries';

function describe(e: ActivityEntry): { text: string; tone: string } {
  const d = e.data as { title?: string; salePrice?: number; offerPrice?: number; buyer?: string };
  const title = d.title ? `“${d.title.slice(0, 48)}${(d.title.length ?? 0) > 48 ? '…' : ''}”` : 'a listing';
  switch (e.kind) {
    case 'sale.detected':
      return { text: `Sold ${title}${d.salePrice ? ` for $${d.salePrice}` : ''}`, tone: 'var(--ebay-green-deep)' };
    case 'message.drafted':
      return { text: `Drafted a reply to ${d.buyer ?? 'a buyer'} about ${title}`, tone: 'var(--ebay-blue)' };
    case 'message.sent':
      return { text: `Sent your reply to ${d.buyer ?? 'the buyer'} about ${title}`, tone: 'var(--ebay-green-deep)' };
    case 'offer.drafted':
      return { text: `Drafted a $${d.offerPrice} offer to watchers of ${title}`, tone: 'var(--ebay-blue)' };
    case 'offer.sent':
      return { text: `Sent a $${d.offerPrice} offer to watchers of ${title}`, tone: 'var(--ebay-green-deep)' };
    default:
      return { text: e.kind, tone: 'var(--ink-muted)' };
  }
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ActivityFeed({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <Eyebrow>While you were away</Eyebrow>
      <ul className="mt-3 space-y-0.5 rounded-2xl border border-hairline bg-surface p-2 shadow-raised">
        {items.map((e) => {
          const { text, tone } = describe(e);
          return (
            <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: 'var(--surface-2)' }}>
                <Icon.Sparkle className="size-3.5" style={{ color: tone }} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink/90">{text}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-faint">{ago(e.createdAt)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
