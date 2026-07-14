// Plain module (NOT 'use server') so it can be imported by both the client
// ModelSelector and the server actions. A 'use server' file may only export
// async functions — exporting this array from there turns it into a server-
// action stub on the client, which crashes the settings page.

/** Curated favorites, shown at the top of the picker (and used as the fallback
 *  when the live gateway catalog can't be fetched). */
export const MODEL_OPTIONS = [
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 — smart (default)' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 mini — fast + cheap' },
  { value: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8 — best writing' },
  { value: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 — balanced' },
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 — fastest Claude' },
  { value: 'google/gemini-3-pro', label: 'Gemini 3 Pro — strong vision' },
  { value: 'google/gemini-3-flash', label: 'Gemini 3 Flash — fast + cheap' },
  { value: 'xai/grok-4.5', label: 'Grok 4.5' },
  { value: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2 — cheap reasoning' },
  { value: 'moonshotai/kimi-k2', label: 'Kimi K2' },
  { value: 'meta/llama-4-maverick', label: 'Llama 4 Maverick' },
  { value: 'mistral/mistral-large-3', label: 'Mistral Large 3' },
] as const;

/** A gateway model id looks like "provider/model-name". Used to validate free
 *  selections from the live catalog without maintaining an allowlist. */
export function isValidGatewayModelId(id: string): boolean {
  return /^[a-z0-9_-]+\/[a-z0-9._:-]+$/i.test(id) && id.length <= 100;
}
