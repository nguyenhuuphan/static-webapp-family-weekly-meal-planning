import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "./generated/worker/client";
import type { Database } from "./database";
const clients = new WeakMap<object, Database>();
export function workerDatabase(db: D1Database): Database {
  let client = clients.get(db);
  if (!client) {
    client = new PrismaClient({
      adapter: new PrismaD1(db),
    }) as unknown as Database;
    clients.set(db, client);
  }
  return client;
}
