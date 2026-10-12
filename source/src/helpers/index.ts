import { type Plan, type Meal, type State, type Progress } from "src/types";
import { defaultMonday, isMonday, aggregate, ingredientKey } from "src/utils";
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
    plan,
    servings: plan.servings,
    weekStart: defaultMonday(),
    progress: freshProgress(),
    timer: null,
    timers: [],
  };
}
export function hydrateState(raw: unknown, defaults: Plan): State {
  const v = raw as State;
  if (!v) return freshState(defaults);
  parseBackup(v);
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
  const savedFood = Array.isArray(v.savedFood) ? v.savedFood : [];
  const ids = new Set<string>();
  for (const food of savedFood) {
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
      !["prepared", "recipe"].includes(food.kind) ||
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
  const next = structuredClone(s);
  for (const k of Object.keys(next.progress.prep))
    if (k.startsWith(id + ":")) delete next.progress.prep[k];
  for (const key of Object.keys(next.preparedTasks || {}))
    if (key.startsWith(id + ":")) delete next.preparedTasks![key];
  if (next.mealCredits) delete next.mealCredits[id];
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
