// Plain module (NOT 'use server') so it can be imported by both the client
// ModelSelector and the server actions. A 'use server' file may only export
// async functions — exporting this array from there turns it into a server-
// action stub on the client, which crashes the settings page.
export const MODEL_OPTIONS = [
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 — smart (default)' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 mini — cheap' },
  { value: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8 — best writing' },
  { value: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 — balanced' },
] as const;
