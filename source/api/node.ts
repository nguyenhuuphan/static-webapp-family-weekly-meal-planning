import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync } from "node:fs";
import { api } from "./app";
import { PlannerService } from "./planner-service";
import { nodeDatabase } from "./node-database";
import { prismaD1Gateway } from "./database";
import { migrateNode } from "../scripts/migrate-node";
import { authenticatedByAccess } from "../cloudflare/access";
import { requireFamilyCode, sameOrigin, json } from "../cloudflare/http";
import { aiMenu } from "../cloudflare/routes/ai-menu";
import { receiptPhotos } from "../cloudflare/routes/receipt-photos";
import { translate } from "../cloudflare/routes/translate";
import { runMenuJob } from "./menu-job";
import { DocumentStore } from "../cloudflare/store";
import type { Env } from "../cloudflare/types";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
if (existsSync(".env")) process.loadEnvFile(".env");
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3001);
if (
  !process.env.FAMILY_ACCESS_CODE ||
  process.env.FAMILY_ACCESS_CODE.length < 16
)
  throw Error(
    "Set FAMILY_ACCESS_CODE (at least 16 characters) in the server environment.",
  );
const local =
  ["127.0.0.1", "localhost", "::1"].includes(host) &&
  process.env.NODE_ENV !== "production";
if (
  !local &&
  (!process.env.CF_ACCESS_AUD || !process.env.CF_ACCESS_TEAM_DOMAIN)
)
  throw Error(
    "Public Node servers must configure Cloudflare Access audience and team domain.",
  );
migrateNode();
const prisma = nodeDatabase();
const DB = prismaD1Gateway(prisma);
const env = {
  DB,
  FAMILY_ACCESS_CODE: process.env.FAMILY_ACCESS_CODE,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  AI_MAX_DAILY_REQUESTS: process.env.AI_MAX_DAILY_REQUESTS || "10",
  CF_ACCESS_AUD: process.env.CF_ACCESS_AUD,
  CF_ACCESS_TEAM_DOMAIN: process.env.CF_ACCESS_TEAM_DOMAIN,
  DEV_ALLOW_AUTH_BYPASS: local ? "true" : undefined,
} as Env;
const jobs = new Set<string>();
async function dispatch(id: string) {
  if (jobs.has(id)) return;
  jobs.add(id);
  const store = new DocumentStore(DB, "node-workflow");
  const step = {
    do: async (
      name: string,
      _options: unknown,
      callback: () => Promise<unknown>,
    ) => {
      const key = id + "/" + name,
        previous = await store.get<{ result: unknown }>(key);
      if (previous) return previous.result;
      const result = await callback();
      await store.setJSON(key, { result }, { onlyIfNew: true });
      return result;
    },
  } as unknown as WorkflowStep;
  try {
    await runMenuJob(
      env,
      { payload: { id } } as WorkflowEvent<{ id: string }>,
      step,
    );
  } finally {
    jobs.delete(id);
  }
}
env.MENU_WORKFLOW = {
  create: async ({ id }: { id: string }) => {
    queueMicrotask(() => dispatch(id).catch(() => {}));
    return { id };
  },
} as unknown as Env["MENU_WORKFLOW"];
if (process.env.CLOUDFLARE_AI_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN) {
  env.AI = {
    run: async (model: string, input: unknown) => {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_AI_ACCOUNT_ID}/ai/run/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(180000),
        },
      );
      const data = (await response.json()) as {
        success: boolean;
        result: unknown;
      };
      if (!response.ok || !data.success) throw Error("Backup AI unavailable.");
      return data.result;
    },
  } as unknown as Ai;
}
const app = new Hono();
app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!(await authenticatedByAccess(c.req.raw, env)))
    return json({ error: "sign_in_required" }, 403);
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  if (c.req.path.startsWith("/api/")) {
    if (!sameOrigin(c.req.raw))
      return json({ error: "cross_origin_refused" }, 403);
    const denied =
      c.req.path === "/api/translate"
        ? null
        : await requireFamilyCode(c.req.raw, env);
    if (denied) return denied;
  }
  await next();
});
app.all("/api/v1/*", (c) => api.fetch(c.req.raw, { prisma }));
app.all("/api/ai-menu", (c) => aiMenu(c.req.raw, env));
app.all("/api/receipt-photos", (c) => receiptPhotos(c.req.raw, env));
app.all("/api/translate", (c) => translate(c.req.raw, env));
app.get("/api/family-plan", async (c) => {
  const envelope = await new PlannerService(prisma).read();
  return c.json({
    state: envelope.state,
    revision: "api-" + envelope.revision,
  });
});
app.all("/api/*", (c) => c.json({ error: "Use the versioned API." }, 410));
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));
app.onError((_error, c) => c.json({ error: "service_unavailable" }, 503));
const server = serve({ fetch: app.fetch, hostname: host, port }, () =>
  console.log(`Node.js API ready on http://${host}:${port}`),
);
const shutdown = () =>
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// The local Node adapter resumes jobs using durable, cached step results.
void prisma.document
  .findMany({ where: { namespace: "ai", key: { startsWith: "jobs/" } } })
  .then((rows) => {
    for (const row of rows) {
      const job = JSON.parse(row.value);
      if (["queued", "running"].includes(job.status))
        void dispatch(job.id).catch(() => {});
    }
  });
