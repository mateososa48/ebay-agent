import { defineAgent } from 'eve';

// Full gpt-5.4 — the agent needs to reason over vision + web research and write
// non-slop copy, so it runs on the capable model, not the mini. EVE_AGENT_MODEL
// overrides it (the Settings model selector writes this), e.g. openai/gpt-5.4-mini
// for cheap runs or anthropic/claude-opus-4.8 for the best writing.
export default defineAgent({
  model: process.env.EVE_AGENT_MODEL ?? 'openai/gpt-5.4',
});
