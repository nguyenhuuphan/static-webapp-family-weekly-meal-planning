import { recipeKey } from "./savedRecipes";
import { stocktakeCandidates } from "./inventory";
import type { State, SavedFood } from "src/types";
import {
  shoppingRequirements,
  savedFoodCredits,
  ingredientCredit,
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
  if (
    count !== mealPortions(state, meal) &&
    (state.cookingBatches?.[id] ||
      state.timer?.mealId === id ||
      state.timers?.some((t) => t.mealId === id))
  )
    throw Error(
      "This cooking batch keeps its original portions. Record diners and leftovers when finishing.",
    );
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
  if (count < oldCount && next.mealCredits?.[id]) {
    const sources = state.mealCreditSources?.[id] || [
      {
        week: state.mealCreditWeeks?.[id] || "",
        ingredients: state.mealCredits![id],
      },
    ];
    const food = Object.keys(surplus).length
      ? next.savedFood![next.savedFood!.length - 1]
      : undefined;
    const surplusCredits = food ? savedFoodCredits(food, food.servings) : [];
    const activeCredits = savedFoodCredits(
      {
        kind: "prepared",
        meal,
        baseServings: state.plan.servings,
        servings: count,
        preparedTasks: Object.fromEntries(
          meal.prep.map((_, i) => [
            i,
            next.preparedTasks![`${id}:${i}`] || { servings: 0, at: "" },
          ]),
        ),
        id: "allocation",
        storageNote: "",
        status: "pending",
      },
      count,
    );
    const share = (item: (typeof meal.ingredients)[number]) => {
      const extra = ingredientCredit(surplusCredits, item),
        active = ingredientCredit(activeCredits, item);
      return extra + active ? extra / (extra + active) : 0;
    };
    next.mealCreditSources = {
      ...next.mealCreditSources,
      [id]: sources.map((source) => ({
        ...source,
        ingredients: source.ingredients.map((i) => ({
          ...i,
          qty: i.qty * (1 - share(i)),
        })),
      })),
    };
    next.mealCredits[id] = meal.ingredients.flatMap((raw) => {
      const qty = next.mealCreditSources![id].reduce(
        (sum, source) => sum + ingredientCredit(source.ingredients, raw),
        0,
      );
      return qty ? [{ ...raw, qty }] : [];
    });
    if (food) {
      food.creditSources = sources.map((source) => ({
        ...source,
        ingredients: source.ingredients.map((i) => ({
          ...i,
          qty: i.qty * share(i),
        })),
      }));
      const native = surplusCredits.flatMap((raw) => {
        const imported = food.creditSources!.reduce(
          (sum, source) => sum + ingredientCredit(source.ingredients, raw),
          0,
        );
        return raw.qty > imported ? [{ ...raw, qty: raw.qty - imported }] : [];
      });
      if (native.length)
        food.creditSources.push({ week: state.weekStart, ingredients: native });
    }
  }
  if (count > mealPortions(state, meal)) {
    for (const key of Object.keys(next.progress.prep))
      if (key.startsWith(id + ":")) delete next.progress.prep[key];
  }
  if (next.mealAllocatedPortions?.[id])
    next.mealAllocatedPortions[id] = Math.min(
      count,
      next.mealAllocatedPortions[id],
    );
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
  if (Object.keys(state.cookingBatches || {}).length)
    throw Error("Finish active cooking batches before starting a new week.");
  const next = retainPrepared(state);
  return {
    ...next,
    weekStart,
    weekArchive: {
      ...state.weekArchive,
      [state.weekStart]: {
        plan: structuredClone(state.plan),
        servings: state.servings,
        mealServings: state.mealServings,
        done: state.progress.done,
        mealResults: state.mealResults,
      },
    },
    mealAllocatedPortions: {},
    cookingBatches: {},
    mealResults: {},
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
    mealCreditSources: {},
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
    food.kind === "cooked" ||
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
  if (
    recipeKey(food.meal, food.baseServings) !==
      recipeKey(destination, state.plan.servings) &&
    !next.savedFood.some(
      (f) =>
        ["pending", "scheduled"].includes(f.status) &&
        recipeKey(f.meal, f.baseServings) ===
          recipeKey(destination, state.plan.servings),
    )
  )
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
  next.mealAllocatedPortions = {
    ...next.mealAllocatedPortions,
    [destinationId]: count,
  };
  next.mealCreditWeeks = {
    ...next.mealCreditWeeks,
    [destinationId]: food.sourceWeek || "",
  };
  next.mealCreditSources = {
    ...next.mealCreditSources,
    [destinationId]: food.creditSources?.map((source) => ({
      ...source,
      ingredients: source.ingredients.map((i) => ({
        ...i,
        qty: (i.qty * count) / food.servings,
      })),
    })) || [
      {
        week: food.sourceWeek || "",
        ingredients: savedFoodCredits(food, count),
      },
    ],
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
  if (remaining.creditSources)
    remaining.creditSources = remaining.creditSources.map((source) => ({
      ...source,
      ingredients: source.ingredients.map((i) => ({
        ...i,
        qty: (i.qty * (remaining.servings - count)) / remaining.servings,
      })),
    }));
  remaining.servings -= count;
  for (const task of Object.values(remaining.preparedTasks))
    task.servings = Math.max(0, task.servings - count);
  if (!remaining.servings) remaining.status = "assigned";
  // Reconcile the new ingredient requirements without deleting acquisition records.
  return changePortions(next, destinationId, count);
}

export function mergeFood(
  state: State,
  foodId: string,
  destinationId: string,
): State {
  const food = state.savedFood?.find((f) => f.id === foodId);
  const meal = state.plan.meals.find((m) => m.id === destinationId);
  if (
    !food ||
    food.kind === "cooked" ||
    !meal ||
    !["pending", "scheduled"].includes(food.status) ||
    state.progress.done[destinationId] ||
    state.timer?.mealId === destinationId ||
    state.timers?.some((t) => t.mealId === destinationId)
  )
    throw Error("Choose an unfinished meal without a running timer.");
  const signature = (m: typeof meal, base: number) =>
    JSON.stringify([
      m.main,
      m.ingredients.map((i) => [i.name, i.unit, i.qty / base]),
      m.prep.map((p) => p.text),
    ]);
  if (
    signature(food.meal, food.baseServings) !==
    signature(meal, state.plan.servings)
  )
    throw Error(
      "Only identical recipes can share portions. Use an additional meal for different recipes.",
    );
  const count = Math.min(
    food.servings,
    mealPortions(state, meal) -
      (state.mealAllocatedPortions?.[destinationId] || 0),
  );
  if (count <= 0) throw Error("No portions are needed for this meal.");
  if (
    meal.prep.some((_, index) => {
      const key = `${destinationId}:${index}`;
      const existing =
        state.preparedTasks?.[key]?.servings ??
        (state.progress.prep[key] ? mealPortions(state, meal) : 0);
      return (
        existing + Math.min(count, food.preparedTasks[index]?.servings || 0) >
        mealPortions(state, meal)
      );
    })
  )
    throw Error(
      "This would exceed prepared portions. Keep this food as an additional meal.",
    );
  const next = structuredClone(state);
  next.mealAllocatedPortions = {
    ...next.mealAllocatedPortions,
    [destinationId]: (next.mealAllocatedPortions?.[destinationId] || 0) + count,
  };
  const mapIngredient = (item: (typeof meal.ingredients)[number]) => {
    const index = food.meal.ingredients.findIndex((i) =>
      i.id && item.id
        ? i.id === item.id
        : ingredientKey(i) === ingredientKey(item),
    );
    return { ...item, id: meal.ingredients[index]?.id };
  };
  const credits = savedFoodCredits(food, count).map(mapIngredient);
  const sources =
    state.mealCreditSources?.[destinationId] ||
    (state.mealCredits?.[destinationId]
      ? [
          {
            week: state.mealCreditWeeks?.[destinationId] || "",
            ingredients: state.mealCredits[destinationId],
          },
        ]
      : []);
  next.mealCreditSources = {
    ...next.mealCreditSources,
    [destinationId]: [
      ...sources,
      ...(food.creditSources?.map((source) => ({
        ...source,
        ingredients: source.ingredients.map((i) => ({
          ...mapIngredient(i),
          qty: (i.qty * count) / food.servings,
        })),
      })) || [{ week: food.sourceWeek || "", ingredients: credits }]),
    ],
  };
  next.mealCredits ??= {};
  const oldCredits = next.mealCredits[destinationId] || [];
  next.mealCredits[destinationId] = meal.ingredients.flatMap((raw) => {
    const previous = ingredientCredit(oldCredits, raw);
    const extra = ingredientCredit(credits, raw);
    return previous + extra > 0 ? [{ ...raw, qty: previous + extra }] : [];
  });
  next.mealCreditWeeks = {
    ...next.mealCreditWeeks,
    [destinationId]: food.sourceWeek || "",
  };
  next.preparedTasks ??= {};
  meal.prep.forEach((_, index) => {
    const source = food.preparedTasks[index];
    if (!source) return;
    const key = `${destinationId}:${index}`,
      previous = next.preparedTasks![key];
    const servings = Math.min(
      mealPortions(state, meal),
      (previous?.servings || 0) + Math.min(count, source.servings),
    );
    next.preparedTasks![key] = {
      servings,
      at: previous?.at && previous.at < source.at ? previous.at : source.at,
    };
    next.progress.prep[key] = servings >= mealPortions(state, meal);
  });
  const remaining = next.savedFood!.find((f) => f.id === foodId)!;
  if (remaining.creditSources)
    remaining.creditSources = remaining.creditSources.map((source) => ({
      ...source,
      ingredients: source.ingredients.map((i) => ({
        ...i,
        qty: (i.qty * (remaining.servings - count)) / remaining.servings,
      })),
    }));
  remaining.servings -= count;
  for (const task of Object.values(remaining.preparedTasks))
    task.servings = Math.max(0, task.servings - count);
  if (!remaining.servings) remaining.status = "assigned";
  // Preserve source batch histories in savedFood; a combined batch needs its own storage check.
  if (next.mealStorage) delete next.mealStorage[destinationId];
  delete next.progress.ready[destinationId];
  return reconcileShopping(next);
}
