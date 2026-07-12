import { defineAgent } from 'eve';

// Default is gpt-5.4-mini: strong copy and available on the AI Gateway free
// tier. Override with EVE_AGENT_MODEL to run a premium model like
// anthropic/claude-opus-4.8 once AI Gateway credits are added.
export default defineAgent({
  model: process.env.EVE_AGENT_MODEL ?? 'openai/gpt-5.4-mini',
});
