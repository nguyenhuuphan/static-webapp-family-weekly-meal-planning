import { type Plan, type Meal, type State, type Progress } from "src/types";
import { defaultMonday, isMonday, aggregate, ingredientKey } from "src/utils";
import { normalizeIngredientLinks } from "./ingredientLinks";
import { validateFoodStorage } from "./foodStorage";
import { changePortions } from "./scheduling";
import { parseBackup, validatePlan } from "src/validations";
export const freshProgress = (): Progress => ({
  shopping: {},
  owned: {},
  prep: {},
  ready: {},
  done: {},
  cook: {},
});
export function freshState(plan: Plan): State {
  return {
    plan: normalizeIngredientLinks(plan),
    servings: plan.servings,
    weekStart: defaultMonday(),
    progress: freshProgress(),
    timer: null,
    timers: [],
  };
}
export function hydrateState(raw: unknown, defaults: Plan): State {
  let v = raw as State;
  if (!v) return freshState(defaults);
  parseBackup(v);
  v = { ...v, plan: normalizeIngredientLinks(v.plan) };
  const progress = freshProgress();
  for (const k of Object.keys(progress) as (keyof Progress)[]) {
    const map = v.progress?.[k];
    if (map && typeof map === "object" && !Array.isArray(map))
      for (const [id, value] of Object.entries(map)) {
        if (k === "cook") {
          if (Number.isInteger(value) && Number(value) >= 0)
            progress.cook[id] = Number(value);
        } else if (typeof value === "boolean") progress[k][id] = value;
      }
  }
  for (const use of Object.values(v.stockUses || {})) {
    if (
      !use ||
      !use.home ||
      !use.purchased ||
      !Array.isArray(use.ingredients) ||
      [...Object.values(use.home), ...Object.values(use.purchased)].some(
        (n) => !Number.isFinite(n) || n < 0,
      )
    )
      throw Error("Invalid stock usage record.");
  }
  if (v.stockHistory !== undefined && !Array.isArray(v.stockHistory))
    throw Error("Invalid stock history.");
  for (const [week, entry] of Object.entries(v.weekArchive || {})) {
    if (
      !isMonday(week) ||
      !entry ||
      validatePlan(entry.plan).length ||
      !Number.isInteger(entry.servings) ||
      entry.servings < 1 ||
      entry.servings > 12 ||
      !entry.done ||
      typeof entry.done !== "object"
    )
      throw Error("Invalid archived week.");
  }
  for (const count of Object.values(v.mealAllocatedPortions || {}))
    if (!Number.isInteger(count) || count < 0 || count > 12)
      throw Error("Invalid allocated portions.");
  const validateSources = (
    sources: NonNullable<State["mealCreditSources"]>[string],
  ) => {
    if (
      !Array.isArray(sources) ||
      sources.some(
        (source) =>
          !source ||
          typeof source.week !== "string" ||
          (source.week && !isMonday(source.week)) ||
          !Array.isArray(source.ingredients) ||
          source.ingredients.some(
            (i) => !i || !Number.isFinite(i.qty) || i.qty < 0,
          ),
      )
    )
      throw Error("Invalid batch credits.");
  };
  for (const sources of Object.values(v.mealCreditSources || {}))
    validateSources(sources);
  for (const [id, batch] of Object.entries(v.cookingBatches || {})) {
    if (
      !batch ||
      !v.plan.meals.some((m) => m.id === id) ||
      !Number.isInteger(batch.servings) ||
      batch.servings < 1 ||
      batch.servings > 12 ||
      !Number.isFinite(Date.parse(batch.startedAt))
    )
      throw Error("Invalid cooking batch.");
  }
  for (const result of Object.values(v.mealResults || {})) {
    if (
      !result ||
      !Number.isInteger(result.cooked) ||
      result.cooked < 1 ||
      result.cooked > 12 ||
      !Number.isInteger(result.eaten) ||
      result.eaten < 0 ||
      result.eaten > result.cooked ||
      result.remaining !== result.cooked - result.eaten ||
      !Number.isFinite(Date.parse(result.at))
    )
      throw Error("Invalid meal result.");
  }
  if (
    v.purchaseReceipts !== undefined &&
    (!Array.isArray(v.purchaseReceipts) ||
      v.purchaseReceipts.some(
        (r) =>
          !r ||
          typeof r.key !== "string" ||
          !Number.isFinite(r.qty) ||
          r.qty <= 0 ||
          !Number.isFinite(Date.parse(r.at)),
      ))
  )
    throw Error("Invalid purchase history.");
  const mealServings = Object.fromEntries(
    Object.entries(v.mealServings || {}).filter(
      ([id, count]) =>
        v.plan.meals.some((m) => m.id === id) &&
        Number.isInteger(count) &&
        count >= 0 &&
        count <= v.servings,
    ),
  );
  const purchased = Object.fromEntries(
    Object.entries(v.purchased || {}).filter(
      ([, item]) =>
        item &&
        typeof item.name === "string" &&
        ["g", "ml", "each", "tsp", "tbsp"].includes(item.unit) &&
        typeof item.category === "string" &&
        Number.isFinite(item.qty) &&
        item.qty >= 0,
    ),
  );
  for (const item of aggregate(v.plan, v.servings, mealServings)) {
    const key = ingredientKey(item);
    if (progress.shopping[key] && !purchased[key])
      purchased[key] = {
        ...item,
        qty: Math.max(0, item.qty - (Number(v.pantry?.[key]) || 0)),
      };
  }
  const preparedTasks: NonNullable<State["preparedTasks"]> = {};
  for (const [key, task] of Object.entries(v.preparedTasks || {})) {
    if (
      task &&
      Number.isInteger(task.servings) &&
      task.servings >= 0 &&
      task.servings <= 12 &&
      typeof task.at === "string" &&
      (!task.at || Number.isFinite(Date.parse(task.at)))
    )
      preparedTasks[key] = task;
  }
  for (const storage of Object.values(v.mealStorage || {}))
    validateFoodStorage(storage);
  const savedFood = Array.isArray(v.savedFood)
    ? structuredClone(v.savedFood)
    : [];
  const ids = new Set<string>();
  for (const food of savedFood) {
    food.meal = normalizeIngredientLinks({
      ...v.plan,
      meals: [food.meal],
    }).meals[0];
    const errors = validatePlan({
      ...v.plan,
      meals: v.plan.meals.map((m, i) =>
        i === 0 ? { ...food.meal, id: m.id, day: m.day, type: m.type } : m,
      ),
    });
    if (
      !food ||
      typeof food.id !== "string" ||
      ids.has(food.id) ||
      !["prepared", "recipe", "cooked"].includes(food.kind) ||
      !["pending", "scheduled", "used", "discarded", "assigned"].includes(
        food.status,
      ) ||
      !Number.isInteger(food.servings) ||
      food.servings < 0 ||
      food.servings > 12 ||
      !Number.isInteger(food.baseServings) ||
      food.baseServings < 1 ||
      food.baseServings > 12 ||
      errors.length ||
      typeof food.storageNote !== "string" ||
      !food.preparedTasks ||
      typeof food.preparedTasks !== "object" ||
      Array.isArray(food.preparedTasks)
    )
      throw Error("Invalid saved food in backup.");
    if (
      food.date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(food.date) ||
        !Number.isFinite(Date.parse(food.date)))
    )
      throw Error("Invalid saved food date.");
    if (
      food.status === "scheduled" &&
      (!food.date || !["Lunch", "Dinner"].includes(food.type || ""))
    )
      throw Error("Invalid saved food schedule.");
    for (const [index, task] of Object.entries(food.preparedTasks)) {
      if (
        !/^\d+$/.test(index) ||
        Number(index) >= food.meal.prep.length ||
        !task ||
        !Number.isInteger(task.servings) ||
        task.servings < 0 ||
        task.servings > 12 ||
        typeof task.at !== "string" ||
        (task.at && !Number.isFinite(Date.parse(task.at)))
      )
        throw Error("Invalid saved preparation record.");
    }
    if (
      food.kind === "cooked" &&
      (!food.cookedAt ||
        !Number.isFinite(Date.parse(food.cookedAt)) ||
        food.acquisitionAccounted !== true ||
        food.storage?.stage !== "cooked")
    )
      throw Error("Invalid cooked leftovers.");
    if (food.creditSources) validateSources(food.creditSources);
    if (food.storage) validateFoodStorage(food.storage);
    ids.add(food.id);
  }
  let timer = v.timer;
  if (
    timer &&
    (!Number.isFinite(timer.end) ||
      !Number.isInteger(timer.step) ||
      timer.step < 0 ||
      !v.plan.meals.some(
        (m) => m.id === timer?.mealId && timer.step < m.steps.length,
      ))
  )
    timer = null;
  return {
    ...v,
    mealServings,
    mealCreditWeeks: Object.fromEntries(
      Object.entries(v.mealCreditWeeks || {}).filter(
        ([id, week]) =>
          v.plan.meals.some((m) => m.id === id) &&
          typeof week === "string" &&
          (!week || isMonday(week)),
      ),
    ),
    lastMealServings: Object.fromEntries(
      Object.entries(v.lastMealServings || {}).filter(
        ([id, count]) =>
          v.plan.meals.some((m) => m.id === id) &&
          Number.isInteger(count) &&
          count > 0 &&
          count <= v.servings,
      ),
    ),
    mealCredits:
      v.mealCredits && typeof v.mealCredits === "object"
        ? Object.fromEntries(
            Object.entries(v.mealCredits).filter(
              ([id, items]) =>
                v.plan.meals.some((m) => m.id === id) &&
                Array.isArray(items) &&
                items.every(
                  (i) =>
                    i &&
                    typeof i.name === "string" &&
                    ["g", "ml", "each", "tsp", "tbsp"].includes(i.unit) &&
                    Number.isFinite(i.qty) &&
                    i.qty >= 0,
                ),
            ),
          )
        : {},
    purchased,
    preparedTasks,
    savedFood,
    weekStart: isMonday(v.weekStart) ? v.weekStart : defaultMonday(),
    progress,
    pantry:
      v.pantry && typeof v.pantry === "object" && !Array.isArray(v.pantry)
        ? Object.fromEntries(
            Object.entries(v.pantry).filter(
              ([, amount]) =>
                typeof amount === "number" &&
                Number.isFinite(amount) &&
                amount >= 0,
            ),
          )
        : {},
    timer,
    timers: Array.isArray(v.timers)
      ? v.timers.filter(
          (item) =>
            item &&
            Number.isFinite(item.end) &&
            Number.isInteger(item.step) &&
            item.step >= 0 &&
            (item.paused === undefined ||
              (Number.isFinite(item.paused) && item.paused >= 0)) &&
            v.plan.meals.some(
              (meal) =>
                meal.id === item.mealId && item.step < meal.steps.length,
            ),
        )
      : [],
  };
}
export function resetForMeal(s: State, id: string): State {
  if (s.cookingBatches?.[id])
    throw Error("Finish this cooking batch before editing its recipe.");
  const next = structuredClone(s);
  // Retain actual past consumption when a completed slot is reused for a new recipe.
  if (next.stockUses?.[id]) {
    next.stockUses["history-" + crypto.randomUUID()] = next.stockUses[id];
    delete next.stockUses[id];
  }
  if (next.mealResults) delete next.mealResults[id];
  for (const k of Object.keys(next.progress.prep))
    if (k.startsWith(id + ":")) delete next.progress.prep[k];
  for (const key of Object.keys(next.preparedTasks || {}))
    if (key.startsWith(id + ":")) delete next.preparedTasks![key];
  if (next.mealCredits) delete next.mealCredits[id];
  if (next.mealCreditSources) delete next.mealCreditSources[id];
  if (next.mealAllocatedPortions) delete next.mealAllocatedPortions[id];
  if (next.mealCreditWeeks) delete next.mealCreditWeeks[id];
  delete next.progress.ready[id];
  delete next.progress.done[id];
  delete next.progress.cook[id];
  if (next.timer?.mealId === id) next.timer = null;
  next.timers = next.timers?.filter((timer) => timer.mealId !== id);
  return next;
}
export function replaceMeal(s: State, id: string, updated: Meal): State {
  const originalCount = s.mealServings?.[id] ?? s.servings;
  const next = resetForMeal(
    s.progress.done[id] ? s : changePortions(s, id, 0),
    id,
  );
  next.progress.shopping = { ...s.progress.shopping };
  next.progress.owned = { ...s.progress.owned };
  next.mealServings = { ...next.mealServings, [id]: originalCount };
  next.plan.meals = next.plan.meals.map((m) => (m.id === id ? updated : m));
  const before = new Map(
    aggregate(s.plan, s.servings, s.mealServings).map((i) => [
      ingredientKey(i),
      i.qty,
    ]),
  );
  const after = new Map(
    aggregate(next.plan, next.servings, next.mealServings).map((i) => [
      ingredientKey(i),
      i.qty,
    ]),
  );
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(key) !== after.get(key)) {
      delete next.progress.shopping[key];
      delete next.progress.owned[key];
    }
  }
  const e = validatePlan(next.plan);
  if (e.length) throw Error(e.join("\n"));
  return next;
}
