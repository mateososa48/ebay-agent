'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { setSetting } from '@/lib/db/repos/settings';
import { MODEL_OPTIONS } from './model-options';

const DEFAULT_KEYS = new Set([
  'ship_zip',
  'ship_mode',
  'ship_cost',
  'return_window',
  'handling_days',
  'require_approval',
  'automation_sales',
  'automation_messages',
  'automation_offers',
  'offer_discount_pct',
]);

export async function setListingDefaultAction(key: string, value: string): Promise<{ ok: boolean }> {
  if (!DEFAULT_KEYS.has(key)) return { ok: false };
  // Validate before persisting — these values flow straight into the eBay listing XML,
  // where an out-of-range or wrong-enum value bounces the publish (or silently misprices).
  let v = value.slice(0, 100).trim();
  switch (key) {
    case 'ship_mode':
      if (v !== 'free' && v !== 'flat') return { ok: false };
      break;
    case 'return_window':
      if (v !== 'days_30' && v !== 'days_60' && v !== 'none') return { ok: false };
      break;
    case 'require_approval':
    case 'automation_sales':
    case 'automation_messages':
    case 'automation_offers':
      if (v !== 'true' && v !== 'false') return { ok: false };
      break;
    case 'offer_discount_pct': {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 50) return { ok: false };
      v = String(n);
      break;
    }
    case 'ship_cost': {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { ok: false };
      v = (Math.round(n * 100) / 100).toString();
      break;
    }
    case 'handling_days': {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 30) return { ok: false };
      v = String(n);
      break;
    }
    case 'ship_zip':
      // free-form (already trimmed + capped); empty clears it
      break;
  }
  await setSetting(getDb(), key, v);
  revalidatePath('/settings');
  return { ok: true };
}

export async function setModelAction(model: string): Promise<{ ok: boolean }> {
  if (!MODEL_OPTIONS.some((o) => o.value === model)) return { ok: false };
  await setSetting(getDb(), 'model', model);
  revalidatePath('/settings');
  return { ok: true };
}
