import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "../src/i18n";
import {
  MealPlannerContext,
  type PlannerModel,
} from "../src/hooks/useMealPlanner";
import MealReplacement from "../src/components/MealReplacement";
import { freshState, hydrateState } from "../src/helpers";
import {
  swapPlanMeal,
  swapStateMeal,
  canSwapMeal,
} from "../src/helpers/mealAlternatives";
import { validatePlan } from "../src/validations";
import original from "../public/meal-plan.json";
import type { Plan } from "../src/types";
const plan = original as Plan;
describe("five replacement recipes", () => {
  it("swaps only one slot, keeps five reversible options and excludes them from the schedule", () => {
    expect(validatePlan(plan)).toEqual([]);
    expect(plan.alternatives).toHaveLength(5);
    const before = structuredClone(plan),
      slot = before.meals[0],
      option = before.alternatives![0];
    const swapped = swapPlanMeal(before, slot.id, option.id);
    expect(swapped.meals).toHaveLength(10);
    expect(swapped.meals.slice(1)).toEqual(before.meals.slice(1));
    expect(swapped.meals[0]).toMatchObject({
      id: slot.id,
      day: slot.day,
      type: slot.type,
      main: option.main,
    });
    expect(swapped.alternatives![0].main).toBe(slot.main);
    expect(swapped.alternatives![0]).not.toHaveProperty("day");
    const returnedText = swapped.alternatives![0].prep[0].text;
    expect(returnedText).not.toMatch(/MON LUNCH/);
    expect(swapped.translations!.vi[returnedText]).not.toMatch(/THỨ HAI|TRƯA/);
    expect(validatePlan(swapped)).toEqual([]);
    expect(swapPlanMeal(swapped, slot.id, option.id).meals[0].main).toBe(
      slot.main,
    );
    expect(before).toEqual(plan);
  });
  it("preserves food and other meal progress, and blocks meals already cooking or eaten", () => {
    const state = freshState(plan),
      first = plan.meals[0].id,
      second = plan.meals[1].id;
    state.progress.ready[second] = true;
    state.pantry = { rice: 123 };
    state.purchased = {
      rice: { name: "Rice", unit: "g", category: "Grains", qty: 234 },
    };
    const swapped = swapStateMeal(state, first, plan.alternatives![1].id);
    expect(swapped.pantry).toEqual(state.pantry);
    expect(swapped.purchased).toEqual(state.purchased);
    expect(swapped.progress.ready[second]).toBe(true);
    const returned = swapped.plan.alternatives![1].prep[0].text;
    expect(swapped.plan.translations!.vi[returned]).toBeTruthy();
    state.cookingBatches = {
      [first]: { servings: 2, startedAt: new Date().toISOString() },
    };
    expect(canSwapMeal(state, first)).toBe(false);
    expect(() =>
      swapStateMeal(state, first, plan.alternatives![0].id),
    ).toThrow();
    state.cookingBatches = {};
    state.progress.done[first] = true;
    expect(canSwapMeal(state, first)).toBe(false);
  });
  it("upgrades an older default menu but preserves restricted custom plans", () => {
    const old = structuredClone(plan);
    delete old.alternatives;
    delete old.translations;
    expect(hydrateState(freshState(old), plan).plan.alternatives).toHaveLength(
      5,
    );
    old.name = "My allergy-safe menu";
    expect(
      hydrateState(freshState(old), plan).plan.alternatives,
    ).toBeUndefined();
    expect(
      validatePlan({
        ...plan,
        alternatives: [{ ...plan.alternatives![0], day: "Monday" }],
      }).length,
    ).toBeGreaterThan(0);
  });
  it("requires a choice, shows five recipes, and retains the choice after a failed save", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    const save = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    render(
      <I18nProvider>
        <MealPlannerContext.Provider
          value={{ s: freshState(plan) } as PlannerModel}
        >
          <MealReplacement plan={plan} meal={plan.meals[0]} onReplace={save} />
        </MealPlannerContext.Provider>
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Replace meal:/ }));
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(
      (
        screen.getByRole("button", {
          name: "Replace this meal",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Replace this meal" }));
    await screen.findByRole("alert");
    expect((screen.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Replace this meal" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(save).toHaveBeenCalledWith(plan.alternatives![0].id);
  });
});
