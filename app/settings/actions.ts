'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { setSetting } from '@/lib/db/repos/settings';

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
