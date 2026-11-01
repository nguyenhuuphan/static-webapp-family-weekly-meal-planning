import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { fetchMealPlan } from "../src/services/mealPlanService";
import { STORAGE_KEY } from "../src/domain";
import { workerSource } from "../build/offline";
function worker(network = vi.fn().mockRejectedValue(Error("offline"))) {
  const events: Record<string, (event: any) => void> = {};
  const stored = new Map<string, Response>();
  const skipWaiting = vi.fn();
  const requests: Request[] = [];
  const match = vi.fn(async (key: string) => stored.get(key));
  runInNewContext(workerSource("v3", ["index.html", "assets/app.js"]), {
    self: {
      registration: { scope: "https://example.test/meals/" },
      location: { origin: "https://example.test" },
      addEventListener: (name: string, fn: any) => {
        events[name] = fn;
      },
      skipWaiting,
      clients: { claim: vi.fn() },
    },
    caches: {
      open: async () => ({
        addAll: async (entries: Request[]) => {
          requests.push(...entries);
          entries.forEach((request) =>
            stored.set(request.url, new Response("cached:" + request.url)),
          );
        },
        match,
      }),
      keys: async () => [],
      delete: vi.fn(),
    },
    URL,
    Request,
    Response,
    fetch: network,
  });
  return {
    network,
    stored,
    events,
    skipWaiting,
    requests,
    match,
    async install() {
      let work!: Promise<unknown>;
      events.install({
        waitUntil: (value: Promise<unknown>) => {
          work = value;
        },
      });
      await work;
    },
    async get(url = "https://example.test/meals/", mode = "navigate") {
      const respondWith = vi.fn();
      events.fetch({ request: { method: "GET", url, mode }, respondWith });
      return respondWith.mock.calls[0]?.[0] as Promise<Response> | undefined;
    },
  };
}
it("boots saved data without a network fetch and has a bundled first-load fallback", async () => {
  const request = vi.fn().mockRejectedValue(Error("offline"));
  vi.stubGlobal("fetch", request);
  localStorage.setItem(STORAGE_KEY, "{}");
  expect((await fetchMealPlan()).meals).toHaveLength(10);
  expect(request).not.toHaveBeenCalled();
  localStorage.clear();
  expect((await fetchMealPlan()).meals).toHaveLength(10);
});
it("keeps offline pages and assets readable while precaching refuses redirected login pages", async () => {
  const w = worker();
  await w.install();
  expect(w.skipWaiting).toHaveBeenCalledOnce();
  expect(w.requests.every((request) => request.redirect === "error")).toBe(
    true,
  );
  expect(
    await (await w.get("https://example.test/meals/?view=cook"))!.text(),
  ).toBe("cached:https://example.test/meals/index.html");
  expect(
    await (await w.get(
      "https://example.test/meals/assets/app.js",
      "cors",
    ))!.text(),
  ).toBe("cached:https://example.test/meals/assets/app.js");
  expect(w.network).toHaveBeenCalledOnce();
  w.events.message({ data: "ACTIVATE_UPDATE" });
  expect(w.skipWaiting).toHaveBeenCalledTimes(2);
});
it("serves fresh HTML with no redirect history and leaves APIs and sign-in navigations to the browser", async () => {
  const network = vi.fn().mockResolvedValue(new Response("current deployment"));
  const w = worker(network);
  const response = await w.get();
  expect(await response!.text()).toBe("current deployment");
  expect(response!.redirected).toBe(false);
  expect(network).toHaveBeenCalledWith(expect.anything(), {
    redirect: "manual",
  });
  expect(w.match).not.toHaveBeenCalled();
  for (const path of [
    "api/v1/planner",
    ".netlify/functions/family-plan",
    "?sign-in=1",
    "cdn-cgi/access/login",
  ]) {
    const url = "https://example.test/" + path;
    expect(await w.get(url)).toBeUndefined();
  }
  expect(await w.get("https://example.test/meals/?sign-in=1")).toBeUndefined();
});
for (const kind of ["followed", "opaque", "302", "401", "403"]) {
  it(`handles ${kind} authentication responses through a native sign-in navigation`, async () => {
    const response =
      kind === "302"
        ? Response.redirect("https://access.example/login")
        : new Response("Access", {
            status: kind === "401" ? 401 : kind === "403" ? 403 : 200,
          });
    if (kind === "followed")
      Object.defineProperty(response, "redirected", { value: true });
    if (kind === "opaque")
      Object.defineProperty(response, "type", { value: "opaqueredirect" });
    const w = worker(vi.fn().mockResolvedValue(response));
    const result = await w.get("https://example.test/meals/?view=prep");
    expect(result!.status).toBe(302);
    expect(result!.redirected).toBe(false);
    expect(result!.headers.get("Location")).toBe(
      "https://example.test/meals/?view=prep&sign-in=1",
    );
    expect(w.match).not.toHaveBeenCalled();
  });
}
it("refuses redirected HTML left in a legacy cache and never falls through to a followed fetch", async () => {
  const w = worker();
  const poisoned = new Response("Access login page");
  Object.defineProperty(poisoned, "redirected", { value: true });
  w.stored.set("https://example.test/meals/index.html", poisoned);
  const result = await w.get();
  expect(result!.status).toBe(503);
  expect(await result!.text()).not.toContain("Access login page");
  expect(w.network).toHaveBeenCalledOnce();
});
it("does not serve a cached login response as a JavaScript asset", async () => {
  const network = vi.fn().mockResolvedValue(new Response("actual script"));
  const w = worker(network);
  const poisoned = new Response("Access login");
  Object.defineProperty(poisoned, "redirected", { value: true });
  w.stored.set("https://example.test/meals/assets/app.js", poisoned);
  const result = await w.get(
    "https://example.test/meals/assets/app.js",
    "cors",
  );
  expect(await result!.text()).toBe("actual script");
  expect(network).toHaveBeenCalledWith(expect.anything(), {
    redirect: "error",
  });
});
