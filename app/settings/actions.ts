'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { setSetting } from '@/lib/db/repos/settings';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { importListings } from '@/lib/agent/steps/import';
import { isValidGatewayModelId } from './model-options';

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
  'automation_import',
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
    case 'automation_import':
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

export type ImportActionResult =
  | { ok: true; active: number; imported: number }
  | { ok: false; error: string };

/** Pull the seller's pre-existing live eBay listings into the app (Settings button). */
export async function importEbayListingsAction(): Promise<ImportActionResult> {
  if (!isLiveBackend()) return { ok: false, error: 'eBay backend isn’t live.' };
  try {
    const res = await importListings(getDb(), getEbayAdapter(), 50);
    revalidatePath('/listings');
    revalidatePath('/');
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setModelAction(model: string): Promise<{ ok: boolean }> {
  if (!isValidGatewayModelId(model)) return { ok: false };
  await setSetting(getDb(), 'model', model);
  revalidatePath('/settings');
  return { ok: true };
}
