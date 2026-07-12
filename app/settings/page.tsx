import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { EbayMark } from '@/components/brand/ebay-mark';
import { Card, Eyebrow, Pill } from '@/components/ui/primitives';
import { Toggle } from '@/components/ui/toggle';
import { Icon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="reveal grid gap-6 border-t border-hairline py-8 first:border-0 first:pt-0 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{desc}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Row({ label, hint, control }: { label: string; hint: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-hairline py-4 last:border-0">
      <div>
        <div className="text-[14px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[13px] text-ink-muted">{hint}</div>
      </div>
      {control}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <header className="reveal">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-2.5 font-display text-[40px] font-bold leading-[1.0] tracking-[-0.035em] text-ink">
          Settings
        </h1>
      </header>

      <div className="mt-8 max-w-3xl">
        <Section title="eBay account" desc="How the agent reaches eBay to research, list, and sell.">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-hairline bg-surface-2">
                  <EbayMark className="text-[16px]" />
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-ink">eBay Developer connection</div>
                  <div className="mt-0.5 text-[13px] text-ink-muted">Powers listing, pricing, and messaging</div>
                </div>
              </div>
              <Pill tone="yellow" icon={<Icon.Clock className="size-3.5" />}>
                Sandbox
              </Pill>
            </div>
            <div className="mt-4 rounded-xl bg-surface-2/60 p-4 text-[13px] leading-relaxed text-ink-muted">
              Running on mock data until your production keyset is added. Once your eBay Developer keys are set
              as environment variables, this flips to the live Sandbox, then Production.
            </div>
          </Card>
        </Section>

        <Section title="Automation" desc="How much the agent does on its own. You stay in control of what goes public.">
          <Card className="px-5 py-1.5">
            <Row
              label="Require my approval before publishing"
              hint="Every listing waits in your queue until you approve it"
              control={<Toggle defaultOn disabled />}
            />
            <Row
              label="Auto-send offers to interested buyers"
              hint="Send discounts to watchers without asking first"
              control={<Toggle />}
            />
            <Row
              label="Auto-reply to routine buyer questions"
              hint="Answer simple questions; escalate anything unusual to you"
              control={<Toggle defaultOn />}
            />
          </Card>
        </Section>

        <Section title="Voice & model" desc="What writes your listings, and how it sounds.">
          <Card className="p-5">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div>
                <div className="text-[14px] font-medium text-ink">Writing model</div>
                <div className="mt-0.5 text-[13px] text-ink-muted">Add AI Gateway credits to switch to Opus 4.8</div>
              </div>
              <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 font-mono text-[12px] text-ink">
                openai/gpt-5.4-mini
              </span>
            </div>
            <div className="flex items-center justify-between pt-4">
              <div>
                <div className="text-[14px] font-medium text-ink">Voice rules</div>
                <div className="mt-0.5 text-[13px] text-ink-muted">The anti-slop style guide + linter the agent must pass</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tint-green)] px-3 py-1.5 text-[12px] font-medium" style={{ color: 'var(--ebay-green-deep)' }}>
                <Icon.Shield className="size-3.5" />
                Active
              </span>
            </div>
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}
