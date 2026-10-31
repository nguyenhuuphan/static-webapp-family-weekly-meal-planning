import type { MenuAllowance } from "../src/ai/contracts";

export function menuLimit(value?: string) {
  return Math.min(10, Math.max(0, Number.parseInt(value ?? "10", 10) || 0));
}
function windowUTC() {
  const day = new Date().toISOString().slice(0, 10);
  const start = day + "T00:00:00.000Z";
  const end = new Date(Date.parse(start) + 86400000).toISOString();
  return { start, end };
}
// Count durable job state, rather than irreversible attempt counters. Failed jobs
// release their slot immediately; successful and admitted in-flight jobs count.
const COUNT = `SELECT COUNT(*) AS used FROM documents
 WHERE namespace = 'ai' AND key LIKE 'jobs/%'
 AND json_extract(value, '$.createdAt') >= ? AND json_extract(value, '$.createdAt') < ?
 AND COALESCE(json_extract(value, '$.diagnostic'), 0) != 1
 AND (json_extract(value, '$.status') = 'ready'
 OR (json_extract(value, '$.status') IN ('queued', 'running')
 AND COALESCE(json_extract(value, '$.admissionPending'), 0) = 0))`;
export async function menuAllowance(
  db: D1Database,
  configuredLimit?: string,
): Promise<MenuAllowance> {
  const { start, end } = windowUTC();
  const row = await db
    .prepare(COUNT)
    .bind(start, end)
    .first<{ used: number }>();
  const limit = menuLimit(configuredLimit),
    used = Number(row?.used || 0);
  return { limit, used, remaining: Math.max(0, limit - used), resetsAt: end };
}
export async function admitMenu(
  db: D1Database,
  id: string,
  configuredLimit?: string,
): Promise<boolean> {
  const { start, end } = windowUTC();
  // One SQLite statement serializes admissions across requests. The pending job
  // is excluded from COUNT until this atomic update grants its slot.
  const row = await db
    .prepare(
      `UPDATE documents SET
    value = json_set(value, '$.admissionPending', json('false')), revision = ?
    WHERE namespace = 'ai' AND key = ?
    AND json_extract(value, '$.admissionPending') = 1
    AND json_extract(value, '$.status') = 'queued'
    AND (${COUNT}) < ? RETURNING revision`,
    )
    .bind(
      crypto.randomUUID(),
      "jobs/" + id,
      start,
      end,
      menuLimit(configuredLimit),
    )
    .first<{ revision: string }>();
  return !!row;
}
