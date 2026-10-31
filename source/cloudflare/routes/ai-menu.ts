import { json, readJSON } from "../http";
import type { Env } from "../types";
import {
  DEFAULT_MASTER_PROMPT,
  isJobId,
  validateMasterPrompt,
  validateMenuInput,
  type MenuJob,
} from "../../src/ai/contracts";
import { validatePlan } from "../../src/validations";
import { DocumentStore, reserveGeneration } from "../store";

export async function aiMenu(request: Request, env: Env): Promise<Response> {
  if (!["GET", "POST"].includes(request.method))
    return json({ error: "Method not allowed." }, 405);
  try {
    const store = new DocumentStore(env.DB, "ai");
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("job");
      if (id) {
        if (!isJobId(id)) return json({ error: "invalid_input" }, 400);
        const entry = await store.getWithMetadata("jobs/" + id, {
          type: "json",
        });
        const job = entry?.data as MenuJob | undefined;
        if (!job) return json({ error: "not_found" }, 404);
        if (
          ["queued", "running"].includes(job.status) &&
          Date.now() - Date.parse(job.createdAt) > 20 * 60 * 1000
        )
          return json({ ...job, status: "failed", errorCode: "timeout" });
        return json({ ...job, revision: entry?.etag });
      }
      const [settings, latest] = await Promise.all([
        store.getWithMetadata("settings", { type: "json" }),
        store.get("latest", { type: "json" }),
      ]);
      return json({
        configured: !!env.GEMINI_API_KEY,
        masterPrompt:
          (settings?.data as { masterPrompt?: string } | undefined)
            ?.masterPrompt || DEFAULT_MASTER_PROMPT,
        revision: settings?.etag || null,
        latestJob: (latest as { id?: string } | null)?.id || null,
      });
    }
    let body;
    try {
      body = (await readJSON(request, 40000)) as Record<string, any>;
    } catch (error) {
      return json(
        { error: "invalid_input" },
        error instanceof Error && error.message === "too_large" ? 413 : 400,
      );
    }
    if (body?.action === "draft") {
      if (
        !isJobId(body.id) ||
        typeof body.revision !== "string" ||
        !body.revision ||
        validatePlan(body.plan).length
      )
        return json({ error: "invalid_input" }, 400);
      const old = await store.getWithMetadata("jobs/" + body.id, {
        type: "json",
      });
      const job = old?.data as MenuJob | undefined;
      if (
        !job ||
        job.status !== "ready" ||
        body.plan.servings !== job.input.servings ||
        body.plan.meals.length !==
          job.input.days.length * job.input.mealTypes.length ||
        body.plan.meals.some(
          (meal: { day: string; type: string }) =>
            !(job.input.days as string[]).includes(meal.day) ||
            !(job.input.mealTypes as string[]).includes(meal.type),
        )
      )
        return json({ error: "invalid_input" }, 400);
      const saved = await store.setJSON(
        "jobs/" + body.id,
        { ...job, plan: body.plan },
        { onlyIfMatch: body.revision },
      );
      return saved.modified
        ? json({ ...job, plan: body.plan, revision: saved.etag })
        : json({ error: "draft_conflict" }, 409);
    }
    if (body?.action === "settings") {
      let masterPrompt;
      try {
        masterPrompt = validateMasterPrompt(body.masterPrompt);
        if (
          body.revision !== null &&
          (typeof body.revision !== "string" || !body.revision)
        )
          throw Error();
      } catch {
        return json({ error: "invalid_input" }, 400);
      }
      const result = await store.setJSON(
        "settings",
        { masterPrompt },
        body.revision === null
          ? { onlyIfNew: true }
          : { onlyIfMatch: body.revision },
      );
      return result.modified
        ? json({ masterPrompt, revision: result.etag })
        : json({ error: "conflict" }, 409);
    }
    if (body?.action !== "generate" || !isJobId(body.id))
      return json({ error: "invalid_input" }, 400);
    if (!env.GEMINI_API_KEY) return json({ error: "not_configured" }, 503);
    let input, masterPrompt, recentMeals: string[];
    try {
      input = validateMenuInput(body.input);
      masterPrompt = validateMasterPrompt(body.masterPrompt);
      if (
        !Array.isArray(body.recentMeals) ||
        body.recentMeals.length > 50 ||
        body.recentMeals.some(
          (v: unknown) => typeof v !== "string" || v.length > 200,
        )
      )
        throw Error();
      recentMeals = body.recentMeals;
    } catch {
      return json({ error: "invalid_input" }, 400);
    }
    const job: MenuJob = {
      id: body.id,
      status: "queued",
      createdAt: new Date().toISOString(),
      input,
      masterPrompt,
      recentMeals,
    };
    const created = await store.setJSON("jobs/" + job.id, job, {
      onlyIfNew: true,
    });
    if (!created.modified) return json({ id: job.id }, 202); // same submission is safe to retry
    if (!(await reserveGeneration(env.DB, env.AI_MAX_DAILY_REQUESTS))) {
      await store.setJSON("jobs/" + job.id, {
        ...job,
        status: "failed",
        errorCode: "daily_limit",
      });
      return json({ error: "daily_limit" }, 429);
    }
    await store.setJSON("latest", { id: job.id });
    try {
      await env.MENU_WORKFLOW.create({ id: job.id, params: { id: job.id } });
    } catch {
      await store.setJSON("jobs/" + job.id, {
        ...job,
        status: "failed",
        errorCode: "dispatch_failed",
      });
      return json({ error: "dispatch_failed" }, 503);
    }
    return json({ id: job.id }, 202);
  } catch {
    return json({ error: "storage_unavailable" }, 503);
  }
}
