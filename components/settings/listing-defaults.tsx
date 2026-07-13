'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { setListingDefaultAction } from '@/app/settings/actions';
import type { ListingDefaults } from '@/lib/db/repos/settings';

const inputCls =
  'rounded-xl border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-[var(--ebay-blue)]';

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

export function ListingDefaultsForm({ defaults }: { defaults: ListingDefaults }) {
  const [d, setD] = useState(defaults);
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
      <Row label="Require my approval before publishing" hint="Every listing waits in your queue until you approve it">
        {tick('require_approval')}
        <Toggle
          on={d.requireApproval}
          onChange={(on) => {
            setD({ ...d, requireApproval: on });
            save('require_approval', String(on));
          }}
        />
      </Row>

      <Row label="Ship-from ZIP" hint="Used on every listing (falls back to your eBay account address)">
        {tick('ship_zip')}
        <input
          value={d.shipZip}
          onChange={(e) => setD({ ...d, shipZip: e.target.value })}
          onBlur={() => save('ship_zip', d.shipZip.trim())}
          placeholder="94103"
          inputMode="numeric"
          className={`${inputCls} w-24`}
        />
      </Row>

      <Row label="Shipping" hint="Default for new listings — you can override per item">
        {tick('ship_mode')}
        {d.shipMode === 'flat' && (
          <input
            type="number"
            min={0}
            step="0.01"
            value={d.shipCost}
            onChange={(e) => setD({ ...d, shipCost: Number(e.target.value) })}
            onBlur={() => save('ship_cost', String(d.shipCost))}
            className={`${inputCls} w-20`}
          />
        )}
        <select
          value={d.shipMode}
          onChange={(e) => {
            const v = e.target.value as 'free' | 'flat';
            setD({ ...d, shipMode: v });
            save('ship_mode', v);
          }}
          className={inputCls}
        >
          <option value="free">Free shipping</option>
          <option value="flat">Buyer pays flat</option>
        </select>
      </Row>

      <Row label="Returns" hint="Return policy applied to new listings">
        {tick('return_window')}
        <select
          value={d.returnWindow}
          onChange={(e) => {
            const v = e.target.value as ListingDefaults['returnWindow'];
            setD({ ...d, returnWindow: v });
            save('return_window', v);
          }}
          className={inputCls}
        >
          <option value="days_30">30-day returns</option>
          <option value="days_60">60-day returns</option>
          <option value="none">No returns</option>
        </select>
      </Row>

      <Row label="Handling time" hint="Business days to ship after a sale">
        {tick('handling_days')}
        <input
          type="number"
          min={1}
          max={30}
          value={d.handlingDays}
          onChange={(e) => setD({ ...d, handlingDays: Number(e.target.value) })}
          onBlur={() => save('handling_days', String(d.handlingDays))}
          className={`${inputCls} w-16`}
        />
      </Row>
    </div>
  );
}
