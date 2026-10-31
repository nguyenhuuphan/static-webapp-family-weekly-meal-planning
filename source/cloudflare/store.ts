import type { Stored, WriteOptions } from "./types";
export class DocumentStore {
  constructor(
    private db: D1Database,
    private namespace: string,
  ) {}
  async getWithMetadata<T = unknown>(
    key: string,
    _options?: { type: "json" },
  ): Promise<Stored<T> | null> {
    const row = await this.db
      .prepare(
        "SELECT value, revision FROM documents WHERE namespace = ? AND key = ?",
      )
      .bind(this.namespace, key)
      .first<{ value: string; revision: string }>();
    return row
      ? { data: JSON.parse(row.value) as T, etag: row.revision }
      : null;
  }
  async get<T = unknown>(
    key: string,
    _options?: { type: "json" },
  ): Promise<T | null> {
    return (await this.getWithMetadata<T>(key))?.data ?? null;
  }
  async setJSON(
    key: string,
    data: unknown,
    options: WriteOptions = {},
  ): Promise<{ modified: boolean; etag?: string }> {
    const value = JSON.stringify(data),
      revision = crypto.randomUUID();
    let statement: D1PreparedStatement;
    if (options.onlyIfNew)
      statement = this.db
        .prepare(
          "INSERT INTO documents (namespace, key, value, revision) VALUES (?, ?, ?, ?) ON CONFLICT(namespace, key) DO NOTHING RETURNING revision",
        )
        .bind(this.namespace, key, value, revision);
    else if (options.onlyIfMatch)
      statement = this.db
        .prepare(
          "UPDATE documents SET value = ?, revision = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE namespace = ? AND key = ? AND revision = ? RETURNING revision",
        )
        .bind(value, revision, this.namespace, key, options.onlyIfMatch);
    else
      statement = this.db
        .prepare(
          "INSERT INTO documents (namespace, key, value, revision) VALUES (?, ?, ?, ?) ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value, revision = excluded.revision, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') RETURNING revision",
        )
        .bind(this.namespace, key, value, revision);
    const row = await statement.first<{ revision: string }>();
    return row ? { modified: true, etag: row.revision } : { modified: false };
  }
}
export async function reserveGeneration(
  db: D1Database,
  limitText?: string,
): Promise<boolean> {
  const limit = Math.min(
    10,
    Math.max(0, Number.parseInt(limitText || "3", 10) || 0),
  );
  const store = new DocumentStore(db, "ai");
  const key = "quota/" + new Date().toISOString().slice(0, 10);
  for (let attempt = 0; attempt < 4; attempt++) {
    const old = await store.getWithMetadata<{ count: number }>(key);
    const count = old?.data.count || 0;
    if (count >= limit) return false;
    const result = await store.setJSON(
      key,
      { count: count + 1 },
      old ? { onlyIfMatch: old.etag } : { onlyIfNew: true },
    );
    if (result.modified) return true;
  }
  return false;
}
