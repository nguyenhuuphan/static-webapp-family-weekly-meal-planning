// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import plan from "../public/meal-plan.json";
import { freshState } from "../src/domain";
import type { Plan } from "../src/types";
const blob = vi.hoisted(() => ({
  getWithMetadata: vi.fn(),
  setJSON: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@netlify/blobs", () => ({ getStore: () => blob }));
import family from "../netlify/functions/family-plan";
import translate from "../netlify/functions/translate";
const code = "test-only-family-access-code";
const state = freshState(plan as Plan);
function request(method = "GET", body?: unknown, token = code) {
  return new Request("https://meals.example/.netlify/functions/family-plan", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.stubEnv("FAMILY_ACCESS_CODE", code);
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("shared family JSON", () => {
  it("denies missing/incorrect codes and cross-origin writes", async () => {
    expect((await family(request("GET", undefined, "wrong"))).status).toBe(401);
    const r = request("PUT", { state, revision: null });
    r.headers.set("Origin", "https://elsewhere.example");
    expect((await family(r)).status).toBe(403);
    expect(blob.setJSON).not.toHaveBeenCalled();
  });
  it("requires a long server-side secret", async () => {
    vi.stubEnv("FAMILY_ACCESS_CODE", "short");
    expect((await family(request())).status).toBe(503);
  });
  it("reads stored state and creates a first copy atomically", async () => {
    blob.getWithMetadata.mockResolvedValue({ data: state, etag: "v1" });
    expect(await (await family(request())).json()).toEqual({
      state,
      revision: "v1",
    });
    blob.setJSON.mockResolvedValue({ modified: true, etag: "v2" });
    expect(
      (await family(request("PUT", { state, revision: null }))).status,
    ).toBe(200);
    expect(blob.setJSON).toHaveBeenCalledWith("state.json", state, {
      onlyIfNew: true,
    });
  });
  it("never overwrites another device's newer revision", async () => {
    blob.setJSON.mockResolvedValue({ modified: false });
    expect(
      (await family(request("PUT", { state, revision: "old" }))).status,
    ).toBe(409);
    expect(blob.setJSON).toHaveBeenCalledWith("state.json", state, {
      onlyIfMatch: "old",
    });
  });
  it("rejects invalid and oversized JSON", async () => {
    expect(
      (await family(request("PUT", { state: {}, revision: null }))).status,
    ).toBe(400);
    expect((await family(request("PUT", { state, revision: 3 }))).status).toBe(
      400,
    );
    expect(
      (await family(request("PUT", { padding: "x".repeat(1_000_000) }))).status,
    ).toBe(413);
    expect(blob.setJSON).not.toHaveBeenCalled();
  });
});
describe("free content translation", () => {
  const translateRequest = (text: string, target = "vi") =>
    new Request("https://meals.example/.netlify/functions/translate", {
      method: "POST",
      body: JSON.stringify({ text, target }),
    });
  it("reuses cached translations without spending provider quota", async () => {
    blob.get.mockResolvedValueOnce({ translation: "Súp gà" });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      await (await translate(translateRequest("Chicken soup"))).json(),
    ).toEqual({ translation: "Súp gà" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("translates English and Vietnamese through the fixed provider", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        responseStatus: 200,
        responseData: { translatedText: "Súp gà" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await (await translate(translateRequest("Chicken soup"))).json(),
    ).toEqual({ translation: "Súp gà" });
    expect(String(fetcher.mock.calls[0][0])).toContain("langpair=en%7Cvi");
    fetcher.mockResolvedValue(
      Response.json({
        responseStatus: 200,
        responseData: { translatedText: "Chicken soup" },
      }),
    );
    expect((await translate(translateRequest("Súp gà", "en"))).status).toBe(
      200,
    );
    expect(String(fetcher.mock.calls[1][0])).toContain("langpair=vi%7Cen");
  });
  it("does not call the provider for same-language text or unsupported targets", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await translate(translateRequest("Chicken soup", "en"))).status,
    ).toBe(200);
    expect(
      (await translate(translateRequest("Chicken soup", "fr"))).status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects exhausted quotas and changed quantities", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          responseStatus: 200,
          responseData: { translatedText: "Nấu 99 phút" },
        }),
      ),
    );
    expect((await translate(translateRequest("Cook 10 minutes"))).status).toBe(
      503,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          responseStatus: 429,
          quotaFinished: true,
          responseData: { translatedText: "LIMIT REACHED" },
        }),
      ),
    );
    expect((await translate(translateRequest("Chicken soup"))).status).toBe(
      503,
    );
  });
  it("preserves instruction quantity tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          responseStatus: 200,
          responseData: { translatedText: "Dùng [300 g] thịt gà" },
        }),
      ),
    );
    expect(
      (await translate(translateRequest("Use [300 g] chicken"))).status,
    ).toBe(200);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          responseStatus: 200,
          responseData: { translatedText: "Dùng 300 g thịt gà" },
        }),
      ),
    );
    expect(
      (await translate(translateRequest("Use [300 g] chicken"))).status,
    ).toBe(503);
  });
});
