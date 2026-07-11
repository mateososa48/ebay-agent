// The living AI-slop blocklist. Sourced from VOICE.md. Refresh periodically —
// the vocabulary rotates as models and readers adapt. No single hit is proof;
// density is the signal.

/** Signature LLM vocabulary (drop or replace). */
export const SIGNATURE_WORDS: string[] = [
  'delve', 'delves', 'boasts', 'boast', 'testament', 'tapestry', 'underscore',
  'underscores', 'pivotal', 'vibrant', 'meticulous', 'meticulously', 'intricate',
  'landscape', 'crucial', 'significant', 'notable', 'additionally', 'bolstered',
  'garner', 'interplay', 'enduring', 'realm', 'elevate', 'unleash', 'seamless',
  'curated', 'nestled',
];

/** Travel-brochure / promotional phrases. */
export const PROMO_PHRASES: string[] = [
  'in the heart of', 'look no further', 'perfect for', 'dive into',
  'when it comes to', 'in the world of', 'commitment to', 'diverse array',
  'rich history', 'a testament to', 'stands as', 'serves as',
];

/** Copula-dressing verbs: inflated stand-ins for plain "is/are". */
export const COPULA_DRESSING: string[] = [
  'boasts', 'features', 'showcases', 'exemplifies', 'represents', 'serves as',
  'stands as', 'marks', 'maintains',
];

/** Words that read as spam in eBay titles (ranking + perception). */
export const TITLE_SPAM_TOKENS: string[] = ['l@@k', 'wow', 'must see', 'rare!', '~'];
