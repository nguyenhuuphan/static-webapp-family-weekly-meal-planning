import type { Ingredient, SavedFood, State } from "src/types";
import { aggregate, ingredientKey, mealPortions } from "src/utils";
import { groupPreparation } from "./preparation";

/** Credit only ingredient allocations identified by a reviewed preparation profile. */
export function savedFoodCredits(food: SavedFood, count: number): Ingredient[] {
  if (food.kind !== "prepared") return [];
  const groups = groupPreparation(
    {
      schemaVersion: 1,
      name: "saved",
      servings: food.baseServings,
      meals: [food.meal],
    },
    food.baseServings,
  );
  return food.meal.ingredients.flatMap((ingredient) => {
    const tasks = groups
      .filter((g) => g.ingredient === ingredient.name)
      .flatMap((g) => g.allocations);
    if (!tasks.length) return [];
    const portions = Math.min(
      count,
      ...tasks.map((task) => food.preparedTasks[task.taskIndex]?.servings || 0),
    );
    return portions > 0
      ? [
          {
            ...ingredient,
            qty: (ingredient.qty * portions) / food.baseServings,
          },
        ]
      : [];
  });
}

export function shoppingRequirements(state: State) {
  const meals = state.plan.meals
    .filter((meal) => !state.progress.done[meal.id])
    .map((meal) => {
      const factor = mealPortions(state, meal) / state.plan.servings;
      return {
        ...meal,
        ingredients: meal.ingredients
          .map((i) => ({
            ...i,
            qty: factor
              ? Math.max(
                  0,
                  i.qty -
                    (state.mealCredits?.[meal.id]?.find(
                      (c) => ingredientKey(c) === ingredientKey(i),
                    )?.qty || 0) /
                      factor,
                )
              : 0,
          }))
          .filter((i) => i.qty > 0),
      };
    });
  const portions = { ...state.mealServings };
  const end = new Date(state.weekStart + "T12:00:00");
  end.setDate(end.getDate() + 6);
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  for (const food of state.savedFood || []) {
    if (
      food.status !== "scheduled" ||
      !food.date ||
      food.date < state.weekStart ||
      food.date > endDate
    )
      continue;
    const credits = savedFoodCredits(food, food.servings);
    const factor = food.servings / food.baseServings;
    const id = "saved-" + food.id;
    portions[id] = food.servings;
    meals.push({
      ...food.meal,
      id,
      ingredients: food.meal.ingredients
        .map((i) => ({
          ...i,
          qty: Math.max(
            0,
            ((i.qty * factor -
              (credits.find((c) => ingredientKey(c) === ingredientKey(i))
                ?.qty || 0)) *
              state.plan.servings) /
              food.servings,
          ),
        }))
        .filter((i) => i.qty > 0),
    });
  }
  return aggregate({ ...state.plan, meals }, state.servings, portions);
}

/** Purchases already embodied in saved food cannot also supply a new raw batch. */
export function committedPurchases(state: State): Record<string, number> {
  const amounts: Record<string, number> = {};
  const add = (items: Ingredient[]) =>
    items.forEach((item) => {
      const normalized =
        item.unit === "tbsp"
          ? { ...item, qty: item.qty * 3, unit: "tsp" }
          : item;
      const key = ingredientKey(normalized);
      amounts[key] = (amounts[key] || 0) + normalized.qty;
    });
  for (const food of state.savedFood || [])
    if (
      food.sourceWeek === state.weekStart &&
      food.kind === "prepared" &&
      food.status !== "assigned"
    )
      add(savedFoodCredits(food, food.servings));
  for (const [id, credits] of Object.entries(state.mealCredits || {}))
    if (state.mealCreditWeeks?.[id] === state.weekStart) add(credits);
  return amounts;
}

export function availableAcquisitions(
  state: State,
  key: string,
  committed = committedPurchases(state),
) {
  const consumedHome = Object.values(state.stockUses || {}).reduce(
    (n, use) => n + (use.home[key] || 0),
    0,
  );
  const consumedPurchased = Object.values(state.stockUses || {}).reduce(
    (n, use) => n + (use.purchased[key] || 0),
    0,
  );
  const home = Math.max(0, (state.pantry?.[key] || 0) - consumedHome);
  const used = committed[key] || 0;
  return {
    home: Math.max(0, home - used),
    purchased: Math.max(
      0,
      (state.purchased?.[key]?.qty || 0) -
        consumedPurchased -
        Math.max(0, used - home),
    ),
  };
}

export function reconcileShopping(state: State): State {
  const next = structuredClone(state);
  const committed = committedPurchases(next);
  for (const item of shoppingRequirements(next)) {
    const key = ingredientKey(item);
    const available = availableAcquisitions(next, key, committed);
    next.progress.owned[key] = available.home >= item.qty;
    next.progress.shopping[key] =
      available.purchased >= Math.max(0, item.qty - available.home);
  }
  return next;
}
