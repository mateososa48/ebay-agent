import type { EbayAdapter } from './types';
import { MockEbayAdapter } from './mock';
import { LiveEbayAdapter } from './live';

export type { EbayAdapter } from './types';
export { MockEbayAdapter } from './mock';
export { LiveEbayAdapter } from './live';

/** The resolved backend name: explicit EBAY_BACKEND wins, else live once real
 *  credentials are present, else mock. Single source of truth for both the
 *  adapter and the category/ZIP dependency resolution. */
export function resolveBackend(): 'live' | 'mock' {
  return (process.env.EBAY_BACKEND ?? (process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID ? 'live' : 'mock')) as
    | 'live'
    | 'mock';
}

/** True when the live eBay backend is active. */
export function isLiveBackend(): boolean {
  return resolveBackend() === 'live';
}

/**
 * Selects the eBay backend. Explicit EBAY_BACKEND wins; otherwise it goes live
 * automatically once real credentials are present, and stays on mock in dev/tests.
 */
export function getEbayAdapter(): EbayAdapter {
  const backend = process.env.EBAY_BACKEND ?? (process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID ? 'live' : 'mock');
  switch (backend) {
    case 'mock':
      return new MockEbayAdapter();
    case 'live':
      return new LiveEbayAdapter();
    default:
      throw new Error(`Unknown EBAY_BACKEND: ${backend}`);
  }
}
