import type { ActivityEntry } from '@/lib/queries';
import { ago } from './format';

/** Friendly copy per event kind — a slimmer sibling of the queue ActivityFeed. */
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
    case 'listing.imported':
      return { text: `Imported ${title} from eBay`, tone: 'var(--ebay-blue)' };
    case 'price.revised':
      return { text: `Revised the price on ${title}`, tone: 'var(--ebay-yellow)' };
    case 'draft.deleted':
      return { text: `Deleted the draft for ${title}`, tone: 'var(--ink-faint)' };
    case 'published':
      return { text: `Published ${title} to eBay`, tone: 'var(--ebay-green-deep)' };
    default:
      return { text: e.kind, tone: 'var(--ink-faint)' };
  }
}

/** Slim single-line activity feed for the Overview page. */
export function ActivityList({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface-2/40 px-5 py-8 text-center">
        <p className="text-[13px] text-ink-muted">Quiet so far — agent activity lands here as it happens.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface shadow-raised">
      {items.map((e) => {
        const { text, tone } = describe(e);
        return (
          <li key={e.id} className="flex items-center gap-2.5 px-4 py-2">
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone }} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink/90">{text}</span>
            <span className="shrink-0 font-mono text-[11px] text-ink-faint">{ago(e.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
