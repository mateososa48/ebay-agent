import type { ListingDraft } from '../types';
import {
  SIGNATURE_WORDS,
  PROMO_PHRASES,
  COPULA_DRESSING,
  TITLE_SPAM_TOKENS,
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

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(?:com|net|org|io|co|shop|store)\b(?:\/[^\s]*)?)/i;
const OFF_PLATFORM_RE =
  /\b(paypal|venmo|zelle|cash\s?app|whats\s?app|text me|email me|call me|off[-\s]?ebay|outside (?:of )?ebay|contact me (?:at|on))\b/i;

/** Phone = a run containing at least 10 digits (so measurements like "34 24 34" don't trip). */
function findPhoneNumbers(text: string): string[] {
  const candidates = text.match(/\d[\d\s().+-]{7,}\d/g) ?? [];
  return candidates.filter((c) => c.replace(/\D/g, '').length >= 10);
}

function complianceIssues(d: ListingDraft): LintIssue[] {
  const issues: LintIssue[] = [];
  const haystacks: Array<[IssueField, string]> = [
    ['title', d.title],
    ['description', d.description],
    ['aspects', Object.values(d.aspects).join(' ')],
  ];

  for (const [field, text] of haystacks) {
    const contactMatches: string[] = [];
    const email = text.match(EMAIL_RE);
    if (email) contactMatches.push(email[0]);
    const url = text.match(URL_RE);
    if (url) contactMatches.push(url[0]);
    contactMatches.push(...findPhoneNumbers(text));
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

export function lintListing(d: ListingDraft): LinterReport {
  const blocking = complianceIssues(d).filter((i) => i.severity === 'blocking');
  const warnings: LintIssue[] = []; // style rules added in Task 6
  return { ok: blocking.length === 0, blocking, warnings };
}
