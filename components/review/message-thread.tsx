import { Card, Eyebrow, Pill, type Tone } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import type { ListingAnalytics } from '@/lib/queries';

type Message = ListingAnalytics['messages'][number];

const STATUS: Record<string, { tone: Tone; label: string }> = {
  drafted: { tone: 'blue', label: 'Drafted — in your queue' },
  sent: { tone: 'green', label: 'Sent' },
  rejected: { tone: 'neutral', label: 'Skipped' },
  skipped: { tone: 'neutral', label: 'Skipped' },
};

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Thread({ m }: { m: Message }) {
  const status = STATUS[m.status] ?? { tone: 'neutral' as Tone, label: m.status };
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-medium text-ink">{m.sender ?? 'A buyer'}</span>
        <span className="shrink-0 font-mono text-[11px] text-ink-faint">{ago(m.createdAt)}</span>
      </div>
      <p className="mt-1.5 rounded-xl rounded-tl-sm bg-surface-2/70 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink/90">
        &ldquo;{m.question}&rdquo;
      </p>
      {m.draftedReply && (
        <div
          className="mt-2.5 ml-4 border-l-2 pl-3.5"
          style={{ borderColor: 'color-mix(in oklab, var(--ebay-blue) 30%, var(--surface))' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted">
              <Icon.Sparkle className="size-3.5" style={{ color: 'var(--ebay-blue)' }} />
              Your agent
            </span>
            <Pill tone={status.tone} className="px-2 py-0.5 text-[11px]">
              {status.label}
            </Pill>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/85">{m.draftedReply}</p>
        </div>
      )}
    </li>
  );
}

/** Buyer questions about this listing, with the agent's reply beneath each. */
export function MessageThread({ messages }: { messages: Message[] }) {
  return (
    <Card className="reveal p-5" style={{ animationDelay: '160ms' }}>
      <div className="flex items-center justify-between">
        <Eyebrow>Buyer questions</Eyebrow>
        {messages.length > 0 && <span className="font-mono text-[11px] text-ink-faint tnum">{messages.length}</span>}
      </div>

      {messages.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-hairline-strong bg-surface-2/40 px-4 py-6 text-center">
          <p className="text-[13.5px] font-medium text-ink-muted">No buyer questions yet.</p>
          <p className="mt-1 text-[12px] text-ink-faint">When one comes in, the drafted reply shows up here.</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-hairline">
          {messages.map((m) => (
            <Thread key={m.id} m={m} />
          ))}
        </ul>
      )}
    </Card>
  );
}
