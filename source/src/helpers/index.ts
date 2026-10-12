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
    weekStart: isMonday(v.weekStart) ? v.weekStart : defaultMonday(),
    progress,
    timer,
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
  return next;
}
export function replaceMeal(s: State, id: string, updated: Meal): State {
  const next = resetForMeal(s, id);
  next.plan.meals = next.plan.meals.map((m) => (m.id === id ? updated : m));
  const before = new Map(aggregate(s.plan, s.servings).map((i) => [ingredientKey(i), i.qty]));
  const after = new Map(aggregate(next.plan, next.servings).map((i) => [ingredientKey(i), i.qty]));
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
