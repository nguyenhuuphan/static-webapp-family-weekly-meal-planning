import type { State } from "src/types";
import { mealPortions, isPrepared } from "src/domain";
import { consumeMeal } from "./inventory";
import {
  reconcileShopping,
  ingredientCredit,
  savedFoodCredits,
} from "./shopping";
import { changePortions } from "./scheduling";
import { recordStorage } from "./foodStorage";

export function beginCooking(state: State, id: string): State {
  if (state.progress.done[id]) throw Error("Meal already completed.");
  if (state.cookingBatches?.[id]) return state;
  const meal = state.plan.meals.find((m) => m.id === id);
  if (!meal || !mealPortions(state, meal))
    throw Error("Choose an active meal.");
  return {
    ...state,
    cookingBatches: {
      ...state.cookingBatches,
      [id]: {
        servings: mealPortions(state, meal),
        startedAt: new Date().toISOString(),
      },
    },
  };
}

export function finishCooking(
  state: State,
  id: string,
  cooked: number,
  eaten: number,
  at = new Date().toISOString(),
): State {
  const meal = state.plan.meals.find((m) => m.id === id);
  if (
    !meal ||
    state.progress.done[id] ||
    !isPrepared(state, meal) ||
    !state.progress.ready[id]
  )
    throw Error("Confirm preparation and storage before finishing.");
  return recordMealCompletion(state, id, cooked, eaten, at);
}

/** Record an already finished meal without inventing preparation or storage checks. */
export function completeMealQuickly(
  state: State,
  id: string,
  cooked: number,
  eaten: number,
  at = new Date().toISOString(),
): State {
  return recordMealCompletion(state, id, cooked, eaten, at);
}

function recordMealCompletion(
  state: State,
  id: string,
  cooked: number,
  eaten: number,
  at: string,
): State {
  const meal = state.plan.meals.find((m) => m.id === id);
  if (!meal || state.progress.done[id] || mealPortions(state, meal) === 0)
    throw Error("Choose an active unfinished meal.");
  const batch =
    state.cookingBatches?.[id]?.servings ?? mealPortions(state, meal);
  if (
    !Number.isInteger(cooked) ||
    cooked < 1 ||
    cooked > batch ||
    !Number.isInteger(eaten) ||
    eaten < 0 ||
    eaten > cooked ||
    !Number.isFinite(Date.parse(at))
  )
    throw Error("Check cooked and eaten portions against the batch size.");
  let working = structuredClone(state);
  if (cooked < batch) {
    if (working.cookingBatches) delete working.cookingBatches[id];
    if (working.timer?.mealId === id) working.timer = null;
    working.timers = working.timers?.filter((timer) => timer.mealId !== id);
    working = changePortions(working, id, cooked);
  }
  const physicalCredits = working.mealCredits?.[id] || [];
  const sources = working.mealCreditSources?.[id] || [
    { week: working.mealCreditWeeks?.[id] || "", ingredients: physicalCredits },
  ];
  // Current-week reserved ingredients become actual consumption; older batches are already outside this week's raw stock.
  working.mealCredits = {
    ...working.mealCredits,
    [id]: physicalCredits.map((raw) => ({
      ...raw,
      qty: sources
        .filter((source) => source.week !== state.weekStart || source.accounted)
        .reduce(
          (sum, source) => sum + ingredientCredit(source.ingredients, raw),
          0,
        ),
    })),
  };
  working.mealCreditSources = {
    ...working.mealCreditSources,
    [id]: sources.map((source) => ({
      ...source,
      accounted: source.accounted || source.week === state.weekStart,
    })),
  };
  const next = structuredClone(consumeMeal(working, id, cooked));
  next.mealCredits = { ...next.mealCredits, [id]: physicalCredits };
  next.mealServings = { ...next.mealServings, [id]: mealPortions(state, meal) };
  const remaining = cooked - eaten;
  const leftoverId = remaining ? crypto.randomUUID() : undefined;
  if (leftoverId) {
    next.savedFood ??= [];
    next.savedFood.push({
      id: leftoverId,
      kind: "cooked",
      acquisitionAccounted: true,
      cookedAt: at,
      sourceWeek: state.weekStart,
      meal: structuredClone(meal),
      baseServings: state.plan.servings,
      servings: remaining,
      preparedTasks: {},
      storageNote: "",
      status: "pending",
      storage: recordStorage(
        state.mealStorage?.[id],
        "cooked",
        at,
        "cooked",
        "unknown",
      ),
    });
  }
  next.mealResults = {
    ...next.mealResults,
    [id]: { cooked, eaten, remaining, at, leftoverId },
  };
  next.progress.done[id] = true;
  if (next.cookingBatches) delete next.cookingBatches[id];
  if (next.timer?.mealId === id) next.timer = null;
  next.timers = next.timers?.filter((timer) => timer.mealId !== id);
  return reconcileShopping(next);
}

export function undoCooking(state: State, id: string): State {
  const next = structuredClone(state),
    result = next.mealResults?.[id];
  const food = result?.leftoverId
    ? next.savedFood?.find((f) => f.id === result.leftoverId)
    : undefined;
  if (
    result?.leftoverId &&
    (!food ||
      food.status !== "pending" ||
      food.servings !== result.remaining ||
      food.eatenServings)
  )
    throw Error(
      "Leftovers have been scheduled or used. Keep this cooking record.",
    );
  if (food) next.savedFood = next.savedFood?.filter((f) => f.id !== food.id);
  if (next.mealResults) delete next.mealResults[id];
  if (next.stockUses) delete next.stockUses[id];
  if (next.mealCreditSources?.[id])
    next.mealCreditSources[id] = next.mealCreditSources[id].map((source) => ({
      ...source,
      accounted: source.week === state.weekStart ? false : source.accounted,
    }));
  next.progress.done[id] = false;
  return reconcileShopping(next);
}

export function eatCookedFood(
  state: State,
  foodId: string,
  eaten: number,
): State {
  const next = structuredClone(state),
    food = next.savedFood?.find((f) => f.id === foodId);
  if (
    !food ||
    food.kind !== "cooked" ||
    !["pending", "scheduled"].includes(food.status) ||
    !Number.isInteger(eaten) ||
    eaten < 1 ||
    eaten > food.servings
  )
    throw Error("Check portions eaten.");
  food.eatenServings = (food.eatenServings || 0) + eaten;
  food.servings -= eaten;
  if (!food.servings) food.status = "used";
  // Cooking time and storage history stay unchanged when part of a batch is eaten.
  return reconcileShopping(next);
}

export function cancelCooking(state: State, id: string): State {
  if (state.progress.done[id]) throw Error("Meal already completed.");
  const next = structuredClone(state);
  if (next.cookingBatches) delete next.cookingBatches[id];
  if (next.timer?.mealId === id) next.timer = null;
  next.timers = next.timers?.filter((timer) => timer.mealId !== id);
  return next;
}

/** Confirm an additional scheduled recipe/prepared batch actually used outside the main menu. */
export function finishSavedFood(state: State, foodId: string): State {
  const food = state.savedFood?.find((f) => f.id === foodId);
  if (
    !food ||
    food.kind === "cooked" ||
    !["pending", "scheduled"].includes(food.status)
  )
    throw Error("Choose unused food.");
  const id = "saved-" + food.id,
    working = structuredClone(state);
  const credits = savedFoodCredits(food, food.servings);
  const sources = food.creditSources || [
    { week: food.sourceWeek || "", ingredients: credits },
  ];
  working.savedFood = working.savedFood?.map((f) =>
    f.id === foodId ? { ...f, status: "used", acquisitionAccounted: true } : f,
  );
  working.plan.meals.push({
    ...structuredClone(food.meal),
    id,
    ingredients: food.meal.ingredients.map((i) => ({
      ...i,
      qty: (i.qty * state.plan.servings) / food.baseServings,
    })),
  });
  working.mealServings = { ...working.mealServings, [id]: food.servings };
  working.mealCredits = {
    ...working.mealCredits,
    [id]: credits.map((raw) => ({
      ...raw,
      qty: sources
        .filter((source) => source.week !== state.weekStart || source.accounted)
        .reduce(
          (sum, source) => sum + ingredientCredit(source.ingredients, raw),
          0,
        ),
    })),
  };
  const next = consumeMeal(working, id, food.servings);
  next.plan = structuredClone(state.plan);
  delete next.mealServings![id];
  delete next.mealCredits![id];
  return reconcileShopping(next);
}
