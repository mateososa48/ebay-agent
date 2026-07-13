// lib/ebay/trading.test.ts
import { describe, it, expect } from 'vitest';
import { parseTradingResponse, parseGetUserPostalCode } from './trading';

const SUCCESS = `<?xml version="1.0"?><AddFixedPriceItemResponse><Ack>Success</Ack><ItemID>110566893738</ItemID></AddFixedPriceItemResponse>`;
const FAILURE = `<?xml version="1.0"?><AddFixedPriceItemResponse><Ack>Failure</Ack>
  <Errors><SeverityCode>Error</SeverityCode><ShortMessage>Missing brand</ShortMessage><LongMessage>The item specific Brand is required.</LongMessage></Errors>
  <Errors><SeverityCode>Warning</SeverityCode><ShortMessage> w</ShortMessage><LongMessage>ignore me</LongMessage></Errors>
</AddFixedPriceItemResponse>`;
const USER = `<?xml version="1.0"?><GetUserResponse><Ack>Success</Ack><User><RegistrationAddress><PostalCode>94103</PostalCode></RegistrationAddress></User></GetUserResponse>`;

describe('parseTradingResponse', () => {
  it('reads Ack + ItemID on success', () => {
    const r = parseTradingResponse(SUCCESS);
    expect(r.ack).toBe('Success');
    expect(r.itemId).toBe('110566893738');
    expect(r.errors).toEqual([]);
  });
  it('collects only Error-severity LongMessages on failure', () => {
    const r = parseTradingResponse(FAILURE);
    expect(r.ack).toBe('Failure');
    expect(r.errors).toEqual(['The item specific Brand is required.']);
  });
});

describe('parseGetUserPostalCode', () => {
  it('reads the postal code', () => expect(parseGetUserPostalCode(USER)).toBe('94103'));
  it('returns null when absent', () => expect(parseGetUserPostalCode('<x/>')).toBeNull());
});
