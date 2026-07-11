import { getDb } from '../../../lib/db/client';

export const dynamic = 'force-dynamic';

// Reports deployment + real Neon connectivity.
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: true, db: 'not_configured' });
  }
  try {
    const db = getDb();
    const { rows } = await db.query<{ ok: number }>('select 1 as ok');
    return Response.json({ ok: true, db: 'connected', result: rows[0]?.ok ?? null });
  } catch (e) {
    return Response.json({ ok: false, db: 'error', error: String(e) }, { status: 500 });
  }
}
