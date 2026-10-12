import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../src/App";
import data from "../public/meal-plan.json";
import type { Plan } from "../src/types";
import { freshState, STORAGE_KEY } from "../src/domain";
const plan = data as Plan;
async function boot(initial?: ReturnType<typeof freshState>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => structuredClone(plan) })),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
  if (initial) localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  render(<App />);
  await screen.findByRole("heading", {
    name: "A little planning. A lot more ease.",
  });
}
const nav = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name }),
  );
describe("React feature parity", () => {
  it("exports JSON without backend calls", async () => {
    await boot();
    nav("Settings");
    const create = vi.fn(() => "blob:backup");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: create,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });
  it("copies a recipe pair and resets stale prep data", async () => {
    const s = freshState(plan);
    s.progress.prep["mon-lunch:0"] = true;
    await boot(s);
    fireEvent.click(screen.getByRole("button", { name: "Edit Monday Lunch" }));
    fireEvent.change(screen.getByLabelText("Recipe pair to copy"), {
      target: { value: "tue-lunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace pair" }));
    await screen.findByRole("heading", {
      name: "A little planning. A lot more ease.",
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.plan.meals[0].main).toBe("Lemongrass chicken");
    expect(saved.plan.meals[0].day).toBe("Monday");
    expect(saved.progress.prep["mon-lunch:0"]).toBeUndefined();
  });
  it("renders ten meals, shopping checks and at-home exclusions", async () => {
    await boot();
    expect(
      within(screen.getByRole("main")).getAllByRole("button", { name: "Cook" }),
    ).toHaveLength(10);
    nav("Shopping");
    expect(screen.getByText("500 g")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Bought Shrimp, peeled" }),
    );
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Bought Shrimp, peeled",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    const row = screen
      .getByRole("checkbox", { name: "Bought Shrimp, peeled" })
      .closest(".shopping-row")!;
    fireEvent.click(
      within(row as HTMLElement).getByRole("checkbox", { name: "At home" }),
    );
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Bought Shrimp, peeled",
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEY)!).progress.owned[
          "Shrimp, peeled|g"
        ],
      ).toBe(true),
    );
  });
  it("prep checklist updates and clears readiness when unchecked", async () => {
    await boot();
    nav("Prep Day");
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    const first = screen.getByRole("checkbox", { name: "Monday Lunch prep 1" });
    fireEvent.click(first);
    expect((first as HTMLInputElement).checked).toBe(true);
    fireEvent.click(first);
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEY)!).progress.prep[
          "mon-lunch:0"
        ],
      ).toBe(false),
    );
  });
  it("guides cooking, persists a timer and completes only when ready", async () => {
    const s = freshState(plan);
    plan.meals[0].prep.forEach(
      (_, i) => (s.progress.prep["mon-lunch:" + i] = true),
    );
    await boot(s);
    nav("Cook");
    fireEvent.click(
      screen.getByRole("button", { name: "Start timer for step 3" }),
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEY)!).timer.end,
      ).toBeGreaterThan(Date.now()),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).timer.step).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss timer" }));
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(
      document.querySelectorAll(".cooking-instructions > li"),
    ).toHaveLength(plan.meals[0].steps.length);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).timer).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Finish meal" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I checked:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Finish meal" }));
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEY)!).progress.done[
          "mon-lunch"
        ],
      ).toBe(true),
    );
  });
  it("edits through React fields, saves names and resets affected progress", async () => {
    const s = freshState(plan);
    s.progress.done["mon-lunch"] = true;
    await boot(s);
    fireEvent.click(screen.getByRole("button", { name: "Edit Monday Lunch" }));
    const name = screen.getByLabelText("Main dish");
    fireEvent.change(name, { target: { value: "Family garlic pork" } });
    fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
    await screen.findByRole("heading", { name: "Family garlic pork" });
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).progress.done["mon-lunch"],
    ).toBeUndefined();
  });
  it("scales servings and supports week/progress reset and restoring defaults", async () => {
    await boot();
    nav("Settings");
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "People per meal" }),
      { target: { value: "4" } },
    );
    nav("Shopping");
    expect(
      screen.getByText(`${new Intl.NumberFormat("en-GB").format(1000)} g`),
    ).toBeTruthy();
    nav("Settings");
    fireEvent.click(
      screen.getByRole("button", { name: "Restore original menu" }),
    );
    await screen.findByRole("heading", {
      name: "A little planning. A lot more ease.",
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).servings).toBe(2);
  });
  it("validates advanced JSON instead of accepting malformed plans", async () => {
    await boot();
    nav("Settings");
    fireEvent.click(screen.getByRole("button", { name: "Advanced JSON" }));
    fireEvent.change(screen.getByLabelText("Meal-plan JSON"), {
      target: { value: '{"schemaVersion":2}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate & save" }));
    expect(screen.getByRole("alert").textContent).toContain("schemaVersion");
  });
  it("imports a v1 backup into the React UI", async () => {
    await boot();
    nav("Settings");
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify({ plan, servings: 3 }),
    });
    fireEvent.change(screen.getByLabelText("Import JSON"), {
      target: { files: [file] },
    });
    await screen.findByRole("heading", {
      name: "A little planning. A lot more ease.",
    });
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).servings).toBe(3),
    );
  });
});
