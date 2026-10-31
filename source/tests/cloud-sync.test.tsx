import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App";
import plan from "../public/meal-plan.json";
import { freshState, STORAGE_KEY } from "../src/domain";
import type { Plan } from "../src/types";
const code = "test-only-family-access-code";
function openSync() {
  fireEvent.click(screen.getByText("Family sync"));
  fireEvent.change(screen.getByLabelText("Family access code"), {
    target: { value: code },
  });
}
async function boot(handler: (init?: RequestInit) => Response) {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const fetcher = vi.fn(async (url: string, init?: RequestInit) =>
    url.includes("family-plan") ? handler(init) : Response.json(plan),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  await screen.findByRole("navigation");
  openSync();
  return fetcher;
}
describe("family sync UI", () => {
  it("explicitly opens cloud data and sends later edits using the fetched revision", async () => {
    const shared = freshState(plan as Plan);
    shared.servings = 5;
    const fetcher = await boot((init) =>
      init?.method === "PUT"
        ? Response.json({ revision: "v2" })
        : Response.json({ state: shared, revision: "v1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open shared data" }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).servings).toBe(5),
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "People per meal" }),
      { target: { value: "6" } },
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Apply servings" }));
    await waitFor(
      () =>
        expect(
          fetcher.mock.calls.some(
            ([url, init]) =>
              url.includes("family-plan") && init?.method === "PUT",
          ),
        ).toBe(true),
      { timeout: 4000 },
    );
    const put = fetcher.mock.calls.find(
      ([, init]) => init?.method === "PUT",
    )![1]!;
    expect(JSON.parse(put.body as string)).toMatchObject({
      revision: "v1",
      state: { servings: 6 },
    });
    expect(put.headers).toMatchObject({ Authorization: `Bearer ${code}` });
  });
  it("receives later changes from another device while idle", async () => {
    const shared = freshState(plan as Plan);
    let remote = { state: shared, revision: "v1" };
    await boot(() => Response.json(remote));
    fireEvent.click(screen.getByRole("button", { name: "Open shared data" }));
    await screen.findByText("Synced.");
    remote = { state: { ...shared, servings: 7 }, revision: "v2" };
    await waitFor(
      () =>
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).servings).toBe(7),
      { timeout: 4000 },
    );
  });
  it("retains local data when first sharing conflicts with an existing family copy", async () => {
    await boot(() => Response.json({ error: "Conflict" }, { status: 409 }));
    const before = localStorage.getItem(STORAGE_KEY);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Share current copy for the first time",
      }),
    );
    await screen.findByText(/A different copy was saved/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
  it("connects with Enter and keeps the compact controls accessible after connecting", async () => {
    const shared = freshState(plan as Plan);
    await boot(() => Response.json({ state: shared, revision: "v1" }));
    const toggle = screen.getByRole("button", { name: "Family sync" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(screen.getByLabelText("Family access code"), {
      key: "Enter",
    });
    await screen.findByText("Synced.");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });
});
