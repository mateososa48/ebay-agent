import type { EbayAdapter } from './types';
import { MockEbayAdapter } from './mock';

export type { EbayAdapter } from './types';
export { MockEbayAdapter } from './mock';

export function getEbayAdapter(): EbayAdapter {
  const backend = process.env.EBAY_BACKEND ?? 'mock';
  switch (backend) {
    case 'mock':
      return new MockEbayAdapter();
    // case 'live': return new LiveEbayAdapter();  // added in a later plan
    default:
      throw new Error(`Unknown EBAY_BACKEND: ${backend}`);
  }
}
