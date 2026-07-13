import { getDb } from '../lib/db/client';
import { getEbayConnection } from '../lib/db/repos/connection';

async function main() {
  const c = await getEbayConnection(getDb());
  if (c) {
    console.log(`CONNECTED ✓  connectedAt=${c.connectedAt}  refreshToken=${c.refreshToken.slice(0, 12)}…(${c.refreshToken.length} chars)`);
  } else {
    console.log('NOT CONNECTED — no token stored yet');
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
