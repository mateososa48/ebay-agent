import type { Db } from '../types';

export type ApprovalType = 'listing' | 'offer' | 'message';
export type ApprovalState = 'pending' | 'approved' | 'rejected';

export interface ApprovalRow {
  id: string;
  type: ApprovalType;
  refId: string;
  state: ApprovalState;
  createdAt: string;
  decidedAt: string | null;
}

interface RawApproval {
  id: string;
  type: ApprovalType;
  ref_id: string;
  state: ApprovalState;
  created_at: string | Date;
  decided_at: string | Date | null;
}

function mapApproval(r: RawApproval): ApprovalRow {
  return {
    id: r.id,
    type: r.type,
    refId: r.ref_id,
    state: r.state,
    createdAt: new Date(r.created_at).toISOString(),
    decidedAt: r.decided_at === null ? null : new Date(r.decided_at).toISOString(),
  };
}

export async function enqueueApproval(
  db: Db,
  input: { type: ApprovalType; refId: string },
): Promise<ApprovalRow> {
  const { rows } = await db.query<RawApproval>(
    `insert into approvals (type, ref_id) values ($1, $2) returning *`,
    [input.type, input.refId],
  );
  const row = rows[0];
  if (!row) throw new Error('enqueueApproval: insert returned no row');
  return mapApproval(row);
}

export async function getApproval(db: Db, id: string): Promise<ApprovalRow | null> {
  const { rows } = await db.query<RawApproval>(`select * from approvals where id = $1`, [id]);
  const row = rows[0];
  return row ? mapApproval(row) : null;
}

export async function listPendingApprovals(db: Db): Promise<ApprovalRow[]> {
  const { rows } = await db.query<RawApproval>(
    `select * from approvals where state = 'pending' order by created_at asc`,
  );
  return rows.map(mapApproval);
}

export async function decideApproval(
  db: Db,
  id: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  await db.query(
    `update approvals set state = $2, decided_at = now() where id = $1`,
    [id, decision],
  );
}
