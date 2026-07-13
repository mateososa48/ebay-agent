// lib/ebay/listing-xml.test.ts
import { describe, it, expect } from 'vitest';
import { buildFixedPriceItemXml } from './listing-xml';
import type { PublishListingInput } from './types';

const INPUT: PublishListingInput = {
  title: 'Levi\'s 501 Jeans 34x32 <blue>',
  description: 'Great & clean pair',
  price: 48,
  categoryId: '11483',
  condition: 'used_good',
  aspects: { Brand: "Levi's", Size: '34x32' },
  photoUrls: ['https://blob.example/a.jpg', 'https://blob.example/b.jpg'],
  postalCode: '94103',
};

describe('buildFixedPriceItemXml', () => {
  it('uses the Verify root when verify=true', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: true });
    expect(xml).toContain('<VerifyAddFixedPriceItemRequest');
  });
  it('uses the Add root when verify=false', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<AddFixedPriceItemRequest');
  });
  it('escapes XML-unsafe characters in the title', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('Levi&apos;s 501 Jeans 34x32 &lt;blue&gt;');
  });
  it('emits category, price, condition, GTC, quantity, postal code', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<CategoryID>11483</CategoryID>');
    expect(xml).toContain('<StartPrice currencyID="USD">48.00</StartPrice>');
    expect(xml).toContain('<ConditionID>3000</ConditionID>');
    expect(xml).toContain('<ListingDuration>GTC</ListingDuration>');
    expect(xml).toContain('<Quantity>1</Quantity>');
    expect(xml).toContain('<PostalCode>94103</PostalCode>');
  });
  it('emits each aspect as a NameValueList', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<Name>Brand</Name><Value>Levi&apos;s</Value>');
    expect(xml).toContain('<Name>Size</Name><Value>34x32</Value>');
  });
  it('emits every photo as a PictureURL', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<PictureURL>https://blob.example/a.jpg</PictureURL>');
    expect(xml).toContain('<PictureURL>https://blob.example/b.jpg</PictureURL>');
  });
  it('sets free shipping and 30-day returns', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<FreeShipping>true</FreeShipping>');
    expect(xml).toContain('<ReturnsWithinOption>Days_30</ReturnsWithinOption>');
  });
  it('emits a UUID only when idempotencyKey is set', () => {
    expect(buildFixedPriceItemXml({ ...INPUT, idempotencyKey: 'abc123' }, { verify: false }))
      .toContain('<UUID>abc123</UUID>');
    expect(buildFixedPriceItemXml(INPUT, { verify: false })).not.toContain('<UUID>');
  });
  it('neutralizes a CDATA terminator in the description', () => {
    const xml = buildFixedPriceItemXml({ ...INPUT, description: 'code: foo]]>bar' }, { verify: false });
    expect(xml).not.toContain('foo]]>bar');
    expect(xml).toContain(']]]]><![CDATA[>');
  });
});
