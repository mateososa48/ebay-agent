import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/app-shell';
import { EbayMark } from '@/components/brand/ebay-mark';
import { Button, Card, Eyebrow, Pill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { getEbayStatus } from '@/lib/queries';
import { getDb } from '@/lib/db/client';
import { getSetting, getListingDefaults, DEFAULT_LISTING_DEFAULTS } from '@/lib/db/repos/settings';
import { getAiSpend } from '@/lib/ai/spend';
import { ModelSelector } from '@/components/settings/model-selector';
import { ListingDefaultsForm } from '@/components/settings/listing-defaults';
import { AutomationForm, type AutomationSettings } from '@/components/settings/automation';
import { ImportListings } from '@/components/settings/import-listings';

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

export default async function SettingsPage() {
  const ebay = await getEbayStatus();
  const spend = await getAiSpend();
  // getDb() throws synchronously if DATABASE_URL is briefly unset; guard it so a DB
  // blip degrades to safe defaults instead of 500-ing the one page used to reconnect.
  let model = 'openai/gpt-5.4';
  let defaults = DEFAULT_LISTING_DEFAULTS;
  let automation: AutomationSettings = { sales: true, messages: true, offers: true, sync: true, discountPct: 10 };
  try {
    const db = getDb();
    model = (await getSetting(db, 'model')) ?? model;
    defaults = await getListingDefaults(db);
    const pct = Number((await getSetting(db, 'offer_discount_pct')) ?? 10);
    automation = {
      sales: (await getSetting(db, 'automation_sales')) !== 'false',
      messages: (await getSetting(db, 'automation_messages')) !== 'false',
      offers: (await getSetting(db, 'automation_offers')) !== 'false',
      sync: (await getSetting(db, 'automation_import')) !== 'false',
      discountPct: Number.isFinite(pct) ? pct : 10,
    };
  } catch {
    /* DB unavailable — render with safe defaults */
  }

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
                  <div className="text-[14px] font-semibold text-ink">eBay account</div>
                  <div className="mt-0.5 text-[13px] text-ink-muted">Powers listing, pricing, and messaging</div>
                </div>
              </div>
              {ebay.connected ? (
                <Pill tone="green" icon={<Icon.Shield className="size-3.5" />}>
                  Connected
                </Pill>
              ) : ebay.keysConfigured ? (
                <Pill tone="blue" icon={<Icon.Sparkle className="size-3.5" />}>
                  Keys active
                </Pill>
              ) : (
                <Pill tone="neutral">Not configured</Pill>
              )}
            </div>

            {ebay.connected ? (
              <div className="mt-4 rounded-xl bg-[var(--tint-green)] p-4 text-[13px] leading-relaxed" style={{ color: 'var(--ebay-green-deep)' }}>
                Connected to your eBay account on the <strong>{ebay.env}</strong> environment. Pricing pulls real
                comps, and approved listings publish straight to your account.
              </div>
            ) : ebay.keysConfigured ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-surface-2/60 p-4 text-[13px] leading-relaxed text-ink-muted">
                  Your production keys are live — pricing already uses <strong className="text-ink">real eBay comps</strong>.
                  Connect your account once to let approved listings publish to it.
                </div>
                <Button asChild variant="primary" size="md">
                  <Link href="/api/ebay/connect">
                    <EbayMark className="text-[13px]" />
                    Connect eBay account
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-surface-2/60 p-4 text-[13px] leading-relaxed text-ink-muted">
                Running on mock data until your production keyset is set as environment variables.
              </div>
            )}
          </Card>
        </Section>

        <Section title="Existing listings" desc="What you listed on eBay before the agent — import it once and everything below applies to it too.">
          <Card className="p-5">
            <ImportListings />
          </Card>
        </Section>

        <Section title="Listing defaults" desc="Applied to every listing the agent creates — each saves instantly and takes effect on your next publish.">
          <Card className="p-0">
            <ListingDefaultsForm defaults={defaults} />
          </Card>
        </Section>

        <Section title="Buyer automation" desc="Hands-off selling once your items are live. Anything buyer-facing waits for your approval on the queue.">
          <Card className="p-0">
            <AutomationForm settings={automation} />
          </Card>
        </Section>

        <Section title="Voice & model" desc="What writes your listings, and how it sounds.">
          <Card className="p-5">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div>
                <div className="text-[14px] font-medium text-ink">Writing model</div>
                <div className="mt-0.5 text-[13px] text-ink-muted">The model that identifies, prices, and writes — switches live.</div>
              </div>
              <ModelSelector current={model} />
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

        <Section title="AI spend" desc="What you've spent running the agent on the AI Gateway.">
          <Card className="p-5">
            {spend.available ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium text-ink">Used so far</div>
                  <div className="mt-0.5 text-[13px] text-ink-muted">Across every agent run and chat</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[26px] font-bold leading-none text-ink tnum">
                    ${(spend.used ?? 0).toFixed(2)}
                  </div>
                  {spend.balance != null && (
                    <div className="mt-1 text-[12px] text-ink-muted tnum">${spend.balance.toFixed(2)} left</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[13px] leading-relaxed text-ink-muted">
                The agent bills through Vercel&rsquo;s AI Gateway and authenticates automatically (via OIDC) — no key
                needed for it to run, which is why there isn&rsquo;t one set. Showing the live balance <em>here</em> is
                optional and needs a read-only{' '}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">AI_GATEWAY_API_KEY</code>.
                Either way, your exact spend is always in the{' '}
                <a
                  href="https://vercel.com/d?to=%2F%5Bteam%5D%2F~%2Fai"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-ink underline"
                >
                  AI Gateway dashboard
                </a>
                .
              </div>
            )}
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}
