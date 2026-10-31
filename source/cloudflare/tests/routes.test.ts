import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { database } from "./database";
import { DocumentStore, reserveGeneration } from "../store";
import { familyPlan } from "../routes/family-plan";
import { aiMenu } from "../routes/ai-menu";
import { requireFamilyCode, readJSON } from "../http";
import { MenuWorkflow } from "../workflow";
import type { Env } from "../types";
import { freshState } from "../../src/helpers";
import original from "../../public/meal-plan.json";
import type { Plan } from "../../src/types";
import { aiInput, aiOutput } from "../../tests/ai-fixtures";
import { DEFAULT_MASTER_PROMPT, type MenuJob } from "../../src/ai/contracts";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
let db: ReturnType<typeof database>, env: Env;
const code = "test-only-family-access-code";
const id = "20000000-0000-4000-8000-000000000001";
function request(path: string, body?: unknown, method?: string) {
  return new Request("https://app.example" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + code,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  db = database();
  env = {
    DB: db.db,
    FAMILY_ACCESS_CODE: code,
    GEMINI_API_KEY: "test-only-key",
    AI_MAX_DAILY_REQUESTS: "3",
    MENU_WORKFLOW: { create: vi.fn().mockResolvedValue({ id }) },
    ASSETS: { fetch: vi.fn() },
  } as unknown as Env;
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});
describe("D1 and Cloudflare routes", () => {
  it("uses persistent revisions and rejects competing writes", async () => {
    const store = new DocumentStore(env.DB, "test");
    expect(
      (await store.setJSON("value", { n: 1 }, { onlyIfNew: true })).modified,
    ).toBe(true);
    expect(
      (await store.setJSON("value", { n: 2 }, { onlyIfNew: true })).modified,
    ).toBe(false);
    const old = (await store.getWithMetadata("value"))!;
    const results = await Promise.all([
      store.setJSON("value", { n: 3 }, { onlyIfMatch: old.etag }),
      store.setJSON("value", { n: 4 }, { onlyIfMatch: old.etag }),
    ]);
    expect(results.filter((r) => r.modified)).toHaveLength(1);
  });
  it("enforces family authorization and request body limits", async () => {
    expect(
      await requireFamilyCode(request("/api/family-plan"), env),
    ).toBeNull();
    const wrong = request("/api/family-plan");
    wrong.headers.set("Authorization", "Bearer wrong");
    expect((await requireFamilyCode(wrong, env))?.status).toBe(401);
    const foreign = request("/api/family-plan");
    foreign.headers.set("Origin", "https://other.example");
    expect((await requireFamilyCode(foreign, env))?.status).toBe(403);
    await expect(
      readJSON(request("/api/test", { text: "x".repeat(1000) }), 100),
    ).rejects.toThrow("too_large");
  });
  it("stores and restores a planner without overwriting a newer copy", async () => {
    const state = freshState(original as Plan);
    const first = await familyPlan(
      request("/api/family-plan", { state, revision: null }, "PUT"),
      env,
    );
    expect(first.status).toBe(200);
    const data = (await (
      await familyPlan(request("/api/family-plan"), env)
    ).json()) as { state: { plan: Plan }; revision: string };
    expect(data.state.plan.meals).toHaveLength(10);
    expect(
      (
        await familyPlan(
          request("/api/family-plan", { state, revision: "old" }, "PUT"),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await familyPlan(
          request(
            "/api/family-plan",
            { state: { plan: {} }, revision: data.revision },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(400);
  });
  it("reserves one family-wide daily allowance under concurrent requests", async () => {
    const results = await Promise.all([
      reserveGeneration(env.DB, "1"),
      reserveGeneration(env.DB, "1"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("dispatches a Workflow exactly once and stores a validated bilingual draft", async () => {
    const body = {
      action: "generate",
      id,
      input: aiInput,
      masterPrompt: DEFAULT_MASTER_PROMPT,
      recentMeals: [],
    };
    expect((await aiMenu(request("/api/ai-menu", body), env)).status).toBe(202);
    expect((await aiMenu(request("/api/ai-menu", body), env)).status).toBe(202);
    expect(env.MENU_WORKFLOW.create).toHaveBeenCalledTimes(1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(aiOutput()) }] },
            },
          ],
        }),
      ),
    );
    const step = {
      do: vi.fn(
        async (
          _name: string,
          _options: unknown,
          callback: () => Promise<unknown>,
        ) => callback(),
      ),
    } as unknown as WorkflowStep;
    const workflow = new MenuWorkflow({} as ExecutionContext, env);
    await workflow.run(
      { payload: { id } } as WorkflowEvent<{ id: string }>,
      step,
    );
    const job = await new DocumentStore(env.DB, "ai").get<MenuJob>(
      "jobs/" + id,
    );
    expect(job?.status).toBe("ready");
    expect(job?.plan?.translations?.vi).toBeTruthy();
    expect(
      await new DocumentStore(env.DB, "planner").get("state.json"),
    ).toBeNull();
    await workflow.run(
      { payload: { id } } as WorkflowEvent<{ id: string }>,
      step,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retains provider quota errors as durable failure codes", async () => {
    const job: MenuJob = {
      id,
      status: "queued",
      input: aiInput,
      masterPrompt: DEFAULT_MASTER_PROMPT,
      recentMeals: [],
      createdAt: new Date().toISOString(),
    };
    await new DocumentStore(env.DB, "ai").setJSON("jobs/" + id, job);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    );
    const step = {
      do: vi.fn(
        async (
          _name: string,
          _options: unknown,
          callback: () => Promise<unknown>,
        ) => callback(),
      ),
    } as unknown as WorkflowStep;
    await new MenuWorkflow({} as ExecutionContext, env).run(
      { payload: { id } } as WorkflowEvent<{ id: string }>,
      step,
    );
    const failed = await new DocumentStore(env.DB, "ai").get<MenuJob>(
      "jobs/" + id,
    );
    expect(failed?.errorCode).toBe("quota");
    expect(failed?.errorDiagnostic).toEqual({
      httpStatus: 429,
      reason: "quota",
    });
  });
});
