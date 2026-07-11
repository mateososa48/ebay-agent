import { getDb } from '../lib/db/client';
import { applySchema } from '../lib/db/schema';

async function main() {
  const db = getDb();
  await applySchema(db);
  const { rows } = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  console.log('Schema applied. Tables:', rows.map((r) => r.table_name).join(', '));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
