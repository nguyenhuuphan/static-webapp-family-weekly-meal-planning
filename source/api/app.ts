import { Hono } from "hono";
import type { Database } from "./database";
import { PlannerService, ApiError } from "./planner-service";
import { buildReport } from "./reports";
import { readJSON } from "../cloudflare/http";
import { UUID } from "src/helpers/purchaseHistory";
export type ApiBindings = { prisma: Database };
export const api = new Hono<{ Bindings: ApiBindings }>().basePath("/api/v1");
api.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
api.onError((error, c) =>
  error instanceof ApiError
    ? c.json({ error: error.code, message: error.message }, error.status as 400)
    : c.json(
        {
          error: "service_unavailable",
          message:
            "The API is temporarily unavailable. No unconfirmed change should be treated as saved.",
        },
        503,
      ),
);
async function actor(request: Request) {
  const device = request.headers.get("X-Client-Id") || "family";
  if (device.length > 64) throw new ApiError(400, "invalid_client_id");
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(device)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
api.get("/planner", async (c) =>
  c.json(await new PlannerService(c.env.prisma).read()),
);
api.post("/commands", async (c) => {
  let body;
  try {
    body = await readJSON(c.req.raw, 1_850_000);
  } catch {
    throw new ApiError(400, "invalid_command");
  }
  return c.json(
    await new PlannerService(c.env.prisma).command(
      body,
      await actor(c.req.raw),
    ),
  );
});
api.get("/reports", async (c) => {
  const today = new Date().toISOString().slice(0, 10),
    from =
      c.req.query("from") ||
      new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return c.json(
    await buildReport(
      c.env.prisma,
      from,
      c.req.query("to") || today,
      c.req.query("timezone") || "Asia/Ho_Chi_Minh",
    ),
  );
});
api.post("/events", async (c) => {
  let body: any;
  try {
    body = await readJSON(c.req.raw, 2000);
  } catch {
    throw new ApiError(400, "invalid_event");
  }
  if (
    !body ||
    !UUID.test(body.id) ||
    body.kind !== "view.open" ||
    !["week", "shop", "prep", "cook", "settings", "safety", "reports"].includes(
      body.view,
    ) ||
    Object.keys(body).some((k) => !["id", "kind", "view"].includes(k))
  )
    throw new ApiError(400, "invalid_event");
  await c.env.prisma.behaviorEvent.upsert({
    where: { id: body.id },
    create: {
      id: body.id,
      kind: body.kind,
      view: body.view,
      actor: await actor(c.req.raw),
      createdAt: new Date().toISOString(),
    },
    update: {},
  });
  return c.json({ recorded: true });
});
api.get("/health", async (c) => {
  await c.env.prisma.$queryRaw`SELECT 1`;
  return c.json({ status: "ok", database: "prisma", apiVersion: 1 });
});
