'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { setListingDefaultAction } from '@/app/settings/actions';

export interface AutomationSettings {
  sales: boolean;
  messages: boolean;
  offers: boolean;
  discountPct: number;
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-hairline py-4 last:border-0">
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[13px] text-ink-muted">{hint}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function AutomationForm({ settings }: { settings: AutomationSettings }) {
  const [s, setS] = useState(settings);
  const [, start] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  function save(key: string, value: string) {
    start(async () => {
      const r = await setListingDefaultAction(key, value);
      if (r.ok) setSavedKey(key);
    });
  }
  const tick = (key: string) =>
    savedKey === key ? <span className="text-[12px]" style={{ color: 'var(--ebay-green-deep)' }}>saved</span> : null;

  return (
    <div className="px-5 py-1.5">
      <Row label="Detect sales automatically" hint="Checks eBay every ~15 min, marks items sold, and logs it in your activity feed">
        {tick('automation_sales')}
        <Toggle
          on={s.sales}
          onChange={(on) => {
            setS({ ...s, sales: on });
            save('automation_sales', String(on));
          }}
        />
      </Row>

      <Row label="Draft replies to buyer questions" hint="The agent drafts an answer from the listing — you approve before anything sends">
        {tick('automation_messages')}
        <Toggle
          on={s.messages}
          onChange={(on) => {
            setS({ ...s, messages: on });
            save('automation_messages', String(on));
          }}
        />
      </Row>

      <Row label="Draft offers to interested buyers" hint="One discount offer per eligible listing — you approve before it sends">
        {tick('automation_offers')}
        <Toggle
          on={s.offers}
          onChange={(on) => {
            setS({ ...s, offers: on });
            save('automation_offers', String(on));
          }}
        />
      </Row>

      <Row label="Offer discount" hint="Percent off the list price (never below 70% of list, whatever this is set to)">
        {tick('offer_discount_pct')}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={50}
            value={s.discountPct}
            onChange={(e) => setS({ ...s, discountPct: Number(e.target.value) })}
            onBlur={() => save('offer_discount_pct', String(Math.round(s.discountPct)))}
            className="w-16 rounded-xl border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-[var(--ebay-blue)]"
          />
          <span className="text-[13px] text-ink-muted">%</span>
        </div>
      </Row>
    </div>
  );
}
