import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { fetchMealPlan } from "../src/services/mealPlanService";
import { STORAGE_KEY } from "../src/domain";
import { workerSource } from "../build/offline";
it("boots saved data without requiring a network fetch and has a bundled first-load fallback", async () => {
  const request = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", request);
  localStorage.setItem(STORAGE_KEY, "{}");
  expect((await fetchMealPlan()).meals).toHaveLength(10);
  expect(request).not.toHaveBeenCalled();
  localStorage.clear();
  expect((await fetchMealPlan()).meals).toHaveLength(10);
});
it("serves cached pages offline and activates new workers without reloading clients", async () => {
  const events: Record<string, (event: any) => void> = {},
    stored = new Map<string, string>();
  const skipWaiting = vi.fn(),
    network = vi.fn().mockRejectedValue(new Error("offline"));
  const cache = {
    addAll: async (requests: { url: string }[]) =>
      requests.forEach((request) =>
        stored.set(request.url, "cached:" + request.url),
      ),
    match: async (key: string) => stored.get(key),
  };
  runInNewContext(
    workerSource("v1", ["index.html", "assets/app.js", "meal-plan.json"]),
    {
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
        open: async () => cache,
        keys: async () => [],
        delete: vi.fn(),
      },
      URL,
      Request: class {
        url: string;
        constructor(url: string) {
          this.url = url;
        }
      },
      fetch: network,
    },
  );
  let work: Promise<unknown> = Promise.resolve();
  events.install({
    waitUntil: (promise: Promise<unknown>) => {
      work = promise;
    },
  });
  await work;
  expect(skipWaiting).toHaveBeenCalledOnce();
  events.fetch({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/meals/?view=cook",
    },
    respondWith: (promise: Promise<unknown>) => {
      work = promise;
    },
  });
  expect(await work).toBe("cached:https://example.test/meals/index.html");
  events.fetch({
    request: { method: "GET", url: "https://example.test/meals/assets/app.js" },
    respondWith: (promise: Promise<unknown>) => {
      work = promise;
    },
  });
  expect(await work).toBe("cached:https://example.test/meals/assets/app.js");
  expect(network).toHaveBeenCalledOnce();
  events.message({ data: "ACTIVATE_UPDATE" });
  expect(skipWaiting).toHaveBeenCalledTimes(2);
});

it("fetches current HTML online and leaves function requests uncached", async () => {
  const events: Record<string, (event: any) => void> = {};
  const response = { ok: true, redirected: false, body: "new deployment" };
  const network = vi.fn().mockResolvedValue(response);
  const match = vi.fn().mockResolvedValue("old page");
  runInNewContext(workerSource("v2", ["index.html", "assets/app.js"]), {
    self: {
      registration: { scope: "https://example.test/" },
      location: { origin: "https://example.test" },
      addEventListener: (name: string, fn: any) => {
        events[name] = fn;
      },
    },
    caches: { open: async () => ({ match }) },
    URL,
    fetch: network,
  });
  const respondWith = vi.fn();
  events.fetch({
    request: { method: "GET", mode: "navigate", url: "https://example.test/" },
    respondWith,
  });
  expect(await respondWith.mock.calls[0][0]).toBe(response);
  expect(match).not.toHaveBeenCalled();
  respondWith.mockClear();
  events.fetch({
    request: {
      method: "GET",
      url: "https://example.test/.netlify/functions/family-plan",
    },
    respondWith,
  });
  expect(respondWith).not.toHaveBeenCalled();
  events.fetch({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/?sign-in=1",
    },
    respondWith,
  });
  expect(respondWith).not.toHaveBeenCalled();
  events.fetch({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/cdn-cgi/access/login",
    },
    respondWith,
  });
  expect(respondWith).not.toHaveBeenCalled();
});
