// lib/ebay/listing-xml.ts
import type { PublishListingInput } from './types';
import { conditionToEbayId } from './condition';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build the shared Item body for Verify/AddFixedPriceItem. Free shipping,
 *  30-day returns, GTC, quantity 1, US/USD, Managed Payments (no PaymentMethods). */
export function buildFixedPriceItemXml(
  input: PublishListingInput,
  opts: { verify: boolean },
): string {
  const root = opts.verify ? 'VerifyAddFixedPriceItemRequest' : 'AddFixedPriceItemRequest';
  const specifics = Object.entries(input.aspects)
    .filter(([, v]) => v && v.trim())
    .map(([name, value]) => `<NameValueList><Name>${esc(name)}</Name><Value>${esc(value)}</Value></NameValueList>`)
    .join('');
  const pictures = input.photoUrls
    .map((u) => `<PictureURL>${esc(u)}</PictureURL>`)
    .join('');
  // eBay dedupes repeat submissions carrying the same Item UUID from one seller.
  const uuid = input.idempotencyKey ? `\n    <UUID>${esc(input.idempotencyKey)}</UUID>` : '';
  // A literal ']]>' in seller text would close the CDATA early and corrupt the XML.
  const description = input.description.replace(/]]>/g, ']]]]><![CDATA[>');

  return `<?xml version="1.0" encoding="utf-8"?>
<${root} xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>${uuid}
    <Title>${esc(input.title)}</Title>
    <Description><![CDATA[${description}]]></Description>
    <PrimaryCategory><CategoryID>${esc(input.categoryId)}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">${input.price.toFixed(2)}</StartPrice>
    <ConditionID>${conditionToEbayId(input.condition)}</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>1</Quantity>
    <PostalCode>${esc(input.postalCode)}</PostalCode>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ItemSpecifics>${specifics}</ItemSpecifics>
    <PictureDetails>${pictures}</PictureDetails>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSGroundAdvantage</ShippingService>
        <ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost>
        <FreeShipping>true</FreeShipping>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>
  </Item>
</${root}>`;
}
