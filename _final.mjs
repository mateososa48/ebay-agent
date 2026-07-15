import { getDb } from './lib/db/client.ts';
const db = getDb();
const { rows: q } = await db.query(`select l.title, l.price from approvals a join listings l on l.id=a.ref_id where a.type='listing' and a.state='pending' order by a.created_at desc`);
console.log('pending listing approvals:', q.length);
for (const r of q) console.log('  ·', r.title.slice(0,44), '$'+r.price);
const { rows } = await db.query(`select item_id from listings where title ilike '%StreamCam Graphite USB-C%'`);
if (rows[0]) { await db.query(`delete from items where id=$1`, [rows[0].item_id]); console.log('deleted TEST item + its draft'); }
