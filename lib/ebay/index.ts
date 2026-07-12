import type { EbayAdapter } from './types';
import { MockEbayAdapter } from './mock';
import { LiveEbayAdapter } from './live';

export type { EbayAdapter } from './types';
export { MockEbayAdapter } from './mock';
export { LiveEbayAdapter } from './live';

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
