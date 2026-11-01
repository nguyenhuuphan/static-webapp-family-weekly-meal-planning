import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
export function migrateNode(
  url = process.env.DATABASE_URL || "file:./.data/planner.db",
) {
  const path = resolve(url.replace(/^file:/, ""));
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS _api_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  for (const name of readdirSync(resolve("cloudflare/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (db.prepare("SELECT name FROM _api_migrations WHERE name=?").get(name))
      continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(readFileSync(resolve("cloudflare/migrations", name), "utf8"));
      db.prepare("INSERT INTO _api_migrations VALUES(?,?)").run(
        name,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  db.close();
}
if (process.argv[1]?.endsWith("migrate-node.ts")) {
  migrateNode();
  console.log("API database migrations applied.");
}
