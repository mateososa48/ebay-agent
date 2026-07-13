'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { setSetting } from '@/lib/db/repos/settings';

const DEFAULT_KEYS = new Set(['ship_zip', 'ship_mode', 'ship_cost', 'return_window', 'handling_days', 'require_approval']);

export async function setListingDefaultAction(key: string, value: string): Promise<{ ok: boolean }> {
  if (!DEFAULT_KEYS.has(key)) return { ok: false };
  await setSetting(getDb(), key, value.slice(0, 100));
  revalidatePath('/settings');
  return { ok: true };
}

export const MODEL_OPTIONS = [
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 — smart (default)' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 mini — cheap' },
  { value: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8 — best writing' },
  { value: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 — balanced' },
] as const;

export async function setModelAction(model: string): Promise<{ ok: boolean }> {
  if (!MODEL_OPTIONS.some((o) => o.value === model)) return { ok: false };
  await setSetting(getDb(), 'model', model);
  revalidatePath('/settings');
  return { ok: true };
}
