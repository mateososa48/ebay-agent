import type { ComponentType, SVGProps } from 'react';
import { Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { ListingAnalytics } from '@/lib/queries';

type Event = ListingAnalytics['timeline'][number];
type EventData = {
  title?: string;
  buyer?: string;
  salePrice?: number;
  offerPrice?: number;
  price?: number;
  from?: number;
  to?: number;
  oldPrice?: number;
  newPrice?: number;
};

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const SHOWN = 12;

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function describe(e: Event): { label: string; icon: IconType; color: string; bg: string } {
  const d = e.data as EventData;
  const green = { color: 'var(--ebay-green-deep)', bg: 'var(--tint-green)' };
  const blue = { color: 'var(--ebay-blue)', bg: 'var(--tint-blue)' };
  const yellow = { color: 'var(--ebay-yellow)', bg: 'var(--tint-yellow)' };
  const neutral = { color: 'var(--ink-muted)', bg: 'var(--surface-2)' };

  switch (e.kind) {
    case 'sale.detected':
      return { label: `Sold${d.salePrice != null ? ` for ${money(d.salePrice)}` : ''}`, icon: Icon.Tag, ...green };
    case 'published':
      return { label: 'Published to eBay', icon: Icon.ArrowUpRight, ...green };
    case 'listing.imported':
      return { label: 'Imported from your eBay account', icon: Icon.Box, ...neutral };
    case 'price.revised': {
      const from = d.from ?? d.oldPrice;
      const to = d.to ?? d.newPrice ?? d.price;
      const detail = from != null && to != null ? ` ${money(from)} → ${money(to)}` : '';
      return { label: `Price revised${detail}`, icon: Icon.Trend, ...yellow };
    }
    case 'message.drafted':
      return { label: `Drafted a reply${d.buyer ? ` to ${d.buyer}` : ''}`, icon: Icon.Pencil, ...blue };
    case 'message.sent':
      return { label: `Reply sent${d.buyer ? ` to ${d.buyer}` : ''}`, icon: Icon.Check, ...green };
    case 'offer.drafted':
      return {
        label: `Drafted a${d.offerPrice != null ? ` ${money(d.offerPrice)}` : 'n'} offer to watchers`,
        icon: Icon.Pencil,
        ...blue,
      };
    case 'offer.sent':
      return {
        label: `Offer sent to watchers${d.offerPrice != null ? ` · ${money(d.offerPrice)}` : ''}`,
        icon: Icon.Check,
        ...green,
      };
    case 'listing_edited':
      return { label: 'Listing edited', icon: Icon.Pencil, ...neutral };
    case 'photos.curated':
      return { label: 'Photos picked and ordered', icon: Icon.Photo, ...neutral };
    case 'draft.deleted':
      return { label: 'Draft removed', icon: Icon.Alert, ...neutral };
    default:
      return { label: e.kind.replace(/[._]/g, ' '), icon: Icon.Sparkle, ...neutral };
  }
}

/** Everything that has happened to this listing, newest first. */
export function ListingTimeline({ events }: { events: Event[] }) {
  const shown = events.slice(0, SHOWN);
  const hidden = events.length - shown.length;

  return (
    <Card className="reveal p-5" style={{ animationDelay: '220ms' }}>
      <Eyebrow>History</Eyebrow>

      {shown.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-faint">Nothing recorded yet.</p>
      ) : (
        <ol className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-hairline">
          {shown.map((e) => {
            const { label, icon: EventIcon, color, bg } = describe(e);
            return (
              <li key={e.id} className="relative flex items-start gap-3">
                <span
                  className="relative z-[1] grid size-[23px] shrink-0 place-items-center rounded-full ring-2 ring-surface"
                  style={{ backgroundColor: bg, color }}
                >
                  <EventIcon className="size-3" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1 pt-px">
                  <div className="text-[13px] leading-snug text-ink">{label}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{ago(e.createdAt)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {hidden > 0 && (
        <p className="mt-3 border-t border-hairline pt-3 text-[12px] text-ink-faint tnum">
          + {hidden} earlier {hidden === 1 ? 'event' : 'events'}
        </p>
      )}
    </Card>
  );
}
