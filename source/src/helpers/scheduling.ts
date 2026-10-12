import { stocktakeCandidates } from "./inventory";
import type { State, SavedFood } from "src/types";
import {
  shoppingRequirements,
  savedFoodCredits,
  reconcileShopping,
} from "./shopping";
import { aggregate, ingredientKey, mealPortions } from "src/utils";

export function changePortions(state: State, id: string, count: number): State {
  const meal = state.plan.meals.find((m) => m.id === id);
  if (
    !meal ||
    state.progress.done[id] ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > state.servings
  )
    throw Error("Invalid portions for this meal.");
  const next = structuredClone(state);
  next.purchased ??= {};
  const before = shoppingRequirements(state);
  next.pantry ??= {};
  for (const item of before) {
    const key = ingredientKey(item);
    if (state.progress.owned[key] && next.pantry[key] === undefined)
      next.pantry[key] = item.qty;
    if (state.progress.shopping[key] && !next.purchased[key])
      next.purchased[key] = {
        ...item,
        qty: Math.max(0, item.qty - (state.pantry?.[key] || 0)),
      };
  }
  const oldCount = mealPortions(state, meal);
  if (oldCount > 0 && count === 0)
    next.lastMealServings = { ...next.lastMealServings, [id]: oldCount };
  next.preparedTasks ??= {};
  const surplus: SavedFood["preparedTasks"] = {};
  meal.prep.forEach((_, index) => {
    const key = `${id}:${index}`;
    const snapshot =
      next.preparedTasks![key] ||
      (state.progress.prep[key] ? { servings: oldCount, at: "" } : undefined);
    if (!snapshot) return;
    const excess = Math.max(0, snapshot.servings - count);
    if (excess) surplus[index] = { ...snapshot, servings: excess };
    next.preparedTasks![key] = {
      ...snapshot,
      servings: Math.min(count, snapshot.servings),
    };
    next.progress.prep[key] = count > 0 && snapshot.servings >= count;
  });
  if (Object.keys(surplus).length) {
    next.savedFood ??= [];
    next.savedFood.push({
      id: crypto.randomUUID(),
      kind: "prepared",
      storage: next.mealStorage?.[id]
        ? structuredClone(next.mealStorage[id])
        : undefined,
      sourceWeek: state.mealCreditWeeks?.[id] || state.weekStart,
      meal: structuredClone(meal),
      baseServings: state.plan.servings,
      servings: Math.max(...Object.values(surplus).map((p) => p.servings)),
      preparedTasks: surplus,
      storageNote: "",
      status: "pending",
    });
  }
  next.mealServings = { ...next.mealServings, [id]: count };
  if (oldCount > 0 && count < oldCount && next.mealCredits?.[id])
    next.mealCredits[id] = next.mealCredits[id].map((i) => ({
      ...i,
      qty: (i.qty * count) / oldCount,
    }));
  if (count > mealPortions(state, meal)) {
    for (const key of Object.keys(next.progress.prep))
      if (key.startsWith(id + ":")) delete next.progress.prep[key];
  }
  delete next.progress.ready[id];
  return reconcileShopping(next);
}

/** Recipe identity and preparation follow the food, rather than the calendar slot. */
export function swapSchedule(
  state: State,
  first: string,
  second: string,
): State {
  if (first === second) return state;
  const a = state.plan.meals.find((m) => m.id === first);
  const b = state.plan.meals.find((m) => m.id === second);
  if (!a || !b || state.progress.done[first] || state.progress.done[second])
    throw Error("Completed meals cannot be moved.");
  let next = changePortions(state, first, mealPortions(state, b));
  next = changePortions(next, second, mealPortions(state, a));
  next.plan.meals = next.plan.meals.map((m) =>
    m.id === first
      ? { ...m, day: b.day, type: b.type }
      : m.id === second
        ? { ...m, day: a.day, type: a.type }
        : m,
  );
  // Attendance belongs to the date, while the recipe changes date.
  next.mealServings = {
    ...next.mealServings,
    [first]: mealPortions(state, b),
    [second]: mealPortions(state, a),
  };
  delete next.progress.ready[first];
  delete next.progress.ready[second];
  return next;
}

/** Move physical prepared food out of the current week's working checklists. */
export function retainPrepared(state: State): State {
  let next = state;
  for (const meal of state.plan.meals)
    if (!state.progress.done[meal.id]) next = changePortions(next, meal.id, 0);
  return next;
}

export function startWeek(
  state: State,
  weekStart: string,
  checkedStock?: Record<string, number>,
): State {
  const next = retainPrepared(state);
  return {
    ...next,
    weekStart,
    pantry:
      checkedStock ||
      Object.fromEntries(
        stocktakeCandidates(next).map((i) => [i.key, i.estimated]),
      ),
    stockUses: {},
    stockHistory: [
      ...(state.stockHistory || []),
      {
        weekStart: state.weekStart,
        purchased: state.purchased || {},
        uses: state.stockUses || {},
        checkedAt: new Date().toISOString(),
      },
    ],
    mealServings: {},
    lastMealServings: {},
    mealCredits: {},
    mealCreditWeeks: {},
    purchased: {},
    preparedTasks: {},
    mealStorage: {},
    progress: {
      shopping: {},
      owned: {},
      prep: {},
      ready: {},
      done: {},
      cook: {},
    },
    timer: null,
    timers: [],
  };
}

export function assignFood(
  state: State,
  foodId: string,
  destinationId: string,
): State {
  const food = state.savedFood?.find((f) => f.id === foodId);
  const destination = state.plan.meals.find((m) => m.id === destinationId);
  if (
    !food ||
    !destination ||
    !["pending", "scheduled"].includes(food.status) ||
    state.progress.done[destinationId] ||
    destination.prep.some(
      (_, i) => state.progress.prep[`${destinationId}:${i}`],
    ) ||
    state.progress.ready[destinationId] ||
    state.timer?.mealId === destinationId ||
    state.timers?.some((t) => t.mealId === destinationId)
  )
    throw Error("Choose a meal that has not been prepared or cooked.");
  const count = mealPortions(state, destination);
  if (!count || count > food.servings)
    throw Error("There are not enough portions for this meal.");
  const next = changePortions(state, destinationId, count);
  next.savedFood ??= [];
  next.savedFood.push({
    id: crypto.randomUUID(),
    kind: "recipe",
    meal: structuredClone(destination),
    baseServings: state.plan.servings,
    servings: count,
    preparedTasks: {},
    storageNote: "",
    status: "pending",
  });
  // Convert quantities if the saved food came from a different recipe base.
  const recipe = {
    ...structuredClone(food.meal),
    recipeId: food.meal.recipeId || food.meal.id,
    id: destinationId,
    day: destination.day,
    type: destination.type,
    prep: food.meal.prep.map((p) => ({
      ...p,
      ingredients: p.ingredients?.map((ref) => ({
        ...ref,
        qty: (ref.qty * state.plan.servings) / food.baseServings,
      })),
      text: p.text.replace(
        /\[([\d.]+) (g|ml|each|tsp|tbsp)\]/g,
        (_, n, u) =>
          `[${(Number(n) * state.plan.servings) / food.baseServings} ${u}]`,
      ),
    })),
    steps: food.meal.steps.map((p) => ({
      ...p,
      ingredients: p.ingredients?.map((ref) => ({
        ...ref,
        qty: (ref.qty * state.plan.servings) / food.baseServings,
      })),
      text: p.text.replace(
        /\[([\d.]+) (g|ml|each|tsp|tbsp)\]/g,
        (_, n, u) =>
          `[${(Number(n) * state.plan.servings) / food.baseServings} ${u}]`,
      ),
    })),
    ingredients: food.meal.ingredients.map((i) => ({
      ...i,
      qty: (i.qty * state.plan.servings) / food.baseServings,
    })),
  };
  next.plan.meals = next.plan.meals.map((m) =>
    m.id === destinationId ? recipe : m,
  );
  if (food.storage)
    next.mealStorage = {
      ...next.mealStorage,
      [destinationId]: structuredClone(food.storage),
    };
  next.mealCreditWeeks = {
    ...next.mealCreditWeeks,
    [destinationId]: food.sourceWeek || "",
  };
  next.mealCredits = {
    ...next.mealCredits,
    [destinationId]: savedFoodCredits(food, count),
  };
  delete next.progress.ready[destinationId];
  delete next.progress.cook[destinationId];
  next.preparedTasks ??= {};
  for (const key of Object.keys(next.preparedTasks))
    if (key.startsWith(destinationId + ":")) delete next.preparedTasks[key];
  recipe.prep.forEach((_, i) => {
    const prepared = food.preparedTasks[i];
    const key = `${destinationId}:${i}`;
    next.progress.prep[key] = !!prepared && prepared.servings >= count;
    if (prepared)
      next.preparedTasks![key] = {
        ...prepared,
        servings: Math.min(count, prepared.servings),
      };
  });
  const remaining = next.savedFood.find((f) => f.id === foodId)!;
  remaining.servings -= count;
  for (const task of Object.values(remaining.preparedTasks))
    task.servings = Math.max(0, task.servings - count);
  if (!remaining.servings) remaining.status = "assigned";
  // Reconcile the new ingredient requirements without deleting acquisition records.
  return changePortions(next, destinationId, count);
}
