import { Card, Eyebrow } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { ListingDetail } from '@/lib/sample-listing';

function EditButton() {
  return (
    <button className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
      <Icon.Pencil className="size-3.5" />
      Edit
    </button>
  );
}

export function ListingBody({ listing }: { listing: ListingDetail }) {
  return (
    <Card className="reveal overflow-hidden" style={{ animationDelay: '150ms' }}>
      {/* Title */}
      <section className="p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Title</Eyebrow>
          <span className="font-mono text-[11px] text-ink-faint tnum">{listing.title.length} / 80</span>
        </div>
        <div className="mt-2.5 rounded-xl border border-hairline bg-surface-2/50 px-4 py-3 font-display text-[16px] font-medium leading-snug text-ink">
          {listing.title}
        </div>
      </section>

      <div className="hairline-x h-px" />

      {/* Item specifics */}
      <section className="p-6">
        <Eyebrow>Item specifics</Eyebrow>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {listing.specifics.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-4 border-b border-hairline py-2.5">
              <dt className="text-[13px] text-ink-muted">{s.label}</dt>
              <dd className="text-[13px] font-medium text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="hairline-x h-px" />

      {/* Description */}
      <section className="p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Description</Eyebrow>
          <EditButton />
        </div>
        <div className="mt-3 space-y-3.5 text-[14.5px] leading-[1.72] text-ink/90">
          {listing.description.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>
    </Card>
  );
}
