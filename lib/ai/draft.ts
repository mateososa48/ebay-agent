import 'server-only';
import { generateText } from 'ai';

export interface DraftReplyInput {
  question: string;
  buyer?: string | null;
  listing: {
    title: string;
    price: number | null;
    condition: string | null;
    description: string;
    specifics: Record<string, string>;
  };
}

const SYSTEM = `You draft replies to eBay buyer questions on behalf of a solo seller.
Rules:
- Answer ONLY from the listing details provided. If the listing doesn't answer the question, say you'll double-check and follow up — never invent measurements, materials, or history.
- 1-3 short sentences. Plain, friendly, human. No emojis, no exclamation spam, no "Great question!", no sign-offs, no seller name.
- Don't promise discounts, holds, or off-eBay deals.
- Output the reply text only.`;

/**
 * Draft a reply to a buyer question with the same gateway model the agent uses.
 * The cron route falls back to a safe template if the model call fails, so a
 * gateway hiccup never breaks the poller.
 */
export async function draftBuyerReply(input: DraftReplyInput, model = 'openai/gpt-5.4'): Promise<string> {
  const specifics = Object.entries(input.listing.specifics)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const { text } = await generateText({
    model,
    system: SYSTEM,
    prompt: `Listing title: ${input.listing.title}
Price: ${input.listing.price != null ? `$${input.listing.price}` : 'n/a'}
Condition: ${input.listing.condition ?? 'n/a'}
Item specifics:
${specifics || '(none)'}
Description:
${input.listing.description}

Buyer${input.buyer ? ` (${input.buyer})` : ''} asked:
"${input.question}"

Draft the reply.`,
  });
  const reply = text.trim();
  if (!reply) throw new Error('empty draft');
  return reply;
}

/** Deterministic fallback when the model is unavailable — honest, safe, never wrong. */
export function fallbackReply(): string {
  return "Thanks for reaching out — let me double-check that detail and get back to you shortly. Everything I've confirmed so far is in the listing photos and description.";
}
