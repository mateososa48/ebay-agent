import type { ListingDraft } from '../types';
import {
  SIGNATURE_WORDS,
  PROMO_PHRASES,
  COPULA_DRESSING,
  TITLE_SPAM_TOKENS,
  ACRONYM_ALLOWLIST,
} from './blocklist';

export type IssueSeverity = 'blocking' | 'warning';
export type IssueField = 'title' | 'description' | 'aspects' | 'listing';

export interface LintIssue {
  code: string;
  severity: IssueSeverity;
  field: IssueField;
  message: string;
  matches?: string[];
}

export interface LinterReport {
  ok: boolean; // true when there are no blocking issues
  blocking: LintIssue[];
  warnings: LintIssue[];
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Unambiguous links (scheme or www.) — case-insensitive, always blocking.
const URL_UNAMBIGUOUS_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
// Bare domains — case-SENSITIVE with a lowercase TLD only, so "in.Store",
// "shop.Store hours", "Bench.co" don't trip while "mystore.com" does. `co`/`io`
// are dropped because they collide with common abbreviations.
const URL_BARE_DOMAIN_RE = /(?:^|\s)[a-z0-9-]{2,}\.(?:com|net|org|shop|store)\b(?:\/[^\s]*)?/g;

const OFF_PLATFORM_RE =
  /\b(paypal|venmo|zelle|cash\s?app|whats\s?app|text me|email me|call me|off[-\s]?ebay|outside (?:of )?ebay|contact me (?:at|on))\b/i;

// Grouped/separated phone patterns: a separator or country code is present.
const PHONE_GROUPED_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;
// A bare 10–11 digit run only counts as a phone when a contact cue precedes it
// within ~20 chars — so UPC/ISBN/IMEI/serial numbers don't get flagged.
const PHONE_CUE_RE =
  /(?:call|text|phone|whatsapp|cell|reach me|my number)[\s\S]{0,20}?(\d[\d\s().-]{8,}\d)/gi;

/** Phone = a grouped phone shape anywhere, or a bare 10–11 digit run only when
 * a contact cue ("call", "text", …) appears just before it. This avoids
 * flagging identifiers (UPC/ISBN/IMEI/serial) and measurements. */
function findPhoneNumbers(text: string): string[] {
  const matches: string[] = [];

  for (const m of text.match(PHONE_GROUPED_RE) ?? []) {
    matches.push(m.trim());
  }

  PHONE_CUE_RE.lastIndex = 0;
  let cueMatch: RegExpExecArray | null;
  while ((cueMatch = PHONE_CUE_RE.exec(text)) !== null) {
    const candidate = cueMatch[1];
    if (!candidate) continue;
    const digits = candidate.replace(/\D/g, '').length;
    if (digits >= 10 && digits <= 11) matches.push(candidate.trim());
  }

  return matches;
}

/** All contact-info matches (email, links, phones) in a single piece of text. */
function findContactInfo(text: string): string[] {
  const found: string[] = [];
  found.push(...(text.match(EMAIL_RE) ?? []));
  found.push(...(text.match(URL_UNAMBIGUOUS_RE) ?? []));
  found.push(...(text.match(URL_BARE_DOMAIN_RE) ?? []).map((m) => m.trim()));
  found.push(...findPhoneNumbers(text));
  return found;
}

function complianceIssues(d: ListingDraft): LintIssue[] {
  const issues: LintIssue[] = [];
  // Each aspect value is scanned independently — joining values (e.g. "2015" +
  // "125000") would otherwise forge a fake 10-digit phone run.
  const haystacks: Array<[IssueField, string]> = [
    ['title', d.title],
    ['description', d.description],
    ...Object.values(d.aspects).map((v) => ['aspects', v] as [IssueField, string]),
  ];

  for (const [field, text] of haystacks) {
    const contactMatches = findContactInfo(text);
    if (contactMatches.length > 0) {
      issues.push({
        code: 'contact_info',
        severity: 'blocking',
        field,
        message: 'Contact info / links are not allowed before a sale. Remove and direct buyers to "Ask a question".',
        matches: contactMatches,
      });
    }
    const offPlatform = text.match(OFF_PLATFORM_RE);
    if (offPlatform) {
      issues.push({
        code: 'off_platform',
        severity: 'blocking',
        field,
        message: 'Off-platform solicitation is prohibited. Keep the transaction on eBay.',
        matches: [offPlatform[0]],
      });
    }
  }

  if (d.title.length > 80) {
    issues.push({
      code: 'title_too_long',
      severity: 'blocking',
      field: 'title',
      message: `Title is ${d.title.length} chars; eBay's limit is 80 (including spaces).`,
    });
  }

  for (const [key, value] of Object.entries(d.aspects)) {
    if (value.length > 65) {
      issues.push({
        code: 'aspect_too_long',
        severity: 'blocking',
        field: 'aspects',
        message: `Item specific "${key}" is ${value.length} chars; the limit is 65.`,
      });
    }
  }

  return issues;
}

const NEG_PARALLELISM_RES = [
  /\bnot just\b[^.?!]*\bbut\b/i,
  /\bit'?s not\b[^.?!]*\bit'?s\b/i,
  /\bnot only\b[^.?!]*\bbut also\b/i,
];

function countOccurrences(haystack: string, needles: string[]): string[] {
  const lower = haystack.toLowerCase();
  return needles.filter((n) => lower.includes(n.toLowerCase()));
}

/** Collapse plural/verb variants to a stem so a single word (matched by several
 * near-identical blocklist entries) can't trip the ≥2 density threshold. */
function slopStem(word: string): string {
  const w = word.toLowerCase();
  for (const suffix of ['es', 's', 'ly', 'ing', 'd']) {
    if (w.length > suffix.length && w.endsWith(suffix)) {
      return w.slice(0, -suffix.length);
    }
  }
  return w;
}

/** All-caps title tokens that read as spam: fully uppercase (digits allowed),
 * containing at least one letter, and not a known acronym. Pure numbers (model
 * numbers, years, sizes) and mixed-case brand tokens ("Dri-FIT") are left be. */
function allCapsSpamTokens(title: string): string[] {
  return title
    .split(/\s+/)
    .map((tok) => tok.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter(
      (core) =>
        core.length >= 2 &&
        /[A-Za-z]/.test(core) &&
        /^[A-Z0-9]+$/.test(core) &&
        !ACRONYM_ALLOWLIST.has(core),
    );
}

function styleWarnings(d: ListingDraft): LintIssue[] {
  const warnings: LintIssue[] = [];
  const body = `${d.title} ${d.description}`;

  const slopHits = [
    ...countOccurrences(body, SIGNATURE_WORDS),
    ...countOccurrences(body, PROMO_PHRASES),
    ...countOccurrences(body, COPULA_DRESSING),
  ];
  const rawHits = [...new Set(slopHits)];
  const distinctStems = new Set(slopHits.map(slopStem));
  if (distinctStems.size >= 2) {
    warnings.push({
      code: 'slop_vocabulary',
      severity: 'warning',
      field: 'description',
      message: 'Reads as AI: too many stock LLM words/phrases. Rewrite plainer and more specific.',
      matches: rawHits,
    });
  }

  for (const re of NEG_PARALLELISM_RES) {
    const m = d.description.match(re);
    if (m) {
      warnings.push({
        code: 'negative_parallelism',
        severity: 'warning',
        field: 'description',
        message: 'Negative-parallelism ("not just X, but Y") is a classic AI tell. Just say the thing.',
        matches: [m[0]],
      });
      break;
    }
  }

  const emDashes = (d.description.match(/—/g) ?? []).length;
  if (emDashes >= 2) {
    warnings.push({
      code: 'em_dash_overuse',
      severity: 'warning',
      field: 'description',
      message: `Em-dash overuse (${emDashes}). Prefer periods or commas; it reads as AI.`,
    });
  }

  if (/[‘’“”]/.test(body)) {
    warnings.push({
      code: 'curly_quotes',
      severity: 'warning',
      field: 'description',
      message: 'Curly quotes/apostrophes read as AI-pasted. Use straight quotes.',
    });
  }

  const spamHits = countOccurrences(d.title, TITLE_SPAM_TOKENS);
  const capsHits = allCapsSpamTokens(d.title);
  if (spamHits.length > 0 || capsHits.length > 0) {
    const matches = [...spamHits, ...capsHits];
    warnings.push({
      code: 'title_spam',
      severity: 'warning',
      field: 'title',
      message: 'Title has spammy caps/markers that hurt search ranking. Use plain keywords buyers search.',
      matches: matches.length > 0 ? matches : undefined,
    });
  }

  return warnings;
}

export function lintListing(d: ListingDraft): LinterReport {
  const blocking = complianceIssues(d);
  const warnings = styleWarnings(d);
  return { ok: blocking.length === 0, blocking, warnings };
}
