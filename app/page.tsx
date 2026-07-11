export const dynamic = 'force-dynamic';

export default function Page() {
  const dbConfigured = Boolean(process.env.DATABASE_URL);
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0e0f13',
        color: '#e8e8ea',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <div
          style={{
            fontSize: 13,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            opacity: 0.5,
          }}
        >
          Setup in progress
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 650, margin: '0.6rem 0 0.4rem' }}>
          eBay Selling Agent
        </h1>
        <p style={{ opacity: 0.7, lineHeight: 1.6, margin: 0 }}>
          Deployment is live. The dashboard is being built &mdash; this is a temporary placeholder.
        </p>
        <p style={{ marginTop: '1.6rem', fontSize: 14 }}>
          <span style={{ opacity: 0.6 }}>Neon database:&nbsp;</span>
          <strong style={{ color: dbConfigured ? '#3ecf8e' : '#e0a33e' }}>
            {dbConfigured ? 'connected' : 'not connected yet'}
          </strong>
        </p>
      </div>
    </main>
  );
}
