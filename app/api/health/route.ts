export const dynamic = 'force-dynamic';

// Reports deployment + env health. The real Neon connectivity ping is wired in
// Plan 2 (data layer); for now this just reflects whether DATABASE_URL is set.
export async function GET() {
  return Response.json({
    ok: true,
    db: process.env.DATABASE_URL ? 'configured' : 'not_configured',
    ts: new Date().toISOString(),
  });
}
