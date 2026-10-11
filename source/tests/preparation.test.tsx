import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../src/App";
import data from "../public/meal-plan.json";
import type { Plan } from "../src/types";
import { groupPreparation } from "../src/helpers/preparation";
import { STORAGE_KEY } from "../src/domain";
import { freshState, isPrepared } from "../src/domain";
import { isCookingPreparation } from "../src/helpers/preparation";

const plan = data as Plan;
describe("ingredient preparation groups", () => {
  it("combines compatible cuts and preserves every original checklist key", () => {
    const groups = groupPreparation(plan, 2);
    for (const name of [
      "Pork shoulder, boneless",
      "Chicken thigh, boneless",
      "Beef, stir-fry cut",
    ]) {
      const group = groups.find((item) => item.ingredient === name)!;
      expect(group.quantity).toBe(600);
      expect(group.allocations.map((item) => item.quantity)).toEqual([
        300, 300,
      ]);
    }
    expect(
      groups.filter((item) => item.ingredient === "Cabbage, trimmed"),
    ).toHaveLength(2);
    const keys = groups.flatMap((item) =>
      item.allocations.map((item) => item.key),
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(
      plan.meals
        .flatMap((meal) => meal.prep.map((_, index) => `${meal.id}:${index}`))
        .sort(),
    );
  });
  it("scales totals and portions without modifying the plan", () => {
    const before = JSON.stringify(plan);
    const group = groupPreparation(plan, 3).find(
      (item) => item.ingredient === "Pork shoulder, boneless",
    )!;
    expect(group.quantity).toBe(900);
    expect(group.allocations.map((item) => item.quantity)).toEqual([450, 450]);
    expect(JSON.stringify(plan)).toBe(before);
  });
  it("keeps edited instructions and changed quantities separate", () => {
    const edited = structuredClone(plan);
    edited.meals[0].prep[0].text = "Cut pork into large cubes.";
    let groups = groupPreparation(edited, 2);
    expect(
      groups.find((item) => item.ingredient === "Pork shoulder, boneless")
        ?.quantity,
    ).toBe(300);
    expect(
      groups.find((item) => item.key === "individual:mon-lunch:0")?.operation,
    ).toBe("reviewIndividually");
    edited.meals[0].prep[0].text = plan.meals[0].prep[0].text;
    edited.meals[0].ingredients.find(
      (item) => item.name === "Pork shoulder, boneless",
    )!.qty = 500;
    groups = groupPreparation(edited, 2);
    expect(
      groups.find((item) => item.key === "individual:mon-lunch:0"),
    ).toBeTruthy();
  });
  it("supports bulk progress and hover, click and Escape meal details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => structuredClone(plan),
      })),
    );
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<App />);
    await screen.findByRole("heading", {
      name: "A little planning. A lot more ease.",
    });
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Prep Day",
      }),
    );
    const group = screen.getByRole("region", {
      name: "Pork shoulder, boneless",
    });
    const vegetables = screen.getByRole("region", {
      name: "Vegetables & herbs",
    });
    const proteins = screen.getByRole("region", {
      name: "Meat, seafood & eggs",
    });
    fireEvent.click(
      within(proteins).getByRole("button", {
        name: "Collapse: Meat, seafood & eggs",
      }),
    );
    expect(
      within(proteins).queryByRole("region", {
        name: "Pork shoulder, boneless",
      }),
    ).toBeNull();
    expect(within(vegetables).getAllByRole("checkbox").length).toBeGreaterThan(
      0,
    );
    fireEvent.click(
      within(proteins).getByRole("button", {
        name: "Expand: Meat, seafood & eggs",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(
      within(proteins)
        .getByRole("button", { name: "Collapse: Meat, seafood & eggs" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen.queryByRole("region", { name: "Seasonings & sauces" }),
    ).toBeNull();
    expect(
      within(proteins).getByRole("region", { name: "Pork shoulder, boneless" }),
    ).toBe(group);
    expect(
      within(vegetables).queryByRole("region", {
        name: "Pork shoulder, boneless",
      }),
    ).toBeNull();
    fireEvent.click(
      within(vegetables).getByRole("button", {
        name: "Complete category: Vegetables & herbs",
      }),
    );
    expect(
      within(vegetables)
        .getAllByRole("checkbox")
        .every((input) => (input as HTMLInputElement).checked),
    ).toBe(true);
    expect(
      within(proteins)
        .getAllByRole("checkbox")
        .some((input) => (input as HTMLInputElement).checked),
    ).toBe(false);
    expect(within(group).getByText("600")).toBeTruthy();
    const all = within(group).getByRole("checkbox", {
      name: "Mark all portions prepared: Pork shoulder, boneless",
    });
    fireEvent.click(all);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.progress.prep["mon-lunch:0"]).toBe(true);
    expect(saved.progress.prep["thu-dinner:0"]).toBe(true);
    fireEvent.click(
      within(group).getByRole("checkbox", { name: "Monday Lunch prep 1" }),
    );
    expect((all as HTMLInputElement).indeterminate).toBe(true);
    const trigger = within(group).getAllByRole("button", {
      name: /Meal details:/,
    })[0];
    fireEvent.mouseEnter(trigger.parentElement!);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const details = within(group).getByRole("region", {
      name: /Meal details:/,
    });
    expect(
      within(details).getByRole("heading", { name: "Ingredients" }),
    ).toBeTruthy();
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Cook",
      }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Prepare sauces & seasonings before cooking",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/no advance preparation is needed/)).toBeTruthy();
  });
  it("excludes cooking-only seasonings from preparation readiness but keeps edited instructions", () => {
    const state = freshState(structuredClone(plan));
    const meal = state.plan.meals[0];
    meal.prep.forEach((_, index) => {
      if (!isCookingPreparation(meal, index))
        state.progress.prep[`${meal.id}:${index}`] = true;
    });
    expect(isPrepared(state, meal)).toBe(true);
    const index = meal.prep.findIndex((_, index) =>
      isCookingPreparation(meal, index),
    );
    meal.prep[index].text = "A new instruction requiring advance preparation.";
    expect(isPrepared(state, meal)).toBe(false);
  });
});
