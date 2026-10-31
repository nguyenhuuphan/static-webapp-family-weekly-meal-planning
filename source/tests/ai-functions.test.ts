// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const blob = vi.hoisted(() => ({
  get: vi.fn(),
  getWithMetadata: vi.fn(),
  setJSON: vi.fn(),
}));
vi.mock("@netlify/blobs", () => ({ getStore: () => blob }));
import api from "../netlify/functions/ai-menu";
import background from "../netlify/functions/generate-menu-background";
import { aiInput, aiOutput, aiPlan } from "./ai-fixtures";
import { DEFAULT_MASTER_PROMPT, type MenuJob } from "../src/ai/contracts";
const records = new Map<string, { data: unknown; etag: string }>();
let sequence = 0;
const code = "test-only-family-access-code";
const id = "20000000-0000-4000-8000-000000000001";
const body = {
  action: "generate",
  id,
  input: aiInput,
  masterPrompt: DEFAULT_MASTER_PROMPT,
  recentMeals: [],
};
function req(payload?: unknown, token = code, query = "") {
  return new Request(
    "https://example.test/.netlify/functions/ai-menu" + query,
    {
      method: payload ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    },
  );
}
beforeEach(() => {
  records.clear();
  sequence = 0;
  vi.clearAllMocks();
  vi.stubEnv("FAMILY_ACCESS_CODE", code);
  vi.stubEnv("GEMINI_API_KEY", "test-only-gemini-key");
  vi.stubEnv("AI_MAX_DAILY_REQUESTS", "3");
  blob.get.mockImplementation(async (key: string) =>
    structuredClone(records.get(key)?.data ?? null),
  );
  blob.getWithMetadata.mockImplementation(async (key: string) => {
    const row = records.get(key);
    return row ? structuredClone(row) : null;
  });
  blob.setJSON.mockImplementation(
    async (
      key: string,
      data: unknown,
      options?: { onlyIfNew?: boolean; onlyIfMatch?: string },
    ) => {
      const previous = records.get(key);
      if (
        (options?.onlyIfNew && previous) ||
        (options?.onlyIfMatch && previous?.etag !== options.onlyIfMatch)
      )
        return { modified: false };
      const etag = String(++sequence);
      records.set(key, { data: structuredClone(data), etag });
      return { modified: true, etag };
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 202 })),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("protected AI jobs", () => {
  it("requires family authorization and does not expose the provider key", async () => {
    expect((await api(req(undefined, "bad"))).status).toBe(401);
    const r = await api(req());
    const data = await r.json();
    expect(data.configured).toBe(true);
    expect(JSON.stringify(data)).not.toContain("test-only-gemini-key");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await api(req(body))).status).toBe(503);
  });
  it("uses CAS for shared master prompts", async () => {
    const first = await (
      await api(
        req({
          action: "settings",
          masterPrompt: "Family preferences",
          revision: null,
        }),
      )
    ).json();
    expect(first.masterPrompt).toBe("Family preferences");
    expect(
      (
        await api(
          req({
            action: "settings",
            masterPrompt: "Changed elsewhere",
            revision: null,
          }),
        )
      ).status,
    ).toBe(409);
  });
  it("creates a recoverable background job and deduplicates repeat submissions", async () => {
    expect((await api(req(body))).status).toBe(202);
    expect((await api(req(body))).status).toBe(202);
    expect(fetch).toHaveBeenCalledTimes(1);
    const data = await (await api(req(undefined, code, "?job=" + id))).json();
    expect(data.status).toBe("queued");
    expect(data.input.equipment).toEqual(aiInput.equipment);
    expect(data.revision).toBeTruthy();
    expect((await (await api(req())).json()).latestJob).toBe(id);
  });
  it("limits concurrent submissions atomically across function instances", async () => {
    vi.stubEnv("AI_MAX_DAILY_REQUESTS", "1");
    const results = await Promise.all([
      api(req(body)),
      api(req({ ...body, id: "20000000-0000-4000-8000-000000000002" })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([202, 429]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("saves edited drafts with a revision and rejects stale writes", async () => {
    const job: MenuJob = {
      id,
      status: "ready",
      input: aiInput,
      masterPrompt: DEFAULT_MASTER_PROMPT,
      recentMeals: [],
      createdAt: new Date().toISOString(),
      plan: aiPlan(),
    };
    await blob.setJSON("jobs/" + id, job);
    const initial = await (
      await api(req(undefined, code, "?job=" + id))
    ).json();
    const plan = aiPlan();
    plan.meals[0].main = "My edited breakfast";
    const save = { action: "draft", id, revision: initial.revision, plan };
    expect((await api(req(save))).status).toBe(200);
    expect((await api(req(save))).status).toBe(409);
    expect(
      (records.get("jobs/" + id)!.data as MenuJob).plan?.meals[0].main,
    ).toBe("My edited breakfast");
  });
  it("reports blocked dispatch and overdue jobs without replacing any current plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    expect((await api(req(body))).status).toBe(503);
    expect((records.get("jobs/" + id)!.data as MenuJob).errorCode).toBe(
      "dispatch_failed",
    );
    const stale: MenuJob = {
      id,
      status: "running",
      createdAt: "2020-01-01T00:00:00Z",
      input: aiInput,
      masterPrompt: DEFAULT_MASTER_PROMPT,
      recentMeals: [],
    };
    await blob.setJSON("jobs/" + id, stale);
    expect(
      (await (await api(req(undefined, code, "?job=" + id))).json()).errorCode,
    ).toBe("timeout");
  });
  it("rejects invalid equipment choices and excessive input", async () => {
    expect(
      (await api(req({ ...body, input: { ...aiInput, equipment: [] } })))
        .status,
    ).toBe(400);
    expect(
      (
        await api(
          req({
            ...body,
            input: { ...aiInput, customPrompt: "x".repeat(50000) },
          }),
        )
      ).status,
    ).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe("Gemini background execution", () => {
  it("stores a bilingual draft once and never changes family state", async () => {
    await api(req(body));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
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
    await background(req({ id }));
    await background(req({ id }));
    const job = records.get("jobs/" + id)!.data as MenuJob;
    expect(job.status).toBe("ready");
    expect(job.plan?.translations?.vi).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(records.has("state.json")).toBe(false);
  });
  it("persists quota errors instead of storing a partial menu", async () => {
    await api(req(body));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    );
    await background(req({ id }));
    const job = records.get("jobs/" + id)!.data as MenuJob;
    expect(job.status).toBe("failed");
    expect(job.errorCode).toBe("quota");
    expect(job.plan).toBeUndefined();
  });
});
