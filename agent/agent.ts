import { defineAgent } from 'eve';
import { defineDynamic } from 'eve/tools';
import { getDb } from '../lib/db/client';
import { getSetting } from '../lib/db/repos/settings';

// The model is chosen in Settings (persisted in app_settings) and resolved live
// per session — default full gpt-5.4 for capable vision + reasoning + non-slop copy.
// EVE_AGENT_MODEL is the fallback default.
const DEFAULT_MODEL = process.env.EVE_AGENT_MODEL ?? 'openai/gpt-5.4';

export default defineAgent({
  model: defineDynamic({
    fallback: DEFAULT_MODEL,
    events: {
      'session.started': async () => {
        try {
          return (await getSetting(getDb(), 'model')) ?? DEFAULT_MODEL;
        } catch {
          return DEFAULT_MODEL;
        }
      },
    },
  }),
});
