import type { State } from "src/types";
import {
  shoppingRequirements,
  availableAcquisitions,
  committedPurchases,
  savedFoodCredits,
  ingredientCredit,
} from "src/helpers/shopping";
import { ingredientKey, mealPortions } from "src/utils";
import {
  groupPreparation,
  recipePreparationCards,
} from "src/helpers/preparation";
import { stocktakeCandidates } from "src/helpers/inventory";

import { preparationChecked } from "src/helpers/preparationProgress";
/** Count raw stock after reserving prepared ingredients, without cancelling every planned meal. */
export function calculateStocktake(state: State) {
  const committed = committedPurchases(state);
  for (const meal of state.plan.meals) {
    if (state.progress.done[meal.id]) continue;
    const count = mealPortions(state, meal);
    if (!count) continue;
    const prepared = savedFoodCredits(
      {
        id: "projection",
        kind: "prepared",
        status: "pending",
        storageNote: "",
        meal,
        baseServings: state.plan.servings,
        servings: count,
        preparedTasks: Object.fromEntries(
          meal.prep.map((_, i) => [
            i,
            state.preparedTasks?.[`${meal.id}:${i}`] || {
              servings: state.progress.prep[`${meal.id}:${i}`] ? count : 0,
              at: "",
            },
          ]),
        ),
      },
      count,
    );
    for (const item of prepared) {
      const qty = Math.max(
        0,
        item.qty - ingredientCredit(state.mealCredits?.[meal.id], item),
      );
      const key = ingredientKey(
        item.unit === "tbsp" ? { ...item, unit: "tsp" } : item,
      );
      committed[key] =
        (committed[key] || 0) + qty * (item.unit === "tbsp" ? 3 : 1);
    }
  }
  return stocktakeCandidates(state).map((candidate) => {
    const available = availableAcquisitions(state, candidate.key, committed);
    return {
      ...candidate,
      estimated: Math.round((available.home + available.purchased) * 100) / 100,
    };
  });
}
export function calculatePlanner(state: State) {
  const committed = committedPurchases(state);
  const shopping = shoppingRequirements(state).map((item) => {
    const available = availableAcquisitions(
      state,
      ingredientKey(item),
      committed,
    );
    return {
      ...item,
      toBuy: Math.max(
        0,
        Math.round((item.qty - available.home - available.purchased) * 100) /
          100,
      ),
      availableHome: available.home,
    };
  });
  const needs = shopping.filter(
    (i) => !state.progress.owned[ingredientKey(i)] && i.qty > i.availableHome,
  );
  const groups = recipePreparationCards(
    groupPreparation(state.plan, state.servings, state.mealServings),
  ).filter(
    (g) => g.operation !== "prepareSauces" && g.operation !== "cookJustInTime",
  );
  const required = new Map<string, Set<number>>();
  for (const group of groups)
    for (const a of group.allocations) {
      if (!required.has(a.meal.id)) required.set(a.meal.id, new Set());
      required.get(a.meal.id)!.add(a.taskIndex);
    }
  const meals = Object.fromEntries(
    state.plan.meals.map((meal) => {
      const portions = mealPortions(state, meal);
      const prepared =
        portions > 0 &&
        [...(required.get(meal.id) || [])].every(
          (i) => !!state.progress.prep[`${meal.id}:${i}`],
        );
      return [
        meal.id,
        {
          portions,
          prepared,
          ready: prepared && !!state.progress.ready[meal.id],
        },
      ];
    }),
  );
  return {
    shopping,
    needs,
    stocktake: calculateStocktake(state),
    surplus: Object.entries(state.purchased || {}).flatMap(([key, item]) => {
      const required = shopping.find((i) => ingredientKey(i) === key)?.qty || 0,
        available = availableAcquisitions(state, key, committed);
      const extra = Math.max(
        0,
        Math.round((available.home + available.purchased - required) * 100) /
          100,
      );
      return extra > 0 ? [{ ...item, qty: extra }] : [];
    }),
    preparation: groups.map((group) => ({
      ...group,
      allocations: group.allocations.map(({ meal, task, ...allocation }) => ({
        ...allocation,
        mealId: meal.id,
      })),
    })),
    bought: needs.filter((i) => state.progress.shopping[ingredientKey(i)])
      .length,
    doneCount: state.plan.meals.filter(
      (m) => mealPortions(state, m) > 0 && state.progress.done[m.id],
    ).length,
    prepTotal: [...required.values()].reduce(
      (sum, indices) => sum + indices.size,
      0,
    ),
    prepDone: [...required.entries()].reduce(
      (sum, [id, indices]) =>
        sum +
        [...indices].filter((i) => state.progress.prep[`${id}:${i}`]).length,
      0,
    ),
    groupsTotal: groups.length,
    groupsDone: groups.filter((g) =>
      g.allocations.every((a) => preparationChecked(state, a.key)),
    ).length,
    meals,
  };
}
export type PlannerCalculations = ReturnType<typeof calculatePlanner>;
export type PlannerEnvelope = {
  state: State;
  revision: number;
  calculations: PlannerCalculations;
  serverTime: string;
  lastCommand?: { id: string; kind: string };
};
