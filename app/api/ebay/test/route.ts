import { getAppToken, ebayApiBase } from '@/lib/ebay/oauth';

export const dynamic = 'force-dynamic';

// Verifies the app-token + Browse path against the real eBay API.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? "Levi's 501 jeans 34x32 dark wash";
  const configured = Boolean(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID);
  if (!configured) {
    return Response.json({ ok: false, reason: 'EBAY_APP_ID / EBAY_CERT_ID not set' }, { status: 400 });
  }
  try {
    const token = await getAppToken();
    const res = await fetch(
      `${ebayApiBase()}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=5`,
      { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } },
    );
    const data = (await res.json()) as { itemSummaries?: { title?: string; price?: { value?: string } }[] };
    const sample = (data.itemSummaries ?? []).map((s) => ({ title: s.title, price: s.price?.value }));
    return Response.json({
      ok: res.ok,
      env: process.env.EBAY_ENV ?? 'production',
      query: q,
      count: sample.length,
      sample,
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
