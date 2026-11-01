import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { fireEvent } from "./userEvents";
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
  // These fixtures exercise Monday lunch independently of today's weekday.
  if (!localStorage.getItem("planner:selected"))
    localStorage.setItem("planner:selected", "mon-lunch");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
  if (initial) localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  render(<App />);
  await screen.findByRole("heading", {
    name: "Family meal plan",
  });
}
const nav = async (name: string) =>
  await fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name }),
  );
describe("React feature parity", () => {
  it("exports JSON without backend calls", async () => {
    await boot();
    await nav("Settings");
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
    await fireEvent.click(
      screen.getByRole("button", { name: "Download backup" }),
    );
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });
  it("copies a recipe pair and resets stale prep data", async () => {
    const s = freshState(plan);
    s.progress.prep["mon-lunch:0"] = true;
    await boot(s);
    await fireEvent.click(
      screen.getByRole("button", { name: "Edit Monday Lunch" }),
    );
    await fireEvent.change(screen.getByLabelText("Recipe pair to copy"), {
      target: { value: "tue-lunch" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Replace pair" }));
    await screen.findByRole("heading", {
      name: "Family meal plan",
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
    ).toHaveLength(11);
    await nav("Shopping");
    await fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("500 g")).toBeTruthy();
    await fireEvent.click(
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
    await fireEvent.click(
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
    await nav("Prep Day");
    await fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    const first = screen.getByRole("checkbox", { name: "Monday Lunch prep 1" });
    await fireEvent.click(first);
    expect((first as HTMLInputElement).checked).toBe(true);
    await fireEvent.click(first);
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
    await nav("Cook");
    await fireEvent.click(
      screen.getByRole("button", { name: "Start timer for step 3" }),
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEY)!).timer.end,
      ).toBeGreaterThan(Date.now()),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).timer.step).toBe(2);
    await fireEvent.click(
      screen.getByRole("button", { name: "Dismiss timer" }),
    );
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(
      document.querySelectorAll(".cooking-instructions > li"),
    ).toHaveLength(plan.meals[0].steps.length);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).timer).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Finish meal" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await fireEvent.click(screen.getByRole("checkbox", { name: /I checked:/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Finish meal" }));
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
    await fireEvent.click(
      screen.getByRole("button", { name: "Edit Monday Lunch" }),
    );
    const name = screen.getByLabelText("Main dish");
    await fireEvent.change(name, { target: { value: "Family garlic pork" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
    await screen.findByRole("heading", { name: "Family garlic pork" });
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).progress.done["mon-lunch"],
    ).toBeUndefined();
  });
  it("scales servings and supports week/progress reset and restoring defaults", async () => {
    await boot();
    await nav("Settings");
    await fireEvent.change(
      screen.getByRole("spinbutton", { name: "People per meal" }),
      { target: { value: "4" } },
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).servings).toBe(2);
    await fireEvent.click(
      screen.getByRole("button", { name: "Apply servings" }),
    );
    await nav("Shopping");
    expect(
      screen.getByText(`${new Intl.NumberFormat("en-GB").format(1000)} g`),
    ).toBeTruthy();
    await nav("Settings");
    await fireEvent.click(
      screen.getByRole("button", { name: "Restore original menu" }),
    );
    await screen.findByRole("heading", {
      name: "Family meal plan",
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).servings).toBe(2);
  });
  it("validates advanced JSON instead of accepting malformed plans", async () => {
    await boot();
    await nav("Settings");
    await fireEvent.click(
      screen.getByRole("button", { name: "Advanced JSON" }),
    );
    await fireEvent.change(screen.getByLabelText("Meal-plan JSON"), {
      target: { value: '{"schemaVersion":999}' },
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Validate & save" }),
    );
    expect(screen.getByRole("alert").textContent).toContain("schemaVersion");
  });
  it("imports a v1 backup into the React UI", async () => {
    await boot();
    await nav("Settings");
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify({ plan, servings: 3 }),
    });
    await fireEvent.change(screen.getByLabelText("Choose backup to restore"), {
      target: { files: [file] },
    });
    await fireEvent.click(
      await screen.findByRole("button", { name: "Restore this backup" }),
    );
    await screen.findByRole("heading", {
      name: "Family meal plan",
    });
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).servings).toBe(3),
    );
  });
});
