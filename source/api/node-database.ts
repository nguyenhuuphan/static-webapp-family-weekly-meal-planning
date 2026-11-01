import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
export function nodeDatabase(
  url = process.env.DATABASE_URL || "file:./.data/planner.db",
) {
  if (url !== ":memory:")
    mkdirSync(dirname(resolve(url.replace(/^file:/, ""))), { recursive: true });
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
