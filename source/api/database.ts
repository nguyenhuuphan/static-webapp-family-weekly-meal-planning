import type { D1Database } from "@cloudflare/workers-types";
import type { PrismaClient } from "./generated/prisma/client";
export type Database = PrismaClient;
/** Legacy storage adapters still share the same ORM connection as versioned APIs. */
export function prismaD1Gateway(prisma: Database): D1Database {
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        async first(column?: string) {
          const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
            sql,
            ...values,
          );
          return column ? (rows[0]?.[column] ?? null) : (rows[0] ?? null);
        },
        async all() {
          return {
            success: true,
            results: await prisma.$queryRawUnsafe(sql, ...values),
            meta: {},
          };
        },
        async run() {
          const changes = await prisma.$executeRawUnsafe(sql, ...values);
          return { success: true, results: [], meta: { changes } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}
