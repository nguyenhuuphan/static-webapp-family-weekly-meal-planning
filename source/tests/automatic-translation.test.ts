import { afterEach, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
afterEach(() => {
  vi.unstubAllGlobals();
});
it("deduplicates requests and reuses translated text", async () => {
  vi.resetModules();
  const { automaticContent } = await import("../src/i18n/automatic");
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ translation: "Súp gà" }));
  vi.stubGlobal("fetch", fetcher);
  expect(automaticContent("Chicken soup", "vi")).toBe("Chicken soup");
  automaticContent("Chicken soup", "vi");
  await waitFor(() =>
    expect(automaticContent("Chicken soup", "vi")).toBe("Súp gà"),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("retains original content after provider failure without repeated quota requests", async () => {
  vi.resetModules();
  const { automaticContent } = await import("../src/i18n/automatic");
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  automaticContent("Chicken soup", "vi");
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(automaticContent("Chicken soup", "vi")).toBe("Chicken soup");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("chunks long content within the provider limit without splitting quantity tokens", async () => {
  vi.resetModules();
  const { automaticContent } = await import("../src/i18n/automatic");
  const source = "Use [300 g] chicken and [2 tsp] salt. ".repeat(30);
  const fetcher = vi.fn(async (_url, init) =>
    Response.json({ translation: JSON.parse(init.body).text }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(automaticContent(source, "vi")).toBe(source);
  await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(1));
  const requests = fetcher.mock.calls.map(
    ([, init]) => JSON.parse(init.body).text as string,
  );
  expect(
    requests.every((part) => new TextEncoder().encode(part).length <= 500),
  ).toBe(true);
  expect(
    requests.every(
      (part) =>
        (part.match(/\[/g) || []).length === (part.match(/\]/g) || []).length,
    ),
  ).toBe(true);
  expect(automaticContent(source, "vi")).toBe(source);
});
