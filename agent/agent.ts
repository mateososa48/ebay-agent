import { defineAgent } from 'eve';

// Opus 4.8 is the quality bar for the listing copy, but the AI Gateway free
// tier gates premium models — set EVE_AGENT_MODEL to run on whatever the
// account can access (e.g. anthropic/claude-haiku-4.5) until gateway credits
// are added.
export default defineAgent({
  model: process.env.EVE_AGENT_MODEL ?? 'anthropic/claude-opus-4.8',
});
