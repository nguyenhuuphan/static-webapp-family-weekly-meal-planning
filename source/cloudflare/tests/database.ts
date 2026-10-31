import { URL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0001_documents.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        async first() {
          return sqlite.prepare(sql).get(...(values as any[])) ?? null;
        },
        async all() {
          return {
            success: true,
            results: sqlite.prepare(sql).all(...(values as any[])),
          };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...(values as any[]));
          return { success: true, meta: { changes: result.changes } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { db, close: () => sqlite.close() };
}
