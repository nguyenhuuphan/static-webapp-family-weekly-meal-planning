import { type Plan, type Meal, type State, type Progress } from "src/types";
import { defaultMonday, isMonday, aggregate, ingredientKey } from "src/utils";
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
    purchased,
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
  delete next.progress.ready[id];
  delete next.progress.done[id];
  delete next.progress.cook[id];
  if (next.timer?.mealId === id) next.timer = null;
  next.timers = next.timers?.filter((timer) => timer.mealId !== id);
  return next;
}
export function replaceMeal(s: State, id: string, updated: Meal): State {
  const next = resetForMeal(s, id);
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
